import { NextRequest, NextResponse } from "next/server";
import { getSecret, handleUpdate } from "@/lib/tgRuntime";

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

  await handleUpdate(botId, update);

  // Telegram требует немедленный 200, иначе будет повторять доставку.
  return NextResponse.json({ ok: true }, { status: 200 });
}

// На случай проверки доступности маршрута браузером или health-чеком.
export async function GET(_req: NextRequest, { params }: { params: { botId: string } }) {
  return NextResponse.json({ ok: true, endpoint: `webhook for ${params.botId}`, method: "Отправляйте POST от Telegram" });
}
