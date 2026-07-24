// Рабочая очередь задач парсинга Telegram (реальные данные через MTProto).
// Задачи выполняются в процессе сервера, поэтому продолжают работать после
// закрытия браузера. Управление: запустить/пауза/продолжить/остановить.
// Никаких сгенерированных данных — только ответы Telegram API.

import { getAccount } from "./tgAccounts";

export type JobKind = "audience" | "content";
export type JobMode = "participants" | "message_authors" | "comment_authors";
export type JobStatus = "running" | "paused" | "flood" | "done" | "error" | "stopped";

export type AudienceRow = { user_id: string; username: string; name: string; source: string; activity_date: string; premium: boolean };
export type ContentRow = { text: string; date: string; link: string; views: number; reactions: number; media: string };
export type LogRow = { t: string; msg: string; kind: "info" | "ok" | "warn" | "err" };

export type Protect = "off" | "conservative" | "balanced" | "aggressive";
export type AudienceFilters = {
  skipBots: boolean; skipDeleted: boolean; skipScam: boolean; onlyActive: boolean;
  onlyUsername: boolean; onlyPhoto: boolean; onlyPremium: boolean;
  inclReplies: boolean; inclForwards: boolean;
};
export type AudienceOpts = {
  sources: string[]; mode: JobMode; target: number; days: number; keywords: string[];
  filters: AudienceFilters; protect: Protect; fast: boolean; delayChat: number; delayUser: number;
};

export type Job = {
  id: string;
  kind: JobKind;
  mode: JobMode | "content";
  status: JobStatus;
  source: string;
  sources: string[];
  progress: number;
  found: number;
  saved: number;
  skipped: number;
  target: number;
  error: string;
  floodSeconds: number;
  audience: AudienceRow[];
  content: ContentRow[];
  logs: LogRow[];
  createdAt: number;
  updatedAt: number;
  _paused: boolean;
  _stop: boolean;
};

// Задержки под уровень «AI-защиты аккаунтов» (мс). Быстрый режим — минимум.
function delaysFor(protect: Protect, fast: boolean, dChat?: number, dUser?: number): { user: number; chat: number } {
  if (fast) return { user: 15, chat: 300 };
  const preset: Record<Protect, { user: number; chat: number }> = {
    off: { user: 40, chat: 600 },
    aggressive: { user: 120, chat: 1200 },
    balanced: { user: 350, chat: 3000 },
    conservative: { user: 800, chat: 6000 },
  };
  const p = preset[protect] || preset.off;
  return { user: dUser && dUser > 0 ? dUser : p.user, chat: dChat && dChat > 0 ? dChat : p.chat };
}

function log(job: Job, msg: string, kind: LogRow["kind"] = "info") {
  const t = new Date().toISOString().slice(11, 19);
  job.logs.push({ t, msg, kind });
  if (job.logs.length > 400) job.logs.splice(0, job.logs.length - 400);
  job.updatedAt = Date.now();
}

// Проверка пользователя по фильтрам профиля/статуса.
function hasPhoto(u: any): boolean { return !!u?.photo && u.photo.className !== "UserProfilePhotoEmpty"; }
function passFilters(u: any, f: AudienceFilters, checkStatus = false): boolean {
  if (f.skipBots && u.bot) return false;
  if (f.skipDeleted && u.deleted) return false;
  if (f.skipScam && (u.scam || u.fake)) return false;
  if (f.onlyUsername && !u.username) return false;
  if (f.onlyPhoto && !hasPhoto(u)) return false;
  if (f.onlyPremium && !u.premium) return false;
  // «Только активные» имеет смысл лишь для списка участников (где есть статус).
  // В режиме «по сообщениям» пользователь активен по факту написанного сообщения.
  if (f.onlyActive && checkStatus) {
    const st = u.status?.className || "";
    if (st === "UserStatusEmpty" || st === "UserStatusLastMonth") return false;
  }
  return true;
}

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
const DEFAULT_FILTERS: AudienceFilters = {
  skipBots: true, skipDeleted: true, skipScam: true, onlyActive: false,
  onlyUsername: false, onlyPhoto: false, onlyPremium: false, inclReplies: true, inclForwards: false,
};

