import { NextRequest, NextResponse } from "next/server";
import { rt, getToken, pushUpdate, pushError, tgCall } from "@/lib/tgRuntime";

export const runtime = "nodejs";

// Приём входящих обновлений Telegram (webhook). Telegram шлёт сюда POST на
// URL вида /api/telegram/webhook/<botId>. Мы сохраняем сообщение и НЕ молчим
// на /start — сразу отвечаем приветствием.
export async function POST(req: NextRequest, { params }: { params: { botId: string } }) {
  const botId = params.botId;
  let update: any = {};
  try {
    update = await req.json();
  } catch {}

  const msg = update.message || update.edited_message || null;
  const text: string = (msg?.text || msg?.caption || "").trim();
  const isStart = /^\/start\b/i.test(text);

  if (msg) {
    const from = msg.from ? (msg.from.username ? "@" + msg.from.username : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ")) : "пользователь";
    pushUpdate(botId, { at: Date.now(), from, chatId: msg.chat?.id, text: text || "(без текста)", isStart });
  }

  // Ответ на /start — приветствие из сценария (или базовое).
  const token = getToken(botId);
  if (token && msg && isStart) {
    const welcome = rt(botId).startMessage || "Здравствуйте! 👋 Бот на связи. Напишите свой вопрос.";
    try {
      const res = await tgCall(token, "sendMessage", { chat_id: msg.chat.id, text: welcome });
      if (!res?.ok) pushError(botId, `Ответ на /start не отправлен: ${res?.description || "неизвестная ошибка"}`);
    } catch (e) {
      pushError(botId, `Ответ на /start не отправлен: ${String(e)}`);
    }
  } else if (msg && isStart && !token) {
    pushError(botId, "Получена команда /start, но токен бота не найден на сервере. Нажмите «Проверить подключение».");
  }

  // Telegram требует ответ 200, иначе будет повторять доставку.
  return NextResponse.json({ ok: true });
}
