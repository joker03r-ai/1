// Серверное runtime-хранилище Telegram-ботов.
//
// ВАЖНО про безопасность: сам токен хранится ТОЛЬКО здесь, на сервере, и
// никогда не возвращается клиенту целиком и не пишется в логи. Клиент видит
// только маску и метаданные бота.
//
// Это демо/одиночный инстанс — данные живут в памяти процесса. На боевом
// сервере это место заменяется на постоянное хранилище (БД/Redis), чтобы
// пережить перезапуск и работать в нескольких инстансах.

export type TgError = { at: number; text: string };

export type StoredUpdate = {
  at: number;
  from: string; // имя/username отправителя
  chatId: number | string;
  text: string;
  isStart: boolean;
};

export type BotRuntime = {
  token?: string;
  startMessage?: string;
  updates: StoredUpdate[];
  lastUpdateAt?: number;
  errors: TgError[];
};

// Переживаем HMR/повторные импорты через globalThis.
const g = globalThis as unknown as { __tgStore?: Map<string, BotRuntime> };
const store: Map<string, BotRuntime> = g.__tgStore || (g.__tgStore = new Map());

export function rt(botId: string): BotRuntime {
  let r = store.get(botId);
  if (!r) {
    r = { updates: [], errors: [] };
    store.set(botId, r);
  }
  return r;
}

export function setToken(botId: string, token: string, startMessage?: string) {
  const r = rt(botId);
  r.token = token;
  if (startMessage) r.startMessage = startMessage;
}

export function getToken(botId: string): string | undefined {
  return store.get(botId)?.token;
}

export function pushUpdate(botId: string, u: StoredUpdate) {
  const r = rt(botId);
  r.updates.unshift(u);
  r.updates = r.updates.slice(0, 50);
  r.lastUpdateAt = u.at;
}

export function pushError(botId: string, text: string) {
  const r = rt(botId);
  r.errors.unshift({ at: Date.now(), text });
  r.errors = r.errors.slice(0, 30);
}

// Снимок без токена — безопасно отдавать клиенту.
export function snapshot(botId: string) {
  const r = store.get(botId);
  return {
    hasToken: !!r?.token,
    updates: r?.updates || [],
    lastUpdateAt: r?.lastUpdateAt,
    errors: r?.errors || [],
  };
}

// Вызов Telegram Bot API. Токен идёт только в URL серверного запроса.
const API = "https://api.telegram.org";
export async function tgCall(token: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return (await res.json().catch(() => ({}))) as any;
}

export const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;
