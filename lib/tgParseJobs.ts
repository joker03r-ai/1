// Рабочая очередь задач парсинга Telegram (реальные данные через MTProto).
// Задачи выполняются в процессе сервера, поэтому продолжают работать после
// закрытия браузера. Управление: запустить/пауза/продолжить/остановить.
// Никаких сгенерированных данных — только ответы Telegram API.

import { getAccount } from "./tgAccounts";

export type JobKind = "audience" | "content";
export type JobMode = "participants" | "message_authors" | "comment_authors";
export type JobStatus = "running" | "paused" | "flood" | "done" | "error" | "stopped";

export type AudienceRow = { user_id: string; username: string; name: string; source: string; activity_date: string };
export type ContentRow = { text: string; date: string; link: string; views: number; reactions: number; media: string };

export type Job = {
  id: string;
  kind: JobKind;
  mode: JobMode | "content";
  status: JobStatus;
  source: string;
  progress: number;
  found: number;
  saved: number;
  skipped: number;
  target: number;
  error: string;
  floodSeconds: number;
  audience: AudienceRow[];
  content: ContentRow[];
  createdAt: number;
  updatedAt: number;
  _paused: boolean;
  _stop: boolean;
};

const g = globalThis as unknown as { __tgJobs?: Map<string, Job> };
const jobs: Map<string, Job> = g.__tgJobs || (g.__tgJobs = new Map());

function newId() { return "job_" + Math.random().toString(36).slice(2, 10); }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function cleanErr(e: any): string {
  const m = String(e?.errorMessage || e?.message || e || "ошибка");
  if (m.includes("CHANNEL_PRIVATE")) return "Канал/группа приватные или недоступны вашему аккаунту.";
  if (m.includes("CHAT_ADMIN_REQUIRED")) return "Telegram не предоставляет список участников. Вступите в группу или получите права администратора.";
  if (m.includes("USERNAME_NOT_OCCUPIED") || m.includes("No user has") || m.includes("USERNAME_INVALID")) return "Источник не найден. Проверьте ссылку или username.";
  if (m.includes("FLOOD_WAIT")) return "Ограничение Telegram (flood). Подождите немного.";
  return m;
}

