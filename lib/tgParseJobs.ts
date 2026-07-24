// Рабочая очередь задач парсинга Telegram (реальные данные через MTProto).
// Задачи выполняются в процессе сервера, поэтому продолжают работать после
// закрытия браузера. Управление: запустить/пауза/продолжить/остановить.
// Никаких сгенерированных данных — только ответы Telegram API.

import { getAccount } from "./tgAccounts";

export type JobKind = "audience" | "content" | "channels" | "resolve";
export type JobMode = "participants" | "message_authors" | "comment_authors" | "search" | "similar" | "resolve";
export type JobStatus = "running" | "paused" | "flood" | "done" | "error" | "stopped";

export type AudienceRow = { user_id: string; username: string; name: string; source: string; activity_date: string; premium: boolean };
export type ContentRow = { text: string; date: string; link: string; views: number; reactions: number; media: string };
// Канал в базе: числовой id — первичный ключ, username вторичен.
export type ChannelRow = {
  id: string; title: string; username: string; link: string;
  subscribers: number; comments: boolean; language: string; rating: number;
  type: string; created: string; avgViews: number; postFreq: number; description: string; active: boolean;
  via?: string; // источник (для «похожих» — от какого канала)
};
export type ResolvedRow = { phone: string; user_id: string; username: string; name: string; found: boolean };
export type LogRow = { t: string; msg: string; kind: "info" | "ok" | "warn" | "err" };

