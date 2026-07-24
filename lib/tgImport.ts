// Импорт Telegram-аккаунтов в парсер: строковая сессия, JSON, файл .session
// (Telethon SQLite) и TData/ZIP-бандлы. Сессия приводится к формату GramJS
// StringSession (совместим с Telethon) и проверяется реальным подключением.

import { saveAccount } from "./tgAccounts";

// Стандартные адреса дата-центров Telegram (на случай, если в источнике нет server_address).
const DC_IP: Record<number, string> = {
  1: "149.154.175.53", 2: "149.154.167.51", 3: "149.154.175.100", 4: "149.154.167.91", 5: "149.154.171.5",
};

function cleanErr(e: any): string {
  const m = String(e?.errorMessage || e?.message || e || "ошибка");
  if (m.includes("AUTH_KEY") || m.includes("Not a valid string")) return "Сессия недействительна или устарела.";
  if (m.includes("api_id") || m.includes("API_ID")) return "Неверные api_id / api_hash.";
  return m;
}

// ---- StringSession helpers ----
async function buildSessionFromKey(dcId: number, authKey: Buffer, server?: string, port?: number): Promise<string> {
  if (!authKey || authKey.length !== 256) throw new Error("auth_key должен быть 256 байт.");
  const { StringSession } = await import("telegram/sessions");
  const { AuthKey } = await import("telegram/crypto/AuthKey");
  const s = new StringSession("");
  s.setDC(dcId || 2, server || DC_IP[dcId] || DC_IP[2], port || 443);
  const ak = new AuthKey();
  await ak.setKey(authKey);
  (s as any).authKey = ak;
  const out = s.save();
  if (!out) throw new Error("Не удалось собрать строковую сессию из auth_key.");
  return out;
}

function parseKeyBytes(v: string): Buffer {
  const s = String(v).trim().replace(/^0x/i, "");
  if (/^[0-9a-f]{512}$/i.test(s)) return Buffer.from(s, "hex");
  try { const b = Buffer.from(s, "base64"); if (b.length === 256) return b; } catch {}
  throw new Error("Не удалось распознать auth_key (нужен hex 512 симв. или base64 256 байт).");
}

// JSON-бандл: session-строка ИЛИ auth_key + dc_id (+ app_id/app_hash).
export async function sessionFromJson(obj: any): Promise<{ session: string; apiId?: string; apiHash?: string; phone?: string }> {
  const g = (...k: string[]): any => { for (const key of k) if (obj?.[key] != null && obj[key] !== "") return obj[key]; return undefined; };
  const apiId = g("api_id", "app_id", "apiId", "appId");
  const apiHash = g("api_hash", "app_hash", "apiHash", "appHash");
  const phone = g("phone", "phone_number", "number");
  const sessStr = g("session", "session_string", "stringSession", "string_session", "tg_session", "session_str");
  if (typeof sessStr === "string" && sessStr[0] === "1" && sessStr.length > 40) {
    return { session: sessStr, apiId: apiId && String(apiId), apiHash: apiHash && String(apiHash), phone: phone && String(phone) };
  }
  const authKeyRaw = g("auth_key", "authKey", "auth_key_hex");
  const dcId = Number(g("dc_id", "dcId", "dc")) || 2;
  const server = g("server_address", "serverAddress", "ip");
  const port = Number(g("port")) || 443;
  if (authKeyRaw) {
    const session = await buildSessionFromKey(dcId, parseKeyBytes(String(authKeyRaw)), server && String(server), port);
    return { session, apiId: apiId && String(apiId), apiHash: apiHash && String(apiHash), phone: phone && String(phone) };
  }
  throw new Error("В JSON нет ни session-строки, ни auth_key + dc_id.");
}

