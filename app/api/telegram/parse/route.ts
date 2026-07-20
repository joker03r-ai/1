import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Реальный парсинг Telegram через Bot API.
//
// Важное ограничение Telegram: бот НЕ может получить список всех чатов. Он видит
// только те чаты, куда его добавили, и только новые апдейты (getUpdates отдаёт
// сообщения за ~24 часа, пока они не подтверждены; при активном вебхуке getUpdates
// недоступен). Поэтому «поиск в Telegram» = сбор чатов из входящих апдейтов:
// добавьте бота в группу/канал администратором и напишите туда — чат появится.
// Для полной истории и произвольного поиска нужен аккаунт-парсер на MTProto.

const API = "https://api.telegram.org";

type TgUpdate = any;

async function tg(token: string, method: string, params: Record<string, any> = {}) {
  let res: Response;
  try {
    res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    throw new Error("Telegram недоступен с сервера (проверьте сеть/прокси)");
  }
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Telegram недоступен с сервера (ответ не от API)");
  }
  if (!data.ok) throw new Error(data.description || `${method} failed`);
  return data.result;
}

function roleOf(status: string): "creator" | "administrator" | "member" {
  if (status === "creator") return "creator";
  if (status === "administrator") return "administrator";
  return "member";
}

function nameOf(u: any): string {
  if (!u) return "Аноним";
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Пользователь";
}

export async function POST(req: NextRequest) {
  let token = "";
  try {
    const body = (await req.json()) as { token?: string };
    token = (body?.token || "").trim();
  } catch {}
  if (!token) return NextResponse.json({ error: "Укажите токен бота" }, { status: 400 });

  // 1) Проверка токена.
  let me: any;
  try {
    me = await tg(token, "getMe");
  } catch (e: any) {
    return NextResponse.json({ error: `Токен не принят Telegram: ${e?.message || "ошибка"}` }, { status: 400 });
  }

  // 2) Сбор апдейтов.
  let updates: TgUpdate[] = [];
  try {
    updates = (await tg(token, "getUpdates", { limit: 100, timeout: 0 })) || [];
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          "Не удалось получить апдейты. Возможно, на боте включён вебхук (тогда getUpdates недоступен) или бот пока не добавлен в чаты.",
        bot: { username: me.username },
      },
      { status: 400 }
    );
  }

  // 3) Группировка апдейтов по чатам.
  const byChat: Record<string, any> = {};
  for (const u of updates) {
    const msg = u.message || u.channel_post || u.edited_message || u.edited_channel_post;
    if (!msg?.chat) continue;
    const c = msg.chat;
    const id = String(c.id);
    if (!byChat[id]) {
      byChat[id] = {
        id,
        title: c.title || nameOf(c) || c.username || "Чат",
        type: c.type === "private" ? "private" : c.type === "channel" ? "channel" : c.type === "supergroup" ? "supergroup" : "group",
        username: c.username ? "@" + c.username : undefined,
        membersCount: 0,
        participants: [],
        messages: [],
        parsedAt: Date.now(),
        _users: {},
      };
    }
    const from = msg.from;
    if (from) {
      byChat[id]._users[String(from.id)] = {
        id: String(from.id),
        name: nameOf(from),
        username: from.username ? "@" + from.username : undefined,
        tgRole: "member",
      };
    }
    byChat[id].messages.push({
      id: String(msg.message_id),
      from: msg.from ? nameOf(msg.from) : byChat[id].title,
      text: msg.text || msg.caption || "[вложение]",
      ts: (msg.date || 0) * 1000,
      out: !!(msg.from && me && msg.from.id === me.id),
    });
  }

  // 4) Обогащение: количество участников и админы (по возможности).
  const chats = [];
  for (const id of Object.keys(byChat)) {
    const ch = byChat[id];
    try {
      const cnt = await tg(token, "getChatMemberCount", { chat_id: Number(id) });
      ch.membersCount = cnt || Object.keys(ch._users).length;
    } catch {
      ch.membersCount = Object.keys(ch._users).length || 2;
    }
    try {
      if (ch.type !== "private") {
        const admins = await tg(token, "getChatAdministrators", { chat_id: Number(id) });
        for (const a of admins) {
          const uid = String(a.user.id);
          ch._users[uid] = {
            id: uid,
            name: nameOf(a.user),
            username: a.user.username ? "@" + a.user.username : undefined,
            tgRole: roleOf(a.status),
          };
        }
      }
    } catch {}
    ch.participants = Object.values(ch._users);
    delete ch._users;
    ch.messages.sort((a: any, b: any) => a.ts - b.ts);
    chats.push(ch);
  }

  return NextResponse.json({
    ok: true,
    bot: { username: me.username, name: me.first_name },
    chats,
    note:
      chats.length === 0
        ? "Бот подключён, но пока не видит чатов. Добавьте его администратором в группу/канал и напишите сообщение — чат появится при следующем парсинге."
        : undefined,
  });
}