export function startAudienceJob(accountId: string, optsIn: Partial<AudienceOpts> & { source?: string }): { ok: boolean; jobId?: string; error?: string } {
  const acc = getAccount(accountId);
  if (!acc) return { ok: false, error: "Аккаунт Telegram не подключён." };
  const sources = (optsIn.sources && optsIn.sources.length ? optsIn.sources : [optsIn.source || ""]).map((s) => String(s || "").trim()).filter(Boolean);
  if (!sources.length) return { ok: false, error: "Укажите хотя бы один чат." };
  const opts: AudienceOpts = {
    sources,
    mode: (["participants", "message_authors", "comment_authors"].includes(optsIn.mode as string) ? optsIn.mode : "participants") as JobMode,
    target: Math.min(Math.max(Number(optsIn.target) || 1000, 1), 500000),
    days: Math.max(Number(optsIn.days) || 0, 0),
    keywords: (optsIn.keywords || []).map((k) => String(k).toLowerCase().trim()).filter(Boolean),
    filters: { ...DEFAULT_FILTERS, ...(optsIn.filters || {}) },
    protect: (optsIn.protect || "off") as Protect,
    fast: !!optsIn.fast,
    delayChat: Number(optsIn.delayChat) || 0,
    delayUser: Number(optsIn.delayUser) || 0,
  };
  const job: Job = {
    id: newId(), kind: "audience", mode: opts.mode, status: "running", source: sources[0], sources,
    progress: 0, found: 0, saved: 0, skipped: 0, target: opts.target,
    error: "", floodSeconds: 0, audience: [], content: [], logs: [],
    createdAt: Date.now(), updatedAt: Date.now(), _paused: false, _stop: false,
  };
  jobs.set(job.id, job);
  void runAudience(job, acc, opts);
  return { ok: true, jobId: job.id };
}

