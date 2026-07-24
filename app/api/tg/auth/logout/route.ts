import { NextRequest, NextResponse } from "next/server";
import { removeAccount } from "@/lib/tgAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const id = String(b.accountId || "");
  if (id) removeAccount(id);
  return NextResponse.json({ ok: true });
}
