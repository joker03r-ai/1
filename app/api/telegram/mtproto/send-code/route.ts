import { NextRequest, NextResponse } from "next/server";
import { makeClient, cleanErr } from "../_util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Шаг 1 входа: отправляет код подтверждения на телефон аккаунта.
export async function POST(req: NextRequest) {
  let apiId = "", apiHash = "", phone = "";
  try {
    const b = await req.json();
    apiId = String(b.apiId || "").trim();
    apiHash = String(b.apiHash || "").trim();
    phone = String(b.phone || "").trim();
  } catch {}
  if (!apiId || !apiHash || !phone) {
    return NextResponse.json({ error: "Укажите api_id, api_hash и телефон" }, { status: 400 });
  }
  try {
    const client = await makeClient(apiId, apiHash, "");
    const res: any = await client.sendCode({ apiId: Number(apiId), apiHash }, phone);
    const session = String(client.session.save());
    await client.disconnect();
    return NextResponse.json({ ok: true, phoneCodeHash: res.phoneCodeHash, session });
  } catch (e: any) {
    return NextResponse.json({ error: cleanErr(e) }, { status: 400 });
  }
}
