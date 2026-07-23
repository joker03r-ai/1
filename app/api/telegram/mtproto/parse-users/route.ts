import { NextRequest, NextResponse } from "next/server";
import { makeClient, cleanErr } from "../_util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Парсер пользователей: собирает участников из открытых Telegram-чатов/групп
// с фильтрами (боты, удалённые, только с юзернеймом/фото/Premium).
//
// Работает только для чатов, где список участников открыт (не скрыт админом).
// Аккаунт (MTProto) должен быть в чате или иметь к нему доступ.

function normalize(raw: string): string {
  let s = String(raw || "").trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^t\.me\//i, "").replace(/^telegram\.me\//i, "");
  return s.replace(/^@/, "").replace(/\/+$/, "");
}

function name(u: any): string {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "Без имени";
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const apiId = String(b.apiId || "").trim();
  const apiHash = String(b.apiHash || "").trim();
  const session = String(b.session || "");
  const chats: string[] = Array.isArray(b.chats) ? b.chats : [];
  const limit = Math.min(Math.max(Number(b.limit) || 1000, 1), 100000);
  const f = b.filters || {};

  if (!apiId || !apiHash || !session) {
    return NextResponse.json({ error: "Сначала войдите в аккаунт Telegram" }, { status: 400 });
  }
  const refs = chats.map(normalize).filter(Boolean).slice(0, 20);
  if (!refs.length) return NextResponse.json({ error: "Укажите хотя бы один чат" }, { status: 400 });

  let client: any;
  try {
    client = await makeClient(apiId, apiHash, session);
  } catch (e: any) {
    return NextResponse.json({ error: cleanErr(e) }, { status: 400 });
  }

  const seen = new Set<string>();
  const users: any[] = [];
  const errors: { ref: string; error: string }[] = [];

  for (const ref of refs) {
    try {
      const entity: any = await client.getEntity(ref);
      const parts: any[] = await client.getParticipants(entity, { limit });
      for (const u of parts) {
        if (seen.has(String(u.id))) continue;
        // Фильтры.
        if (f.skipBots && u.bot) continue;
        if (f.skipDeleted && u.deleted) continue;
        if (f.onlyUsername && !u.username) continue;
        if (f.onlyPhoto && !u.photo) continue;
        if (f.onlyPremium && !u.premium) continue;
        seen.add(String(u.id));
        users.push({
          id: String(u.id),
          name: name(u),
          username: u.username ? "@" + u.username : "",
          premium: !!u.premium,
          hasPhoto: !!u.photo,
          bot: !!u.bot,
        });
        if (users.length >= limit) break;
      }
    } catch (e: any) {
      errors.push({ ref, error: cleanErr(e) });
    }
    if (users.length >= limit) break;
  }

  try {
    await client.disconnect();
  } catch {}

  return NextResponse.json({
    ok: true,
    users,
    count: users.length,
    errors,
    note:
      users.length === 0
        ? "Пользователей не найдено. Возможно, список участников скрыт админом чата, или сработали фильтры."
        : errors.length
        ? `Собрано пользователей: ${users.length}. Часть чатов недоступна: ${errors.map((e) => e.ref).join(", ")}.`
        : `Собрано пользователей: ${users.length}.`,
  });
}
