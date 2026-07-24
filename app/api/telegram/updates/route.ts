import { NextRequest, NextResponse } from "next/server";
import { snapshot } from "@/lib/tgRuntime";

export const runtime = "nodejs";

// Отдаёт кабинету последние полученные сообщения, дату последнего сообщения
// и журнал ошибок. Токен не возвращается.
export async function GET(req: NextRequest) {
  const botId = req.nextUrl.searchParams.get("botId") || "";
  if (!botId) return NextResponse.json({ ok: false, error: "botId обязателен" }, { status: 400 });
  return NextResponse.json({ ok: true, ...snapshot(botId) });
}
