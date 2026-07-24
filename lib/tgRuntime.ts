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

type ChatMsg = { role: "user" | "assistant"; content: string };

export type BotRuntime = {
  token?: string;
  startMessage?: string;
  updates: StoredUpdate[];
  lastUpdateAt?: number;
  errors: TgError[];
  secret?: string; // секрет для проверки заголовка X-Telegram-Bot-Api-Secret-Token
  webhookUrl?: string; // фактически установленный публичный URL
  aiBot?: any; // конфиг ИИ-ассистента (BotConfig) для ответов по теме
  histories?: Record<string, ChatMsg[]>; // история диалога по chatId
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

export function setAiBot(botId: string, aiBot: any) {
  if (aiBot) rt(botId).aiBot = aiBot;
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

async function sendTo(botId: string, token: string, chatId: number | string, text: string) {
  try {
    const res = await tgCall(token, "sendMessage", { chat_id: chatId, text });
    if (!res?.ok) pushError(botId, `Ответ не отправлен: ${res?.description || "неизвестная ошибка"}`);
  } catch (e) {
    pushError(botId, `Ответ не отправлен: ${String(e)}`);
  }
}

// ---------- Общая обработка входящего обновления ----------
// Используется и webhook-маршрутом, и поллингом. Сохраняет сообщение,
// на /start отвечает приветствием, а на обычный текст — осмысленным ответом
// ИИ-ассистента бота (по базе знаний), а не шаблонной фразой.
export async function handleUpdate(botId: string, update: any) {
  const msg = update?.message || update?.edited_message || null;
  if (!msg) return;
  const text: string = (msg?.text || msg?.caption || "").trim();
  const isStart = /^\/start\b/i.test(text);
  const chatId = msg.chat?.id;

  const from = msg.from ? (msg.from.username ? "@" + msg.from.username : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ")) : "пользователь";
  pushUpdate(botId, { at: Date.now(), from, chatId, text: text || "(без текста)", isStart });

  const token = getToken(botId);
  if (!token) {
    pushError(botId, "Получено сообщение, но токен бота не найден на сервере. Нажмите «Проверить подключение».");
    return;
  }

  const r = rt(botId);
  if (!r.histories) r.histories = {};
  const key = String(chatId);

  // /start — приветствие и сброс истории диалога.
  if (isStart) {
    r.histories[key] = [];
    await sendTo(botId, token, chatId, r.startMessage || "Здравствуйте! 👋 Бот на связи. Напишите свой вопрос.");
    return;
  }

  // Нетекстовое сообщение без подписи — короткая подсказка.
  if (!text) {
    await sendTo(botId, token, chatId, "Пришлите, пожалуйста, текстом — и я помогу.");
    return;
  }

  // Осмысленный ответ ИИ-ассистента по теме бота (с учётом истории диалога).
  try {
    const { generateReply } = await import("./ai");
    const { DEFAULT_BOT } = await import("./types");
    const bot = r.aiBot || DEFAULT_BOT;
    const override = (r.aiBot && r.aiBot._ai) || undefined;
    const hist: ChatMsg[] = [...(r.histories[key] || []), { role: "user" as const, content: text }];
    const { reply } = await generateReply(bot as any, hist as any, override);
    const next: ChatMsg[] = [...hist, { role: "assistant" as const, content: reply }];
    r.histories[key] = next.slice(-12);
    await sendTo(botId, token, chatId, reply);
  } catch (e) {
    pushError(botId, `Ошибка ответа ИИ: ${String(e)}`);
    await sendTo(botId, token, chatId, "Извините, не удалось обработать сообщение. Попробуйте переформулировать вопрос.");
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
