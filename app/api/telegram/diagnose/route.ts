import { NextRequest, NextResponse } from "next/server";
import { tgCall, setToken, TOKEN_RE } from "@/lib/tgRuntime";

export const runtime = "nodejs";

// Полная проверка подключения Telegram-бота: getMe + getWebhookInfo.
// При наличии webhookUrl настраивает webhook (заменяет polling у стороннего
// процесса — двойное использование токена исключается).
// Токен идёт только в теле POST-запроса, не логируется и не возвращается.
export async function POST(req: NextRequest) {
  let token = "";
  let botId = "";
  let webhookUrl = "";
  try {
    const b = (await req.json()) as { token?: string; botId?: string; webhookUrl?: string };
    token = (b?.token || "").trim();
    botId = (b?.botId || "").trim();
    webhookUrl = (b?.webhookUrl || "").trim();
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
    return NextResponse.json(
      { ok: false, stage: "network", error: "Telegram недоступен с сервера. Попробуйте ещё раз чуть позже." },
      { status: 502 }
    );
  }
  if (!me?.ok || !me.result) {
    return NextResponse.json(
      { ok: false, stage: "token", tokenValid: false, error: "Токен недействителен или бот удалён. Проверьте токен у @BotFather." },
      { status: 200 }
    );
  }
  const bot = { id: me.result.id, name: [me.result.first_name, me.result.last_name].filter(Boolean).join(" ") || me.result.username, username: me.result.username || "" };

  // Токен валиден — сохраняем на сервере (не отдаём клиенту).
  if (botId) setToken(botId, token);

  // 2. Webhook: при необходимости настраиваем, затем читаем состояние.
  let info: any = {};
  try {
    if (webhookUrl) {
      const cur = await tgCall(token, "getWebhookInfo");
      if (cur?.result?.url !== webhookUrl) {
        await tgCall(token, "setWebhook", { url: webhookUrl, allowed_updates: ["message", "edited_message", "callback_query"], drop_pending_updates: false });
      }
    }
    const wh = await tgCall(token, "getWebhookInfo");
    info = wh?.result || {};
  } catch {}

  const webhookSet = !!info.url;
  const tokenMask = `${token.slice(0, 6)}••••${token.slice(-4)}`;

  return NextResponse.json({
    ok: true,
    tokenValid: true,
    bot,
    tokenMask,
    webhookSet,
    webhook: {
      url: info.url || "",
      pending: info.pending_update_count || 0,
      lastError: info.last_error_message || "",
      lastErrorDate: info.last_error_date || 0,
    },
  });
}
