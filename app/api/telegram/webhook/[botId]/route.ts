import { NextRequest, NextResponse } from "next/server";
import { rt, getToken, getSecret, pushUpdate, pushError, tgCall } from "@/lib/tgRuntime";

export const runtime = "nodejs";
// Без авторизации приложения, без CSRF и без редиректов — Telegram шлёт
// POST напрямую. Единственная проверка — секретный заголовок Telegram.
export const dynamic = "force-dynamic";

// Приём входящих обновлений Telegram (webhook). URL:
// https://api.домен.ru/api/telegram/webhook/<botId>
export async function POST(req: NextRequest, { params }: { params: { botId: string } }) {
  const botId = params.botId;

  // Проверка секрета Telegram (secret_token). Если секрет задан, а заголовок
  // не совпадает — это не Telegram, отклоняем. Легитимные запросы проходят.
  const secret = getSecret(botId);
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

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

  // Передаём сообщение в опубликованный сценарий: на /start отвечаем
  // приветствием, на обычный текст — базовым ответом сценария.
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

  // Telegram требует немедленный 200, иначе будет повторять доставку.
  return NextResponse.json({ ok: true }, { status: 200 });
}

// На случай проверки доступности маршрута браузером или health-чеком.
export async function GET(_req: NextRequest, { params }: { params: { botId: string } }) {
  return NextResponse.json({ ok: true, endpoint: `webhook for ${params.botId}`, method: "Отправляйте POST от Telegram" });
}
