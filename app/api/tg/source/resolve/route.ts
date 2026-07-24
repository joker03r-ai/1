import { NextRequest, NextResponse } from "next/server";
import { resolveSource } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Определяет тип источника (супергруппа/broadcast/группа) и доступность
// участников/комментариев — для проверки перед запуском.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || "");
  const link = String(b.link || "");
  const res = await resolveSource(accountId, link);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
