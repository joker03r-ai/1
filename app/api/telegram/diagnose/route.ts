import { NextRequest, NextResponse } from "next/server";
import { tgCall, setToken, ensureSecret, setWebhookUrl, webhookUrlFor, publicBaseUrl, snapshot, TOKEN_RE } from "@/lib/tgRuntime";

export const runtime = "nodejs";

// Полная проверка подключения Telegram-бота.
// ВАЖНО: публичный адрес webhook строится из серверной переменной
// WEBHOOK_BASE_URL (https://api.домен.ru), а НЕ из origin браузера —
// иначе получается недопустимый http://IP:3000, и Telegram его отклоняет.
export async function POST(req: NextRequest) {
  let token = "";
  let botId = "";
  try {
    const b = (await req.json()) as { token?: string; botId?: string };
    token = (b?.token || "").trim();
    botId = (b?.botId || "").trim();
  } catch {}

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      { ok: false, stage: "format", tokenValid: false, error: "Некорректный формат токена. Скопируйте его у @BotFather полностью." },
      { status: 400 }
    );
  }

  // 1. Токен: getMe
  let me: any;
  try {
    me = await tgCall(token, "getMe");
  } catch {
    return NextResponse.json({ ok: false, stage: "network", error: "Telegram недоступен с сервера. Попробуйте ещё раз чуть позже." }, { status: 502 });
  }
  if (!me?.ok || !me.result) {
    return NextResponse.json({ ok: false, stage: "token", tokenValid: false, error: "Токен недействителен или бот удалён. Проверьте токен у @BotFather." }, { status: 200 });
  }
  const bot = { id: me.result.id, name: [me.result.first_name, me.result.last_name].filter(Boolean).join(" ") || me.result.username, username: me.result.username || "" };
  if (botId) setToken(botId, token);
  const tokenMask = `${token.slice(0, 6)}••••${token.slice(-4)}`;

  // 2. Публичный HTTPS-адрес. Без него webhook принципиально не установить.
  const base = publicBaseUrl();
  const wantUrl = botId ? webhookUrlFor(botId) : "";
  if (!base || !/^https:\/\//i.test(base)) {
    return NextResponse.json({
      ok: true, tokenValid: true, bot, tokenMask,
      webhookSet: false, inbound: false,
      configError: "Публичный HTTPS-адрес не настроен. Задайте переменную окружения WEBHOOK_BASE_URL=https://api.домен.ru и проксируйте 443 → localhost:3000 (Nginx/Caddy). Пока адрес вида http://IP:3000 — Telegram его отклоняет.",
      webhook: { url: "", pending: 0, lastError: "", lastErrorDate: 0 },
    }, { status: 200 });
  }

  // 3. setWebhook с секретом (secret_token).
  const secret = botId ? ensureSecret(botId) : "";
  try {
    const set = await tgCall(token, "setWebhook", {
      url: wantUrl,
      secret_token: secret,
      allowed_updates: ["message", "edited_message", "callback_query"],
      drop_pending_updates: false,
      max_connections: 40,
    });
    if (!set?.ok) {
      return NextResponse.json({
        ok: true, tokenValid: true, bot, tokenMask, webhookSet: false, inbound: false,
        error: `Не удалось установить webhook: ${set?.description || "неизвестная ошибка"}`,
        webhook: { url: "", pending: 0, lastError: set?.description || "", lastErrorDate: 0 },
      }, { status: 200 });
    }
    if (botId) setWebhookUrl(botId, wantUrl);
  } catch {
    return NextResponse.json({ ok: false, stage: "network", error: "Не удалось вызвать setWebhook. Telegram недоступен." }, { status: 502 });
  }

  // 4. getWebhookInfo — проверяем, что URL совпал и ошибок нет.
  let info: any = {};
  try {
    const wh = await tgCall(token, "getWebhookInfo");
    info = wh?.result || {};
  } catch {}

  const urlMatches = info.url === wantUrl;
  const lastError = info.last_error_message || "";
  const webhookSet = urlMatches && !lastError;
  const snap = botId ? snapshot(botId) : { lastUpdateAt: undefined };

  return NextResponse.json({
    ok: true,
    tokenValid: true,
    bot,
    tokenMask,
    webhookSet,
    inbound: !!snap.lastUpdateAt, // фактически ли пришло входящее сообщение
    lastUpdateAt: snap.lastUpdateAt || 0,
    webhook: {
      url: info.url || "",
      expectedUrl: wantUrl,
      pending: info.pending_update_count || 0,
      lastError,
      lastErrorDate: info.last_error_date || 0,
      hasSecret: !!secret,
    },
  }, { status: 200 });
}
