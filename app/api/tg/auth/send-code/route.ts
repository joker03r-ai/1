import { NextRequest, NextResponse } from "next/server";
import { makeClient, cleanErr } from "@/app/api/telegram/mtproto/_util";
import { putPending } from "@/lib/tgAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Шаг 1 входа: отправка кода. Сессия НЕ уходит клиенту — хранится на сервере.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const apiId = String(b.apiId || "").trim();
  const apiHash = String(b.apiHash || "").trim();
  const phone = String(b.phone || "").trim();
  if (!apiId || !apiHash || !phone) return NextResponse.json({ error: "Укажите api_id, api_hash и телефон" }, { status: 400 });
  try {
    const client = await makeClient(apiId, apiHash, "");
    const res: any = await client.sendCode({ apiId: Number(apiId), apiHash }, phone);
    const session = String(client.session.save());
    await client.disconnect();
    const authId = putPending({ apiId, apiHash, phone, phoneCodeHash: res.phoneCodeHash, session });
    return NextResponse.json({ ok: true, authId });
  } catch (e: any) {
    return NextResponse.json({ error: cleanErr(e) }, { status: 400 });
  }
}