/* ---- Минимальный ридер Telethon .session (SQLite), без внешних зависимостей ---- */
function readVarint(buf: Buffer, off: number): [number, number] {
  let result = 0, i = 0;
  for (; i < 9; i++) {
    const byte = buf[off + i];
    if (i === 8) { result = result * 256 + byte; return [result, 9]; }
    result = result * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return [result, i + 1];
  }
  return [result, i];
}
// Парсинг одной записи (record) table-leaf: возвращает массив значений.
function parseRecord(buf: Buffer, payloadStart: number): any[] {
  let p = payloadStart;
  const [headerLen, hb] = readVarint(buf, p);
  const headerEnd = p + headerLen;
  p += hb;
  const serials: number[] = [];
  while (p < headerEnd) { const [st, sb] = readVarint(buf, p); serials.push(st); p += sb; }
  let body = headerEnd;
  const vals: any[] = [];
  for (const st of serials) {
    if (st === 0) { vals.push(null); }
    else if (st >= 1 && st <= 6) { const len = [0, 1, 2, 3, 4, 6, 8][st]; let n = 0; for (let k = 0; k < len; k++) n = n * 256 + buf[body + k]; vals.push(n); body += len; }
    else if (st === 7) { vals.push(buf.readDoubleBE(body)); body += 8; }
    else if (st === 8) { vals.push(0); }
    else if (st === 9) { vals.push(1); }
    else if (st >= 12 && st % 2 === 0) { const len = (st - 12) / 2; vals.push(buf.subarray(body, body + len)); body += len; }
    else if (st >= 13) { const len = (st - 13) / 2; vals.push(buf.subarray(body, body + len).toString("utf8")); body += len; }
    else vals.push(null);
  }
  return vals;
}
// Ячейки table-leaf страницы (тип 0x0D). Возвращает записи (record values).
function leafRecords(buf: Buffer, pageStart: number, headerOffset: number): any[][] {
  const type = buf[pageStart + headerOffset];
  if (type !== 0x0d) return []; // поддерживаем листовые table-страницы (для мелких session-БД достаточно)
  const cellCount = buf.readUInt16BE(pageStart + headerOffset + 3);
  const ptrArray = pageStart + headerOffset + 8;
  const out: any[][] = [];
  for (let i = 0; i < cellCount; i++) {
    const cellOff = buf.readUInt16BE(ptrArray + i * 2);
    let p = pageStart + cellOff;
    const [, pb] = readVarint(buf, p); p += pb; // payload length
    const [, rb] = readVarint(buf, p); p += rb; // rowid
    out.push(parseRecord(buf, p));
  }
  return out;
}
export async function sessionFromSqlite(buf: Buffer): Promise<{ session: string }> {
  if (buf.subarray(0, 15).toString("latin1") !== "SQLite format 3") throw new Error("Файл не является SQLite .session (Telethon).");
  let pageSize = buf.readUInt16BE(16); if (pageSize === 1) pageSize = 65536;
  // sqlite_master на первой странице (заголовок БД — первые 100 байт).
  const master = leafRecords(buf, 0, 100);
  let rootpage = 0;
  for (const row of master) { if (row[1] === "sessions" || row[2] === "sessions") { rootpage = Number(row[3]); break; } }
  if (!rootpage) throw new Error("В .session не найдена таблица sessions.");
  const pageStart = (rootpage - 1) * pageSize;
  const rows = leafRecords(buf, pageStart, 0);
  if (!rows.length) throw new Error("Таблица sessions пуста.");
  const r = rows[0]; // [dc_id, server_address, port, auth_key, takeout_id]
  const dcId = Number(r[0]) || 2;
  const server = typeof r[1] === "string" ? r[1] : undefined;
  const port = Number(r[2]) || 443;
  const authKey = Buffer.isBuffer(r[3]) ? r[3] : Buffer.from([]);
  const session = await buildSessionFromKey(dcId, authKey, server, port);
  return { session };
}

