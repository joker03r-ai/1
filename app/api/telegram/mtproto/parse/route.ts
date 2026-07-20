import { NextRequest, NextResponse } from "next/server";
import { makeClient, cleanErr } from "../_util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Нормализуем ссылку/юзернейм канала к виду, который понимает getEntity.
function normalize(raw: string): string {
  let s = String(raw || "").trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^t\.me\//i, "").replace(/^telegram\.me\//i, "");
  s = s.replace(/^@/, "").replace(/\/+$/, "");
  return s;
}

function chatType(e: any): string {
  if (e?.broadcast) return "channel";
  if (e?.megagroup) return "supergroup";
  if (e?.className === "User") return "private";
  return "group";
}

function personName(u: any): string {
  if (!u) return "—";
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Пользователь";
}

// Парсинг нескольких публичных каналов/групп через MTProto-аккаунт.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const apiId = String(b.apiId || "").trim();
  const apiHash = String(b.apiHash || "").trim();
  const session = String(b.session || "");
  const channels: string[] = Array.isArray(b.channels) ? b.channels : [];
  const limit = Math.min(Math.max(Number(b.limit) || 30, 1), 100);
  if (!apiId || !apiHash || !session) {
    return NextResponse.json({ error: "Сначала войдите в аккаунт Telegram" }, { status: 400 });
  }
  const refs = channels.map(normalize).filter(Boolean).slice(0, 20);
  if (!refs.length) return NextResponse.json({ error: "Укажите хотя бы один канал" }, { status: 400 });

  let client: any;
  try {
    client = await makeClient(apiId, apiHash, session);
  } catch (e: any) {
    return NextResponse.json({ error: cleanErr(e) }, { status: 400 });
  }

  const chats: any[] = [];
  const errors: { ref: string; error: string }[] = [];

  for (const ref of refs) {
    try {
      const entity: any = await client.getEntity(ref);
      const msgs: any[] = await client.getMessages(entity, { limit });
      const messages = msgs
        .slice()
        .reverse()
        .map((m: any) => ({
          id: String(m.id),
          from: m.sender ? personName(m.sender) : entity.title || ref,
          text: m.message || (m.media ? "[медиа]" : ""),
          ts: (m.date || 0) * 1000,
          out: false,
        }))
        .filter((m: any) => m.text);

      let participants: any[] = [];
      try {
        const parts: any[] = await client.getParticipants(entity, { limit: 200 });
        participants = parts.map((u: any) => ({
          id: String(u.id),
          name: personName(u),
          username: u.username ? "@" + u.username : undefined,
          tgRole: "member",
        }));
      } catch {
        // Каналы обычно скрывают список участников для неадминов — это нормально.
      }

      chats.push({
        id: String(entity.id),
        title: entity.title || (entity.username ? "@" + entity.username : ref),
        type: chatType(entity),
        username: entity.username ? "@" + entity.username : undefined,
        membersCount: Number(entity.participantsCount) || participants.length || 0,
        participants,
        messages,
        parsedAt: Date.now(),
      });
    } catch (e: any) {
      errors.push({ ref, error: cleanErr(e) });
    }
  }

  try {
    await client.disconnect();
  } catch {}

  return NextResponse.json({
    ok: true,
    chats,
    errors,
    note:
      chats.length === 0
        ? "Не удалось спарсить каналы. Проверьте ссылки/@username и что каналы публичные."
        : errors.length
        ? `Спарсено: ${chats.length}. Не удалось: ${errors.map((e) => e.ref).join(", ")}.`
        : `Спарсено каналов: ${chats.length}.`,
  });
}
