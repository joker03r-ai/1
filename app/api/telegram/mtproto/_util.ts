// Общие помощники для MTProto-маршрутов (парсинг публичных каналов через аккаунт).
// GramJS грузится динамически, чтобы не попадать в сборку клиента.

export function cleanErr(e: any): string {
  const m = String(e?.errorMessage || e?.message || e || "ошибка");
  if (m.includes("PHONE_NUMBER_INVALID")) return "Неверный номер телефона";
  if (m.includes("PHONE_CODE_INVALID")) return "Неверный код из Telegram";
  if (m.includes("PHONE_CODE_EXPIRED")) return "Код истёк, запросите новый";
  if (m.includes("PASSWORD_HASH_INVALID")) return "Неверный пароль двухфакторной защиты";
  if (m.includes("API_ID_INVALID")) return "Неверные api_id / api_hash";
  if (m.includes("FLOOD_WAIT")) return "Слишком много запросов, подождите немного";
  if (m.includes("USERNAME_NOT_OCCUPIED") || m.includes("No user has")) return "Канал не найден";
  return m;
}

export function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

export async function makeClient(apiId: string | number, apiHash: string, session: string) {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions");
  // Тихий логгер, чтобы GramJS не засорял консоль сервера.
  const { Logger } = await import("telegram/extensions/Logger");
  const logger = new Logger();
  (logger as any).log = () => {};
  const client = new TelegramClient(new StringSession(session || ""), Number(apiId), String(apiHash), {
    connectionRetries: 1,
    timeout: 10,
    requestRetries: 1,
    baseLogger: logger as any,
  });
  // Если Telegram недоступен, connect() может «висеть» — ограничиваем время.
  await withTimeout(
    client.connect(),
    12000,
    "Не удалось подключиться к Telegram (проверьте сеть сервера/доступ к api)"
  );
  return client;
}
