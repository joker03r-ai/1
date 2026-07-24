import { NextRequest, NextResponse } from "next/server";
import { startSimilarExpand } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || "");
  const sources: string[] = Array.isArray(b.sources) ? b.sources : String(b.sources || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const existing: string[] = Array.isArray(b.existing) ? b.existing.map(String) : [];
  const filters = b.filters && typeof b.filters === "object" ? b.filters : {};
  const res = startSimilarExpand(accountId, { sources, depth: Number(b.depth) || 1, dedup: b.dedup !== false, existing, filters, protect: b.protect, fast: !!b.fast });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
