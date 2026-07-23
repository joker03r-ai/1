import { NextRequest, NextResponse } from "next/server";
import { makeClient, cleanErr } from "../_util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Парсер чатов/групп по ключевым словам (для сбора базы под продвижение).
// Использует contacts.Search — ищет публичные каналы/группы по названию/username.

function chatType(e: any): string {
  if (e?.broadcast) return "channel";
  if (e?.megagroup) return "supergroup";
  return "group";
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const apiId = String(b.apiId || "").trim();
  const apiHash = String(b.apiHash || "").trim();
  const session = String(b.session || "");
  const keywords: string[] = Array.isArray(b.keywords) ? b.keywords : [];
  const limit = Math.min(Math.max(Number(b.limit) || 50, 1), 500);
  const minMembers = Math.max(Number(b.minMembers) || 0, 0);
  const maxMembers = Number(b.maxMembers) > 0 ? Number(b.maxMembers) : Infinity;

  if (!apiId || !apiHash || !session) {
    return NextResponse.json({ error: "Сначала войдите в аккаунт Telegram" }, { status: 400 });
  }
  const words = keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 30);
  if (!words.length) return NextResponse.json({ error: "Укажите ключевые слова" }, { status: 400 });

  let client: any;
  try {
    client = await makeClient(apiId, apiHash, session);
    const { Api } = await import("telegram");

    const seen = new Set<string>();
    const chats: any[] = [];

    for (const q of words) {
      if (chats.length >= limit) break;
      let res: any;
      try {
        res = await client.invoke(new Api.contacts.Search({ q, limit: 50 }));
      } catch {
        continue;
      }
      const found: any[] = [...(res?.chats || [])];
      for (const c of found) {
        const id = String(c.id);
        if (seen.has(id)) continue;
        if (c.className !== "Channel" && c.className !== "Chat") continue;
        let members = Number(c.participantsCount) || 0;
        if (!members) {
          try {
            members = Number(await client.invoke(new Api.channels.GetFullChannel({ channel: c }))?.fullChat?.participantsCount) || 0;
          } catch {}
        }
        if (members < minMembers || members > maxMembers) continue;
        seen.add(id);
        chats.push({
          id,
          title: c.title || (c.username ? "@" + c.username : "Чат"),
          username: c.username ? "@" + c.username : "",
          link: c.username ? "https://t.me/" + c.username : "",
          members,
          type: chatType(c),
          keyword: q,
        });
        if (chats.length >= limit) break;
      }
    }

    try { await client.disconnect(); } catch {}
    chats.sort((a, b2) => b2.members - a.members);

    return NextResponse.json({
      ok: true,
      chats,
      count: chats.length,
      note:
        chats.length === 0
          ? "Ничего не найдено. Попробуйте другие ключевые слова или расширьте диапазон участников."
          : `Найдено чатов: ${chats.length}.`,
    });
  } catch (e: any) {
    try { await client?.disconnect(); } catch {}
    return NextResponse.json({ error: cleanErr(e) }, { status: 400 });
  }
}
