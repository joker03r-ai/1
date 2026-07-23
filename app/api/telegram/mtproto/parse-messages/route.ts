import { NextRequest, NextResponse } from "next/server";
import { makeClient, cleanErr } from "../_util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Парсер пользователей ПО СООБЩЕНИЯМ — собирает авторов сообщений из чата.
// Работает даже когда список участников скрыт, но сообщения открыты.

function normalize(raw: string): string {
  let s = String(raw || "").trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^t\.me\//i, "").replace(/^telegram\.me\//i, "");
  return s.replace(/^@/, "").replace(/\/+$/, "");
}
function personName(u: any): string {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "Без имени";
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const apiId = String(b.apiId || "").trim();
  const apiHash = String(b.apiHash || "").trim();
  const session = String(b.session || "");
  const chats: string[] = Array.isArray(b.chats) ? b.chats : [];
  const msgLimit = Math.min(Math.max(Number(b.msgLimit) || 1000, 1), 100000);
  const days = Math.max(Number(b.days) || 0, 0); // 0 = за всё время
  const keywords: string[] = (Array.isArray(b.keywords) ? b.keywords : []).map((k: string) => String(k).toLowerCase().trim()).filter(Boolean);
  const f = b.filters || {};

  if (!apiId || !apiHash || !session) {
    return NextResponse.json({ error: "Сначала войдите в аккаунт Telegram" }, { status: 400 });
  }
  const refs = chats.map(normalize).filter(Boolean).slice(0, 20);
  if (!refs.length) return NextResponse.json({ error: "Укажите хотя бы один чат" }, { status: 400 });

  const minTs = days > 0 ? Date.now() - days * 86400000 : 0;

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
      const msgs: any[] = await client.getMessages(entity, { limit: msgLimit });
      for (const m of msgs) {
        if (minTs && (m.date || 0) * 1000 < minTs) continue;
        if (!f.includeReplies && m.replyTo) continue;
        if (!f.includeForwarded && m.fwdFrom) continue;
        const text = (m.message || "").toLowerCase();
        if (keywords.length && !keywords.some((k) => text.includes(k))) continue;
        const u = m.sender;
        if (!u || u.className !== "User") continue;
        if (seen.has(String(u.id))) continue;
        if (f.skipBots && u.bot) continue;
        if (f.skipDeleted && u.deleted) continue;
        if (f.skipScam && (u.scam || u.fake)) continue;
        if (f.onlyUsername && !u.username) continue;
        if (f.onlyPhoto && !u.photo) continue;
        if (f.onlyPremium && !u.premium) continue;
        seen.add(String(u.id));
        users.push({
          id: String(u.id),
          name: personName(u),
          username: u.username ? "@" + u.username : "",
          premium: !!u.premium,
          hasPhoto: !!u.photo,
          bot: !!u.bot,
        });
      }
    } catch (e: any) {
      errors.push({ ref, error: cleanErr(e) });
    }
  }

  try { await client.disconnect(); } catch {}

  return NextResponse.json({
    ok: true,
    users,
    count: users.length,
    errors,
    note:
      users.length === 0
        ? "Пользователей не найдено. Возможно, в чате мало сообщений за период, или сработали фильтры/ключевые слова."
        : errors.length
        ? `Собрано: ${users.length}. Часть чатов недоступна: ${errors.map((e) => e.ref).join(", ")}.`
        : `Собрано пользователей: ${users.length}.`,
  });
}
