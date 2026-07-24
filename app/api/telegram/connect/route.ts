import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API = "https://api.telegram.org";
// Формат токена бота: <числовой id>:<секрет>. Точное значение не логируем.
const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

export async function POST(req: NextRequest) {
  let token = "";
  try {
    const body = (await req.json()) as { token?: string };
    token = (body?.token || "").trim();
  } catch {}

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      { ok: false, error: "Некорректный формат токена. Скопируйте его у @BotFather полностью." },
      { status: 400 }
    );
  }

  // Проверяем токен через Telegram Bot API (getMe). Токен идёт только в теле
  // серверного запроса — не попадает в URL, localStorage или логи клиента.
  let me: any;
  try {
    const res = await fetch(`${API}/bot${token}/getMe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.ok || !data.result) {
      return NextResponse.json(
        { ok: false, error: "Не удалось подключить бота. Проверьте токен и попробуйте снова." },
        { status: 400 }
      );
    }
    me = data.result;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Telegram сейчас недоступен с сервера. Попробуйте ещё раз чуть позже." },
      { status: 502 }
    );
  }

  const name = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.username || "Бот";
  const tokenMask = `${token.slice(0, 6)}••••${token.slice(-4)}`;

  // На этом месте на боевом сервере токен безопасно сохраняется в серверном
  // хранилище подключений (не возвращается клиенту целиком). Здесь возвращаем
  // только публичные данные бота и маску токена.
  return NextResponse.json({
    ok: true,
    bot: { id: me.id, name, username: me.username || "" },
    tokenMask,
  });
}
