// Серверное ЗАШИФРОВАННОЕ хранилище Telegram-аккаунтов (MTProto-сессий).
//
// Сессия НЕ хранится в localStorage. Она шифруется (AES-256-GCM) и лежит в
// файле на сервере, поэтому после закрытия браузера подключение и фоновые
// задачи продолжают работать. Ключ шифрования — из переменной окружения
// TG_SESSION_SECRET (в проде задайте её обязательно).

import crypto from "crypto";
import fs from "fs";
import path from "path";

export type TgAccount = {
  id: string;
  apiId: string;
  username: string;
  name: string;
  createdAt: number;
  // Чувствительное (apiHash, session) хранится в зашифрованном виде.
  enc: string;
};

type Secret = { apiHash: string; session: string };

const DATA_DIR = process.env.TG_DATA_DIR || path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "tg-accounts.json");

function key(): Buffer {
  const secret = process.env.TG_SESSION_SECRET || "botpilot-dev-secret-change-me";
  return crypto.scryptSync(secret, "tg-accounts-salt", 32);
}

function encrypt(obj: Secret): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64");
}

function decrypt(enc: string): Secret {
  const raw = Buffer.from(enc, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(out) as Secret;
}

function readAll(): TgAccount[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as TgAccount[];
  } catch {
    return [];
  }
}
function writeAll(list: TgAccount[]) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(list), "utf8");
  } catch {}
}

export function saveAccount(a: { apiId: string; apiHash: string; session: string; username: string; name: string }): TgAccount {
  const list = readAll();
  const id = "acc_" + crypto.randomBytes(5).toString("hex");
  const rec: TgAccount = { id, apiId: a.apiId, username: a.username, name: a.name, createdAt: Date.now(), enc: encrypt({ apiHash: a.apiHash, session: a.session }) };
  writeAll([...list.filter((x) => x.username !== a.username || !a.username), rec]);
  return rec;
}

export function listAccounts(): { id: string; apiId: string; username: string; name: string; createdAt: number }[] {
  return readAll().map(({ enc, ...pub }) => pub);
}

export function getAccount(id: string): (TgAccount & Secret) | null {
  const rec = readAll().find((x) => x.id === id);
  if (!rec) return null;
  try {
    return { ...rec, ...decrypt(rec.enc) };
  } catch {
    return null;
  }
}

export function removeAccount(id: string) {
  writeAll(readAll().filter((x) => x.id !== id));
}

// Временное состояние входа между send-code и sign-in (в памяти процесса).
type Pending = { apiId: string; apiHash: string; phone: string; phoneCodeHash: string; session: string; at: number };
const g = globalThis as unknown as { __tgPending?: Map<string, Pending> };
const pending: Map<string, Pending> = g.__tgPending || (g.__tgPending = new Map());

export function putPending(p: Omit<Pending, "at">): string {
  const id = "auth_" + crypto.randomBytes(6).toString("hex");
  pending.set(id, { ...p, at: Date.now() });
  // чистим протухшие (>15 мин)
  for (const [k, v] of pending) if (Date.now() - v.at > 15 * 60000) pending.delete(k);
  return id;
}
export function getPending(id: string): Pending | undefined {
  return pending.get(id);
}
export function updatePending(id: string, patch: Partial<Pending>) {
  const cur = pending.get(id);
  if (cur) pending.set(id, { ...cur, ...patch });
}
export function dropPending(id: string) {
  pending.delete(id);
}
