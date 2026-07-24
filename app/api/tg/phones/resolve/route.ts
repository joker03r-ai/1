import { NextRequest, NextResponse } from "next/server";
import { startPhoneResolve } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || "");
  const phones: string[] = Array.isArray(b.phones) ? b.phones : String(b.phones || "").split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
  const res = startPhoneResolve(accountId, phones);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
