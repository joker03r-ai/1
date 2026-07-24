import { NextRequest, NextResponse } from "next/server";
import { tgCall, setToken, ensureSecret, setWebhookUrl, webhookUrlFor, publicBaseUrl, snapshot, startPolling, stopPolling, isPolling, TOKEN_RE } from "@/lib/tgRuntime";

export const runtime = "nodejs";

// Полная проверка подключения Telegram-бота с авто-выбором способа приёма:
//  • если задан публичный HTTPS-адрес (WEBHOOK_BASE_URL) — ставим webhook;
//  • иначе — включаем long-polling (getUpdates), работающий без домена и SSL.
// Токен идёт только в теле POST, не логируется и не возвращается.
export async function POST(req: NextRequest) {
  let token = "";
  let botId = "";
  let startMessage = "";
  try {
    const b = (await req.json()) as { token?: string; botId?: string; startMessage?: string };
    token = (b?.token || "").trim();
    botId = (b?.botId || "").trim();
    startMessage = (b?.startMessage || "").trim();
  } catch {}

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, stage: "format", tokenValid: false, error: "Некорректный формат токена. Скопируйте его у @BotFather полностью." }, { status: 400 });
  }

  // 1. Токен: getMe
  let me: any;
  try {
    me = await tgCall(token, "getMe");
  } catch {
    return NextResponse.json({ ok: false, stage: "network", error: "Telegram недоступен с сервера. Проверьте исходящий доступ к api.telegram.org." }, { status: 502 });
  }
  if (!me?.ok || !me.result) {
    return NextResponse.json({ ok: false, stage: "token", tokenValid: false, error: "Токен недействителен или бот удалён. Проверьте токен у @BotFather." }, { status: 200 });
  }
  const bot = { id: me.result.id, name: [me.result.first_name, me.result.last_name].filter(Boolean).join(" ") || me.result.username, username: me.result.username || "" };
  if (botId) setToken(botId, token, startMessage || undefined);
  const tokenMask = `${token.slice(0, 6)}••••${token.slice(-4)}`;

  const base = publicBaseUrl();
  const httpsConfigured = !!base && /^https:\/\//i.test(base);

  // Режим приёма: webhook (если есть HTTPS-домен) или polling (иначе).
  if (httpsConfigured) {
    // ---- Webhook ----
    if (botId) stopPolling(botId);
    const wantUrl = botId ? webhookUrlFor(botId) : "";
    const secret = botId ? ensureSecret(botId) : "";
    try {
      const set = await tgCall(token, "setWebhook", { url: wantUrl, secret_token: secret, allowed_updates: ["message", "edited_message", "callback_query"], drop_pending_updates: false, max_connections: 40 });
      if (!set?.ok) {
        return NextResponse.json({ ok: true, mode: "webhook", tokenValid: true, bot, tokenMask, receiving: false, webhookSet: false, inbound: false, error: `Не удалось установить webhook: ${set?.description || "ошибка"}`, webhook: { url: "", pending: 0, lastError: set?.description || "", lastErrorDate: 0 } }, { status: 200 });
      }
      if (botId) setWebhookUrl(botId, wantUrl);
    } catch {
      return NextResponse.json({ ok: false, stage: "network", error: "Не удалось вызвать setWebhook. Telegram недоступен." }, { status: 502 });
    }
    let info: any = {};
    try { info = (await tgCall(token, "getWebhookInfo"))?.result || {}; } catch {}
    const urlMatches = info.url === wantUrl;
    const lastError = info.last_error_message || "";
    const webhookSet = urlMatches && !lastError;
    const snap = botId ? snapshot(botId) : { lastUpdateAt: undefined };
    return NextResponse.json({
      ok: true, mode: "webhook", tokenValid: true, bot, tokenMask,
      receiving: webhookSet, webhookSet, inbound: !!snap.lastUpdateAt, lastUpdateAt: snap.lastUpdateAt || 0,
      webhook: { url: info.url || "", expectedUrl: wantUrl, pending: info.pending_update_count || 0, lastError, lastErrorDate: info.last_error_date || 0, hasSecret: !!secret },
    }, { status: 200 });
  }

  // ---- Polling (без домена/SSL) ----
  const started = botId ? await startPolling(botId) : false;
  // Проверяем доступ к getUpdates (что webhook снят и опрос идёт).
  let info: any = {};
  try { info = (await tgCall(token, "getWebhookInfo"))?.result || {}; } catch {}
  const lastError = info.last_error_message || "";
  const snap = botId ? snapshot(botId) : { lastUpdateAt: undefined };
  return NextResponse.json({
    ok: true, mode: "polling", tokenValid: true, bot, tokenMask,
    receiving: started && isPolling(botId), webhookSet: started && isPolling(botId),
    inbound: !!snap.lastUpdateAt, lastUpdateAt: snap.lastUpdateAt || 0,
    note: "Публичный HTTPS-адрес не задан — включён приём через опрос Telegram (polling). Бот работает без домена и SSL.",
    webhook: { url: "(polling)", pending: info.pending_update_count || 0, lastError, lastErrorDate: info.last_error_date || 0, hasSecret: false },
  }, { status: 200 });
}
