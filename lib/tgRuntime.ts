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
  secret?: string; // секрет для проверки заголовка X-Telegram-Bot-Api-Secret-Token
  webhookUrl?: string; // фактически установленный публичный URL
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

// Секрет webhook: генерируем один раз на бота и передаём в setWebhook как
// secret_token. Telegram возвращает его в заголовке каждого запроса.
export function ensureSecret(botId: string): string {
  const r = rt(botId);
  if (!r.secret) r.secret = "whk_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return r.secret;
}
export function getSecret(botId: string): string | undefined {
  return store.get(botId)?.secret;
}
export function setWebhookUrl(botId: string, url: string) {
  rt(botId).webhookUrl = url;
}

// Публичный HTTPS-адрес приложения (за Nginx/Caddy). Именно отсюда строится
// webhook, а НЕ из origin браузера (иначе получится http://IP:3000).
export function publicBaseUrl(): string {
  const raw = (process.env.WEBHOOK_BASE_URL || process.env.PUBLIC_BASE_URL || "").trim();
  return raw.replace(/\/+$/, "");
}
export function webhookUrlFor(botId: string): string {
  const base = publicBaseUrl();
  return base ? `${base}/api/telegram/webhook/${botId}` : "";
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
    webhookUrl: r?.webhookUrl || "",
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

// ---------- Общая обработка входящего обновления ----------
// Используется и webhook-маршрутом, и поллингом. Сохраняет сообщение и
// отвечает на /start и обычный текст из приветствия сценария.
export async function handleUpdate(botId: string, update: any) {
  const msg = update?.message || update?.edited_message || null;
  const text: string = (msg?.text || msg?.caption || "").trim();
  const isStart = /^\/start\b/i.test(text);

  if (msg) {
    const from = msg.from ? (msg.from.username ? "@" + msg.from.username : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ")) : "пользователь";
    pushUpdate(botId, { at: Date.now(), from, chatId: msg.chat?.id, text: text || "(без текста)", isStart });
  }

  const token = getToken(botId);
  if (token && msg) {
    const r = rt(botId);
    const reply = isStart
      ? (r.startMessage || "Здравствуйте! 👋 Бот на связи. Напишите свой вопрос.")
      : (r.startMessage ? "Спасибо за сообщение! Мы уже обрабатываем ваш запрос." : "");
    if (reply) {
      try {
        const res = await tgCall(token, "sendMessage", { chat_id: msg.chat.id, text: reply });
        if (!res?.ok) pushError(botId, `Ответ не отправлен: ${res?.description || "неизвестная ошибка"}`);
      } catch (e) {
        pushError(botId, `Ответ не отправлен: ${String(e)}`);
      }
    }
  } else if (msg && !token) {
    pushError(botId, "Получено сообщение, но токен бота не найден на сервере. Нажмите «Проверить подключение».");
  }
}

// ---------- Long-polling (работает БЕЗ домена, SSL и webhook) ----------
// Требует только исходящего доступа к api.telegram.org. Идеально, когда
// публичный HTTPS-адрес не настроен.
type Poller = { stop: boolean; offset: number };
const g2 = globalThis as unknown as { __tgPollers?: Map<string, Poller> };
const pollers: Map<string, Poller> = g2.__tgPollers || (g2.__tgPollers = new Map());

export function isPolling(botId: string): boolean {
  return pollers.has(botId);
}

export async function startPolling(botId: string): Promise<boolean> {
  const token = getToken(botId);
  if (!token) return false;
  if (pollers.has(botId)) return true;
  const state: Poller = { stop: false, offset: 0 };
  pollers.set(botId, state);
  // Поллинг и webhook взаимоисключающи — снимаем webhook.
  try { await tgCall(token, "deleteWebhook", { drop_pending_updates: false }); } catch {}
  rt(botId).webhookUrl = "";
  void pollLoop(botId, state);
  return true;
}

export function stopPolling(botId: string) {
  const s = pollers.get(botId);
  if (s) s.stop = true;
  pollers.delete(botId);
}

async function pollLoop(botId: string, state: Poller) {
  while (!state.stop) {
    const token = getToken(botId);
    if (!token) break;
    try {
      const res = await tgCall(token, "getUpdates", { offset: state.offset, timeout: 25, allowed_updates: ["message", "edited_message", "callback_query"] });
      if (res?.ok && Array.isArray(res.result)) {
        for (const u of res.result) {
          state.offset = (u.update_id || 0) + 1;
          await handleUpdate(botId, u);
        }
      } else if (res && !res.ok) {
        pushError(botId, `getUpdates: ${res.description || "ошибка"}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (e) {
      pushError(botId, `Опрос Telegram прерван: ${String(e)}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  pollers.delete(botId);
}