async function runAudience(job: Job, acc: any, opts: AudienceOpts) {
  let client: any;
  const seen = new Set<string>();
  const delay = delaysFor(opts.protect, opts.fast, opts.delayChat, opts.delayUser);
  const minTs = opts.days > 0 ? Date.now() - opts.days * 86400000 : 0;
  try {
    const { Api } = await import("telegram");
    client = await makeClient(acc.apiId, acc.apiHash, acc.session);
    log(job, `Запуск: чатов — ${opts.sources.length}, режим — ${opts.mode === "participants" ? "участники группы" : opts.mode === "comment_authors" ? "комментаторы" : "по сообщениям"}`);
    if (opts.protect !== "off" && !opts.fast) log(job, `AI-защита аккаунта: ${opts.protect} (задержки ${delay.user}мс/${delay.chat}мс)`);
    if (opts.keywords.length) log(job, `Ключевые слова: ${opts.keywords.join(", ")}`);

    for (let si = 0; si < opts.sources.length; si++) {
      if (job._stop) break;
      if (job.saved >= job.target) break;
      const raw = opts.sources[si];
      let entity: any;
      try { entity = await client.getEntity(normalize(raw)); }
      catch (e: any) { log(job, `Пропущен «${raw}»: ${cleanErr(e)}`, "warn"); continue; }
      let baseUser = entity.username ? "@" + entity.username : (entity.title || String(entity.id));

      // Режим комментариев — переходим на привязанную группу обсуждений.
      if (opts.mode === "comment_authors") {
        try {
          const full: any = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
          const lid = full?.fullChat?.linkedChatId;
          if (!lid) { log(job, `«${baseUser}»: нет группы обсуждений — пропуск`, "warn"); continue; }
          entity = await client.getEntity(lid);
        } catch (e: any) { log(job, `«${baseUser}»: ${cleanErr(e)}`, "warn"); continue; }
      }

      log(job, `Обрабатываю: ${baseUser}`);

      if (opts.mode === "participants") {
        try { await client.getParticipants(entity, { limit: 1 }); }
        catch (e: any) {
          log(job, `«${baseUser}»: список участников недоступен (${cleanErr(e)})`, "warn");
          continue;
        }
        const it: AsyncIterator<any> = (client.iterParticipants(entity, { limit: opts.target }) as any)[Symbol.asyncIterator]();
        for (;;) {
          const r = await pull(it, job);
          if (r.done) break;
          const u = r.value;
          if (!u || u.className !== "User") { job.skipped++; continue; }
          const id = String(u.id);
          if (seen.has(id)) { job.skipped++; continue; }
          if (!passFilters(u, opts.filters, true)) { job.skipped++; continue; }
          seen.add(id); job.found++;
          job.audience.push({ user_id: id, username: u.username ? "@" + u.username : "", name: personName(u), source: baseUser, activity_date: dstr(u?.participant?.date), premium: !!u.premium });
          job.saved++;
          job.progress = Math.min(99, Math.round((job.saved / job.target) * 100));
          job.updatedAt = Date.now();
          if (job.saved >= job.target) break;
          if (delay.user) await sleep(delay.user);
        }
      } else {
        // Авторы сообщений / комментаторы — по истории сообщений.
        const it: AsyncIterator<any> = (client.iterMessages(entity, { limit: 200000 }) as any)[Symbol.asyncIterator]();
        for (;;) {
          const r = await pull(it, job);
          if (r.done) break;
          const m = r.value;
          if (!m) { job.skipped++; continue; }
          const ts = (m.date || 0) * 1000;
          if (minTs && ts && ts < minTs) break; // история идёт от новых к старым
          if (!opts.filters.inclForwards && m.fwdFrom) { job.skipped++; continue; }
          if (!opts.filters.inclReplies && m.replyTo) { job.skipped++; continue; }
          const text = (m.message || "").toLowerCase();
          if (opts.keywords.length && !opts.keywords.some((k) => text.includes(k))) { job.skipped++; continue; }
          const u = m?.sender;
          if (!u || u.className !== "User") { job.skipped++; continue; }
          const id = String(u.id);
          if (seen.has(id)) { job.skipped++; continue; }
          if (!passFilters(u, opts.filters)) { job.skipped++; continue; }
          seen.add(id); job.found++;
          job.audience.push({ user_id: id, username: u.username ? "@" + u.username : "", name: personName(u), source: baseUser, activity_date: dstr(m.date), premium: !!u.premium });
          job.saved++;
          job.progress = Math.min(99, Math.round((job.saved / job.target) * 100));
          job.updatedAt = Date.now();
          if (job.saved >= job.target) break;
          if (delay.user) await sleep(delay.user);
        }
      }
      log(job, `${baseUser}: собрано ${job.saved}`, "ok");
      if (si < opts.sources.length - 1 && delay.chat) await sleep(delay.chat);
    }

    if (job.status !== "error" && job.status !== "stopped") {
      job.status = "done"; job.progress = 100;
      log(job, `Готово. Уникальных пользователей: ${job.audience.length}`, "ok");
    }
  } catch (e: any) {
    job.status = "error"; job.error = cleanErr(e);
    log(job, cleanErr(e), "err");
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
    id: newId(), kind: "content", mode: "content", status: "running", source, sources: [source],
    progress: 0, found: 0, saved: 0, skipped: 0, target: Math.min(Math.max(opts.limit || 200, 1), 5000),
    error: "", floodSeconds: 0, audience: [], content: [], logs: [],
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
  const head = "user_id,username,name,source,activity_date,premium";
  if (!j) return head + "\n";
  const esc = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
  const rows = j.audience.map((r) => [r.user_id, r.username, esc(r.name), esc(r.source), r.activity_date, r.premium ? "yes" : "no"].join(","));
  return [head, ...rows].join("\n");
}

// Публичный снимок задачи (без внутренних флагов).
export function jobSnapshot(id: string) {
  const j = jobs.get(id);
  if (!j) return null;
  const { _paused, _stop, ...pub } = j;
  return pub;
}