export type ChannelFilters = { minSubs: number; onlyComments: boolean; minRating: number; langs: string[]; onlyActive: boolean };
export const DEFAULT_CH_FILTERS: ChannelFilters = { minSubs: 0, onlyComments: false, minRating: 1, langs: [], onlyActive: false };

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
  channels: ChannelRow[];
  resolved: ResolvedRow[];
  logs: LogRow[];
  title: string; // человекочитаемое имя запуска (для истории)
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
  // «Были в сети до 30 дней»: оставляем Online / Recently / LastWeek / LastMonth,
  // отсеиваем LongAgo, Empty и скрытый статус. Имеет смысл для списка участников
  // (в режиме «по сообщениям» пользователь активен по факту сообщения).
  if (f.onlyActive && checkStatus) {
    const st = u.status?.className || "";
    const ok = st === "UserStatusOnline" || st === "UserStatusRecently" || st === "UserStatusLastWeek" || st === "UserStatusLastMonth";
    if (!ok) return false;
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
    error: "", floodSeconds: 0, audience: [], content: [], channels: [], resolved: [], logs: [], title: "",
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
    error: "", floodSeconds: 0, audience: [], content: [], channels: [], resolved: [], logs: [], title: "",
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
/* ==================== КАНАЛЫ: поиск, похожие, резолвинг ==================== */

function detectLang(text: string): string {
  const cyr = (text.match(/[а-яё]/gi) || []).length;
  const lat = (text.match(/[a-z]/gi) || []).length;
  if (cyr === 0 && lat === 0) return "—";
  return cyr >= lat ? "ru" : "en";
}
// Эвристический рейтинг канала для рассылки (1–10).
function ratingOf(ch: ChannelRow): number {
  let s = 5;
  const vr = ch.subscribers ? ch.avgViews / ch.subscribers : 0; // вовлечённость (просмотры/подписчики)
  if (vr > 0.3) s += 2; else if (vr > 0.15) s += 1; else if (vr > 0 && vr < 0.05) s -= 1;
  if (ch.postFreq >= 1) s += 1; else if (ch.postFreq > 0 && ch.postFreq < 0.2) s -= 1;
  if (ch.description) s += 1;
  if (ch.comments) s += 1;
  if (ch.subscribers >= 10000) s += 1; else if (ch.subscribers > 0 && ch.subscribers < 500) s -= 1;
  if (!ch.active) s -= 2;
  return Math.max(1, Math.min(10, Math.round(s)));
}
// Обогащение канала: подписчики, комментарии, описание, просмотры, активность.
async function enrichChannel(client: any, Api: any, entity: any): Promise<ChannelRow> {
  let subscribers = 0, comments = false, description = "";
  try {
    const full: any = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
    subscribers = Number(full?.fullChat?.participantsCount || 0);
    description = String(full?.fullChat?.about || "");
    comments = !!full?.fullChat?.linkedChatId;
  } catch {}
  let avgViews = 0, postFreq = 0, active = false;
  try {
    const msgs: any[] = [];
    for await (const m of client.iterMessages(entity, { limit: 20 })) msgs.push(m);
    if (msgs.length) {
      const views = msgs.map((m) => m.views || 0).filter((v) => v > 0);
      avgViews = views.length ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : 0;
      const dates = msgs.map((m) => (m.date || 0) * 1000).filter(Boolean);
      if (dates.length) {
        const newest = Math.max(...dates), oldest = Math.min(...dates);
        const spanDays = Math.max((newest - oldest) / 86400000, 0.5);
        postFreq = +(((msgs.length - 1) / spanDays)).toFixed(2);
        active = Date.now() - newest < 30 * 86400000;
      }
    }
  } catch {}
  const username = entity.username ? "@" + entity.username : "";
  const type = entity.broadcast ? "Канал" : entity.megagroup ? "Группа" : "Чат";
  const row: ChannelRow = {
    id: String(entity.id), title: entity.title || username || String(entity.id), username,
    link: entity.username ? `https://t.me/${entity.username}` : "",
    subscribers, comments, language: detectLang((entity.title || "") + " " + description), rating: 0,
    type, created: dstr(entity.date), avgViews, postFreq, description, active,
  };
  row.rating = ratingOf(row);
  return row;
}

function passChannel(job: Job, row: ChannelRow, f: ChannelFilters): boolean {
  if (f.minSubs && row.subscribers < f.minSubs) { log(job, `${row.title}: подписчиков ${row.subscribers} < ${f.minSubs} — пропуск`, "warn"); return false; }
  if (f.onlyComments && !row.comments) { log(job, `${row.title}: комментарии закрыты — пропуск`, "warn"); return false; }
  if (f.minRating > 1 && row.rating < f.minRating) { log(job, `${row.title}: рейтинг ${row.rating} < ${f.minRating} — пропуск`, "warn"); return false; }
  if (f.langs.length && !f.langs.includes(row.language)) { log(job, `${row.title}: язык «${row.language}» не подходит — пропуск`, "warn"); return false; }
  if (f.onlyActive && !row.active) { log(job, `${row.title}: неактивен (нет свежих постов) — пропуск`, "warn"); return false; }
  return true;
}

function mkJob(kind: JobKind, mode: JobMode, title: string, target: number): Job {
  const job: Job = {
    id: newId(), kind, mode, status: "running", source: title, sources: [], progress: 0,
    found: 0, saved: 0, skipped: 0, target, error: "", floodSeconds: 0,
    audience: [], content: [], channels: [], resolved: [], logs: [], title,
    createdAt: Date.now(), updatedAt: Date.now(), _paused: false, _stop: false,
  };
  jobs.set(job.id, job);
  return job;
}

// ---- 1.2 Поиск каналов по ключевым словам (комбинатор ключ × окончание) ----
export function startChannelSearch(accountId: string, opts: { keywords: string[]; suffixes: string[]; filters: Partial<ChannelFilters>; protect?: Protect; fast?: boolean }): { ok: boolean; jobId?: string; error?: string } {
  const acc = getAccount(accountId);
  if (!acc) return { ok: false, error: "Аккаунт Telegram не подключён." };
  const keywords = (opts.keywords || []).map((s) => String(s).trim()).filter(Boolean);
  if (!keywords.length) return { ok: false, error: "Добавьте хотя бы одно ключевое слово." };
  const suffixes = (opts.suffixes || []).map((s) => String(s).trim()).filter(Boolean);
  const filters: ChannelFilters = { ...DEFAULT_CH_FILTERS, ...(opts.filters || {}) };
  const job = mkJob("channels", "search", `Поиск: ${keywords.slice(0, 3).join(", ")}${keywords.length > 3 ? "…" : ""}`, 0);
  void runChannelSearch(job, acc, { keywords, suffixes, filters, protect: opts.protect || "balanced", fast: !!opts.fast });
  return { ok: true, jobId: job.id };
}

async function runChannelSearch(job: Job, acc: any, opts: { keywords: string[]; suffixes: string[]; filters: ChannelFilters; protect: Protect; fast: boolean }) {
  let client: any;
  const seen = new Set<string>();
  const delay = delaysFor(opts.protect, opts.fast);
  try {
    const { Api } = await import("telegram");
    client = await makeClient(acc.apiId, acc.apiHash, acc.session);
    // Комбинатор: декартово произведение ключей и окончаний.
    const queries: string[] = [];
    for (const k of opts.keywords) { queries.push(k); for (const s of opts.suffixes) queries.push(`${k} ${s}`); }
    const uniqQ = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
    job.target = uniqQ.length;
    log(job, `Запросов к поиску Telegram: ${uniqQ.length} (Telegram отдаёт ~10 каналов на запрос — расширяйте базу через «Похожие»)`);
    for (let qi = 0; qi < uniqQ.length; qi++) {
      if (!(await gate(job))) break;
      const q = uniqQ[qi];
      job.progress = Math.round(((qi + 1) / uniqQ.length) * 100);
      let res: any;
      try { res = await client.invoke(new Api.contacts.Search({ q, limit: 25 })); }
      catch (e: any) {
        const m = String(e?.errorMessage || e?.message || "");
        const fw = m.match(/FLOOD_WAIT_(\d+)/);
        if (fw) { job.status = "flood"; for (let s = Number(fw[1]) + 1; s > 0 && !job._stop; s--) { job.floodSeconds = s; await sleep(1000); } job.floodSeconds = 0; job.status = "running"; }
        else log(job, `«${q}»: ${cleanErr(e)}`, "warn");
        continue;
      }
      const chats: any[] = res.chats || [];
      const botCount = (res.users || []).filter((u: any) => u.bot).length;
      if (botCount) log(job, `«${q}»: боты отсеяны автоматически (${botCount})`);
      for (const ch of chats) {
        if (job._stop) break;
        if (ch.className !== "Channel") continue; // только каналы/супергруппы (есть числовой id)
        const id = String(ch.id);
        if (seen.has(id)) { job.skipped++; continue; }
        seen.add(id);
        let row: ChannelRow;
        try { row = await enrichChannel(client, Api, ch); }
        catch { row = { id, title: ch.title || String(id), username: ch.username ? "@" + ch.username : "", link: ch.username ? `https://t.me/${ch.username}` : "", subscribers: 0, comments: false, language: detectLang(ch.title || ""), rating: 1, type: ch.broadcast ? "Канал" : "Группа", created: dstr(ch.date), avgViews: 0, postFreq: 0, description: "", active: false }; }
        job.found++;
        if (!passChannel(job, row, opts.filters)) { job.skipped++; continue; }
        job.channels.push(row); job.saved++;
        log(job, `+ ${row.title} · ${row.subscribers} подписчиков · рейтинг ${row.rating}${row.comments ? " · комментарии открыты" : ""}`, "ok");
        if (delay.user) await sleep(delay.user);
      }
      if (delay.chat) await sleep(delay.chat);
    }
    if (job.status !== "error" && job.status !== "stopped") { job.status = "done"; job.progress = 100; log(job, `Готово. Каналов в базе: ${job.channels.length}`, "ok"); }
  } catch (e: any) { job.status = "error"; job.error = cleanErr(e); log(job, cleanErr(e), "err"); }
  finally { job.updatedAt = Date.now(); try { await client?.disconnect(); } catch {} }
}

// ---- 1.3 Расширение базы через «Похожие каналы» (GetChannelRecommendations) ----
export function startSimilarExpand(accountId: string, opts: { sources: string[]; depth: number; dedup: boolean; existing?: string[]; filters: Partial<ChannelFilters>; protect?: Protect; fast?: boolean }): { ok: boolean; jobId?: string; error?: string } {
  const acc = getAccount(accountId);
  if (!acc) return { ok: false, error: "Аккаунт Telegram не подключён." };
  const sources = (opts.sources || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
  if (!sources.length) return { ok: false, error: "Вставьте исходные каналы (до 50)." };
  const filters: ChannelFilters = { ...DEFAULT_CH_FILTERS, ...(opts.filters || {}) };
  const job = mkJob("channels", "similar", `Похожие: ${sources.length} исходных`, sources.length);
  void runSimilar(job, acc, { sources, depth: Math.min(Math.max(opts.depth || 1, 1), 2), dedup: opts.dedup !== false, existing: opts.existing || [], filters, protect: opts.protect || "balanced", fast: !!opts.fast });
  return { ok: true, jobId: job.id };
}

async function runSimilar(job: Job, acc: any, opts: { sources: string[]; depth: number; dedup: boolean; existing: string[]; filters: ChannelFilters; protect: Protect; fast: boolean }) {
  let client: any;
  const seen = new Set<string>(opts.existing.map((s) => s)); // уже в базе — не дублируем и не тратим лимиты
  const delay = delaysFor(opts.protect, opts.fast);
  try {
    const { Api } = await import("telegram");
    client = await makeClient(acc.apiId, acc.apiHash, acc.session);
    // Метод может отсутствовать в старой версии GramJS — честно сообщаем.
    if (!(Api.channels as any).GetChannelRecommendations) {
      job.status = "error";
      job.error = "Метод «Похожие каналы» недоступен в текущей версии Telegram API (GramJS). Обновите пакет telegram или используйте поиск по ключевым словам.";
      log(job, job.error, "err"); return;
    }
    log(job, `Расширение: ${opts.sources.length} исходных, глубина ${opts.depth}${opts.depth === 2 ? " (внимание: тематика может сбиваться)" : ""}`);
    let recFails = 0;

    async function recommend(ref: string, level: number, viaTitle: string) {
      if (job._stop || level > opts.depth) return;
      let entity: any;
      try { entity = await client.getEntity(normalize(ref)); }
      catch (e: any) { log(job, `«${ref}»: ${cleanErr(e)}`, "warn"); return; }
      const srcId = String(entity.id);
      if (opts.dedup) seen.add(srcId);
      let recs: any;
      try { recs = await client.invoke(new Api.channels.GetChannelRecommendations({ channel: entity })); }
      catch (e: any) { recFails++; log(job, `«${entity.title || ref}»: рекомендации недоступны (${cleanErr(e)})`, "warn"); return; }
      const chats: any[] = recs.chats || [];
      let dupes = 0;
      const fresh: any[] = [];
      for (const ch of chats) {
        if (ch.className !== "Channel") continue;
        const id = String(ch.id);
        if (opts.dedup && seen.has(id)) { dupes++; job.skipped++; continue; }
        seen.add(id); fresh.push(ch);
      }
      log(job, `${entity.title || ref}: рекомендаций ${chats.length}, новых ${fresh.length}, дублей отфильтровано ${dupes}`);
      for (const ch of fresh) {
        if (job._stop) break;
        let row: ChannelRow;
        try { row = await enrichChannel(client, Api, ch); } catch { continue; }
        row.via = viaTitle;
        job.found++;
        if (!passChannel(job, row, opts.filters)) { job.skipped++; continue; }
        job.channels.push(row); job.saved++;
        log(job, `+ ${row.title} · ${row.subscribers} подписчиков · рейтинг ${row.rating}`, "ok");
        if (delay.user) await sleep(delay.user);
        if (level < opts.depth) await recommend(row.username || row.id, level + 1, row.title);
      }
    }

    for (let i = 0; i < opts.sources.length; i++) {
      if (job._stop) break;
      job.progress = Math.round(((i + 1) / opts.sources.length) * 100);
      await recommend(opts.sources[i], 1, opts.sources[i]);
      if (delay.chat) await sleep(delay.chat);
    }
    if (job.status !== "error" && job.status !== "stopped") {
      job.status = "done"; job.progress = 100;
      if (job.channels.length === 0 && recFails > 0) log(job, "Похожие каналы не получены. Часто помогает Premium-аккаунт (до 100 рекомендаций) или расширение через поиск по ключевым словам.", "warn");
      log(job, `Готово. Новых каналов: ${job.channels.length}`, "ok");
    }
  } catch (e: any) { job.status = "error"; job.error = cleanErr(e); log(job, cleanErr(e), "err"); }
  finally { job.updatedAt = Date.now(); try { await client?.disconnect(); } catch {} }
}

// ---- 1.6 Резолвинг номеров (ImportContacts → resolve → DeleteContacts) ----
export function startPhoneResolve(accountId: string, phones: string[]): { ok: boolean; jobId?: string; error?: string } {
  const acc = getAccount(accountId);
  if (!acc) return { ok: false, error: "Аккаунт Telegram не подключён." };
  const list = Array.from(new Set((phones || []).map((p) => String(p).replace(/[^\d+]/g, "").replace(/^\+/, "")).filter((p) => p.length >= 7)));
  if (!list.length) return { ok: false, error: "Загрузите список телефонов." };
  const job = mkJob("resolve", "resolve", `Резолвинг: ${list.length} номеров`, list.length);
  void runResolve(job, acc, list);
  return { ok: true, jobId: job.id };
}

async function runResolve(job: Job, acc: any, phones: string[]) {
  let client: any;
  try {
    const { Api } = await import("telegram");
    const bigInt = (await import("big-integer")).default;
    client = await makeClient(acc.apiId, acc.apiHash, acc.session);
    log(job, `Резолвинг ${phones.length} номеров через адресную книгу аккаунта`);
    const chunk = 50;
    for (let i = 0; i < phones.length; i += chunk) {
      if (!(await gate(job))) break;
      const batch = phones.slice(i, i + chunk);
      const contacts = batch.map((phone, k) => new Api.InputPhoneContact({ clientId: bigInt(i + k) as any, phone: "+" + phone, firstName: "c", lastName: String(i + k) }));
      let res: any;
      try { res = await client.invoke(new Api.contacts.ImportContacts({ contacts })); }
      catch (e: any) { log(job, `Партия ${i}: ${cleanErr(e)}`, "warn"); continue; }
      const users: any[] = res.users || [];
      const byId = new Map(users.map((u: any) => [String(u.id), u]));
      const imported: any[] = res.imported || [];
      const impByClient = new Map(imported.map((im: any) => [String(im.clientId), String(im.userId)]));
      batch.forEach((phone, k) => {
        const uid = impByClient.get(String(i + k));
        const u = uid ? byId.get(uid) : null;
        if (u) { job.resolved.push({ phone, user_id: String(u.id), username: u.username ? "@" + u.username : "", name: personName(u), found: true }); job.saved++; }
        else { job.resolved.push({ phone, user_id: "", username: "", name: "", found: false }); }
        job.found++;
      });
      // Чистим адресную книгу аккаунта-парсера.
      if (users.length) { try { await client.invoke(new Api.contacts.DeleteContacts({ id: users.map((u: any) => new Api.InputUser({ userId: u.id, accessHash: u.accessHash })) })); } catch {} }
      job.progress = Math.min(99, Math.round(((i + batch.length) / phones.length) * 100));
      log(job, `Обработано ${Math.min(i + chunk, phones.length)} из ${phones.length}, найдено ${job.saved}`);
      await sleep(1200);
    }
    if (job.status !== "error" && job.status !== "stopped") { job.status = "done"; job.progress = 100; log(job, `Готово. Найдено ${job.saved} из ${phones.length}`, "ok"); }
  } catch (e: any) { job.status = "error"; job.error = cleanErr(e); log(job, cleanErr(e), "err"); }
  finally { job.updatedAt = Date.now(); try { await client?.disconnect(); } catch {} }
}

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
