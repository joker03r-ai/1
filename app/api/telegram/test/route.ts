import { NextRequest, NextResponse } from "next/server";
import { tgCall, getToken, pushError, TOKEN_RE } from "@/lib/tgRuntime";

export const runtime = "nodejs";

// Отправка тестового сообщения. Токен берём из серверного хранилища по botId
// (если ранее подключали) либо из тела запроса. chatId — числовой id чата
// пользователя (узнать можно у @userinfobot).
export async function POST(req: NextRequest) {
  let token = "";
  let botId = "";
  let chatId = "";
  let text = "";
  try {
    const b = (await req.json()) as { token?: string; botId?: string; chatId?: string; text?: string };
    token = (b?.token || "").trim();
    botId = (b?.botId || "").trim();
    chatId = (b?.chatId || "").trim();
    text = (b?.text || "").trim() || "✅ Тестовое сообщение от вашего бота. Подключение работает!";
  } catch {}

  if (!token && botId) token = getToken(botId) || "";
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: "Сначала подключите бота (нет действительного токена)." }, { status: 400 });
  }
  if (!/^-?\d{3,}$/.test(chatId)) {
    return NextResponse.json({ ok: false, error: "Укажите числовой Chat ID. Узнать можно, написав боту @userinfobot." }, { status: 400 });
  }

  try {
    const res = await tgCall(token, "sendMessage", { chat_id: chatId, text });
    if (!res?.ok) {
      const err = res?.description || "Не удалось отправить сообщение.";
      if (botId) pushError(botId, `Тестовое сообщение: ${err}`);
      return NextResponse.json({ ok: false, error: err }, { status: 200 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    if (botId) pushError(botId, "Тестовое сообщение: Telegram недоступен с сервера.");
    return NextResponse.json({ ok: false, error: "Telegram недоступен с сервера. Попробуйте позже." }, { status: 502 });
  }
}