function normalize(raw: string): string {
  let s = String(raw || "").trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^t\.me\//i, "").replace(/^telegram\.me\//i, "");
  s = s.replace(/^\+/, "").replace(/^joinchat\//i, "");
  return s.replace(/^@/, "").replace(/\/+$/, "");
}
function personName(u: any): string {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "Без имени";
}
function dstr(unixSec: number | undefined): string {
  return unixSec ? new Date(unixSec * 1000).toISOString().slice(0, 10) : "";
}

async function makeClient(apiId: string, apiHash: string, session: string) {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions");
  const { Logger } = await import("telegram/extensions/Logger");
  const logger = new Logger();
  (logger as any).log = () => {};
  const client = new TelegramClient(new StringSession(session), Number(apiId), String(apiHash), {
    connectionRetries: 2, timeout: 15, requestRetries: 2, baseLogger: logger as any,
  });
  await client.connect();
  return client;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
export function controlJob(id: string, action: "pause" | "resume" | "stop"): boolean {
  const j = jobs.get(id);
  if (!j) return false;
  if (action === "pause") { j._paused = true; if (j.status === "running") j.status = "paused"; }
  if (action === "resume") { j._paused = false; if (j.status === "paused") j.status = "running"; }
  if (action === "stop") { j._stop = true; j.status = "stopped"; }
  j.updatedAt = Date.now();
  return true;
}

// Ждём снятия паузы; false — если остановлено.
async function gate(j: Job): Promise<boolean> {
  while (j._paused && !j._stop) { j.status = "paused"; await sleep(300); }
  if (j._stop) return false;
  if (j.status === "paused") j.status = "running";
  return true;
}

// Достаём следующий элемент итератора с обработкой паузы/стопа/FLOOD_WAIT.
async function pull(it: AsyncIterator<any>, j: Job): Promise<{ done: boolean; value?: any }> {
  for (;;) {
    if (!(await gate(j))) return { done: true };
    try {
      const r = await it.next();
      return { done: !!r.done, value: r.value };
    } catch (e: any) {
      const m = String(e?.errorMessage || e?.message || "");
      const fw = m.match(/FLOOD_WAIT_(\d+)/);
      if (fw) {
        j.status = "flood";
        j.floodSeconds = Number(fw[1]);
        // Автоматическая пауза на время флуда.
        for (let s = Number(fw[1]) + 1; s > 0 && !j._stop; s--) { j.floodSeconds = s; await sleep(1000); }
        j.floodSeconds = 0;
        if (j._stop) return { done: true };
        j.status = "running";
        continue;
      }
      j.status = "error";
      j.error = cleanErr(e);
      return { done: true };
    }
  }
}

// Определяем тип источника и доступность.
export async function resolveSource(accountId: string, link: string) {
  const acc = getAccount(accountId);
  if (!acc) return { ok: false, error: "Аккаунт Telegram не подключён." };
  const ref = normalize(link);
  if (!ref) return { ok: false, error: "Укажите ссылку или username источника." };
  let client: any;
  try {
    const { Api } = await import("telegram");
    client = await makeClient(acc.apiId, acc.apiHash, acc.session);
    const entity: any = await client.getEntity(ref);
    const cls = entity.className;
    let type: "supergroup" | "broadcast" | "group" | "user" | "unknown" = "unknown";
    if (cls === "Channel") type = entity.broadcast ? "broadcast" : "supergroup";
    else if (cls === "Chat") type = "group";
    else if (cls === "User") type = "user";

    let participantsAvailable = false;
    let commentsAvailable = false;
    let linkedChatId = "";
    let title = entity.title || (entity.username ? "@" + entity.username : personName(entity));

    if (type === "supergroup" || type === "group") {
      try {
        const test = await client.getParticipants(entity, { limit: 1 });
        participantsAvailable = Array.isArray(test);
      } catch { participantsAvailable = false; }
    }
    if (type === "broadcast") {
      try {
        const full: any = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
        const lid = full?.fullChat?.linkedChatId;
        if (lid) { linkedChatId = String(lid); commentsAvailable = true; }
      } catch {}
    }
    try { await client.disconnect(); } catch {}

    const suggestedMode: JobMode = type === "broadcast"
      ? (commentsAvailable ? "comment_authors" : "message_authors")
      : (participantsAvailable ? "participants" : "message_authors");

    return { ok: true, type, title, username: entity.username ? "@" + entity.username : "", id: String(entity.id), participantsAvailable, commentsAvailable, linkedChatId, suggestedMode };
  } catch (e: any) {
    try { await client?.disconnect(); } catch {}
    return { ok: false, error: cleanErr(e) };
  }
}

// ---- Аудитория ----
export function startAudienceJob(accountId: string, source: string, mode: JobMode, target: number): { ok: boolean; jobId?: string; error?: string } {
  const acc = getAccount(accountId);
  if (!acc) return { ok: false, error: "Аккаунт Telegram не подключён." };
  const job: Job = {
    id: newId(), kind: "audience", mode, status: "running", source,
    progress: 0, found: 0, saved: 0, skipped: 0, target: Math.min(Math.max(target || 1000, 1), 100000),
    error: "", floodSeconds: 0, audience: [], content: [],
    createdAt: Date.now(), updatedAt: Date.now(), _paused: false, _stop: false,
  };
  jobs.set(job.id, job);
  void runAudience(job, acc);
  return { ok: true, jobId: job.id };
}

async function runAudience(job: Job, acc: any) {
  let client: any;
  try {
    const { Api } = await import("telegram");
    client = await makeClient(acc.apiId, acc.apiHash, acc.session);
    let entity: any = await client.getEntity(normalize(job.source));
    const baseUser = entity.username ? "@" + entity.username : (entity.title || String(entity.id));

    // Для режима комментариев — переходим на привязанную группу обсуждений.
    if (job.mode === "comment_authors") {
      const full: any = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
      const lid = full?.fullChat?.linkedChatId;
      if (!lid) { job.status = "error"; job.error = "У канала нет группы обсуждений — доступен только парсинг контента."; return; }
      entity = await client.getEntity(lid);
    }

    const seen = new Set<string>();

    if (job.mode === "participants") {
      // Проверяем доступность заранее — честная ошибка вместо пустого экрана.
      try { await client.getParticipants(entity, { limit: 1 }); }
      catch (e: any) { job.status = "error"; job.error = cleanErr(e); return; }
      const it: AsyncIterator<any> = (client.iterParticipants(entity, { limit: job.target }) as any)[Symbol.asyncIterator]();
      for (;;) {
        const r = await pull(it, job);
        if (r.done) break;
        const u = r.value;
        if (!u || u.className !== "User") { job.skipped++; continue; }
        const id = String(u.id);
        if (seen.has(id)) { job.skipped++; continue; }
        seen.add(id);
        job.found++;
        job.audience.push({ user_id: id, username: u.username ? "@" + u.username : "", name: personName(u), source: baseUser, activity_date: dstr(u?.participant?.date) });
        job.saved++;
        job.progress = Math.min(99, Math.round((job.saved / job.target) * 100));
        job.updatedAt = Date.now();
        if (job.saved >= job.target) break;
      }
    } else {
      // Авторы сообщений / комментаторы — по истории сообщений.
      const it: AsyncIterator<any> = (client.iterMessages(entity, { limit: 100000 }) as any)[Symbol.asyncIterator]();
      for (;;) {
        const r = await pull(it, job);
        if (r.done) break;
        const m = r.value;
        const u = m?.sender;
        if (!u || u.className !== "User") { job.skipped++; continue; }
        const id = String(u.id);
        if (seen.has(id)) { job.skipped++; continue; }
        seen.add(id);
        job.found++;
        job.audience.push({ user_id: id, username: u.username ? "@" + u.username : "", name: personName(u), source: baseUser, activity_date: dstr(m.date) });
        job.saved++;
        job.progress = Math.min(99, Math.round((job.saved / job.target) * 100));
        job.updatedAt = Date.now();
        if (job.saved >= job.target) break;
      }
    }

    if (job.status !== "error" && job.status !== "stopped") { job.status = "done"; job.progress = 100; }
  } catch (e: any) {
    job.status = "error"; job.error = cleanErr(e);
  } finally {
    job.updatedAt = Date.now();
    try { await client?.disconnect(); } catch {}
  }
}

// ---- Контент ----
export function startContentJob(accountId: string, source: string, opts: { days: number; keywords: string[]; limit: number }): { ok: boolean; jobId?: string; error?: string } {
  const acc = getAccount(accountId);
  if (!acc) return { ok: false, error: "Аккаунт Telegram не подключён." };
  const job: Job = {
    id: newId(), kind: "content", mode: "content", status: "running", source,
    progress: 0, found: 0, saved: 0, skipped: 0, target: Math.min(Math.max(opts.limit || 200, 1), 5000),
    error: "", floodSeconds: 0, audience: [], content: [],
    createdAt: Date.now(), updatedAt: Date.now(), _paused: false, _stop: false,
  };
  jobs.set(job.id, job);
  void runContent(job, acc, opts);
  return { ok: true, jobId: job.id };
}

async function runContent(job: Job, acc: any, opts: { days: number; keywords: string[]; limit: number }) {
  let client: any;
  try {
    client = await makeClient(acc.apiId, acc.apiHash, acc.session);
    const entity: any = await client.getEntity(normalize(job.source));
    const uname = entity.username ? String(entity.username) : "";
    const kws = (opts.keywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
    const minTs = opts.days > 0 ? Date.now() - opts.days * 86400000 : 0;
    const it: AsyncIterator<any> = (client.iterMessages(entity, { limit: 100000 }) as any)[Symbol.asyncIterator]();
    for (;;) {
      const r = await pull(it, job);
      if (r.done) break;
      const m = r.value;
      if (!m) { job.skipped++; continue; }
      const ts = (m.date || 0) * 1000;
      if (minTs && ts && ts < minTs) break; // история идёт от новых к старым
      const text = (m.message || "").trim();
      if (!text && !m.media) { job.skipped++; continue; }
      if (kws.length && !kws.some((k) => text.toLowerCase().includes(k))) { job.skipped++; continue; }
      job.found++;
      const reactions = (m.reactions?.results || []).reduce((a: number, x: any) => a + (x.count || 0), 0);
      const media = m.photo ? "фото" : m.video ? "видео" : m.document ? "файл" : m.poll ? "опрос" : "";
      job.content.push({
        text: text || "(медиа без текста)",
        date: dstr(m.date),
        link: uname ? `https://t.me/${uname}/${m.id}` : "",
        views: m.views || 0,
        reactions,
        media,
      });
      job.saved++;
      job.progress = Math.min(99, Math.round((job.saved / job.target) * 100));
      job.updatedAt = Date.now();
      if (job.saved >= job.target) break;
    }
    if (job.status !== "error" && job.status !== "stopped") { job.status = "done"; job.progress = 100; }
  } catch (e: any) {
    job.status = "error"; job.error = cleanErr(e);
  } finally {
    job.updatedAt = Date.now();
    try { await client?.disconnect(); } catch {}
  }
}

// CSV аудитории — БЕЗ номеров телефонов.
export function audienceCsv(id: string): string {
  const j = jobs.get(id);
  const head = "user_id,username,name,source,activity_date";
  if (!j) return head + "\n";
  const esc = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
  const rows = j.audience.map((r) => [r.user_id, r.username, esc(r.name), esc(r.source), r.activity_date].join(","));
  return [head, ...rows].join("\n");
}

// Публичный снимок задачи (без внутренних флагов).
export function jobSnapshot(id: string) {
  const j = jobs.get(id);
  if (!j) return null;
  const { _paused, _stop, ...pub } = j;
  return pub;
}
