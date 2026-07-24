import { NextRequest, NextResponse } from "next/server";
import { startContentJob } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || "");
  const source = String(b.source || "");
  const days = Math.max(Number(b.days) || 0, 0);
  const limit = Number(b.limit) || 200;
  const keywords: string[] = Array.isArray(b.keywords) ? b.keywords : String(b.keywords || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (!source) return NextResponse.json({ error: "Укажите источник" }, { status: 400 });
  const res = startContentJob(accountId, source, { days, keywords, limit });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