/* ---- Минимальный ридер ZIP (stored + deflate через встроенный zlib) ---- */
export function unzip(buf: Buffer): { name: string; data: Buffer }[] {
  const zlib = require("zlib");
  // Ищем End of Central Directory.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error("Некорректный ZIP-архив.");
  const count = buf.readUInt16LE(eocd + 10);
  let cd = buf.readUInt32LE(eocd + 16);
  const out: { name: string; data: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(cd) !== 0x02014b50) break;
    const method = buf.readUInt16LE(cd + 10);
    const compSize = buf.readUInt32LE(cd + 20);
    const nameLen = buf.readUInt16LE(cd + 28);
    const extraLen = buf.readUInt16LE(cd + 30);
    const commentLen = buf.readUInt16LE(cd + 32);
    const localOff = buf.readUInt32LE(cd + 42);
    const name = buf.subarray(cd + 46, cd + 46 + nameLen).toString("utf8");
    // Локальный заголовок.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    try {
      const data = method === 0 ? raw : zlib.inflateRawSync(raw);
      if (!name.endsWith("/")) out.push({ name, data });
    } catch {}
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// Разбор TData/ZIP-бандла: ищем внутри .json или .session (частый формат «session+json»).
export async function sessionFromBundle(buf: Buffer): Promise<{ session: string; apiId?: string; apiHash?: string; phone?: string }> {
  const files = unzip(buf);
  const json = files.find((f) => /\.json$/i.test(f.name));
  if (json) { try { return await sessionFromJson(JSON.parse(json.data.toString("utf8"))); } catch (e) { /* попробуем .session */ } }
  const sess = files.find((f) => /\.session$/i.test(f.name));
  if (sess) {
    if (sess.data.subarray(0, 15).toString("latin1") === "SQLite format 3") return await sessionFromSqlite(sess.data);
    const txt = sess.data.toString("utf8").trim();
    if (txt[0] === "1") return { session: txt };
  }
  // Похоже на настоящую TData Telegram Desktop.
  if (files.some((f) => /key_datas?$|^tdata\//i.test(f.name) || /D877F783D5D3EF8C/i.test(f.name))) {
    throw new Error("Это папка TData от Telegram Desktop. Сконвертируйте её в .session или JSON (например, через opentele) и загрузите сюда.");
  }
  throw new Error("В архиве не найдены .session или .json с данными аккаунта.");
}

// Единая точка импорта: приводим к сессии, проверяем подключением, сохраняем.
export async function importAccount(input: { format: string; apiId?: string; apiHash?: string; text?: string; base64?: string }): Promise<{ ok: boolean; accountId?: string; error?: string }> {
  try {
    let session = "";
    let apiId = String(input.apiId || "").trim();
    let apiHash = String(input.apiHash || "").trim();
    const fileBuf = input.base64 ? Buffer.from(input.base64, "base64") : null;

    if (input.format === "string") {
      session = String(input.text || "").trim();
      if (session[0] !== "1") throw new Error("Строковая сессия должна начинаться с «1» (формат GramJS/Telethon).");
    } else if (input.format === "json") {
      const obj = JSON.parse(String(input.text || fileBuf?.toString("utf8") || "{}"));
      const r = await sessionFromJson(obj); session = r.session;
      apiId = apiId || r.apiId || ""; apiHash = apiHash || r.apiHash || "";
    } else if (input.format === "session") {
      if (!fileBuf) throw new Error("Загрузите файл .session.");
      if (fileBuf.subarray(0, 15).toString("latin1") === "SQLite format 3") { session = (await sessionFromSqlite(fileBuf)).session; }
      else { const t = fileBuf.toString("utf8").trim(); if (t[0] !== "1") throw new Error("Файл не похож на .session (ни SQLite, ни строковая сессия)."); session = t; }
    } else if (input.format === "tdata") {
      if (!fileBuf) throw new Error("Загрузите ZIP-архив (TData / session+json).");
      const r = await sessionFromBundle(fileBuf); session = r.session;
      apiId = apiId || r.apiId || ""; apiHash = apiHash || r.apiHash || "";
    } else throw new Error("Неизвестный формат импорта.");

    if (!apiId || !apiHash) return { ok: false, error: "Укажите api_id и api_hash (в форме или внутри JSON)." };

    // Проверяем сессию реальным подключением.
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions");
    const client = new TelegramClient(new StringSession(session), Number(apiId), String(apiHash), { connectionRetries: 2, timeout: 15 });
    await client.connect();
    const me: any = await client.getMe();
    if (!me) { try { await client.disconnect(); } catch {} throw new Error("Сессия не авторизована."); }
    const username = me.username ? String(me.username) : "";
    const name = [me.firstName, me.lastName].filter(Boolean).join(" ") || username || String(me.id);
    const savedSession = (client.session as any).save();
    try { await client.disconnect(); } catch {}
    const acc = saveAccount({ apiId, apiHash, session: savedSession, username, name });
    return { ok: true, accountId: acc.id };
  } catch (e: any) {
    return { ok: false, error: cleanErr(e) };
  }
}
