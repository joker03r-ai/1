import { NextRequest, NextResponse } from "next/server";
import { startChannelSearch } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || "");
  const keywords: string[] = Array.isArray(b.keywords) ? b.keywords : String(b.keywords || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const suffixes: string[] = Array.isArray(b.suffixes) ? b.suffixes : String(b.suffixes || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const filters = b.filters && typeof b.filters === "object" ? b.filters : {};
  const res = startChannelSearch(accountId, { keywords, suffixes, filters, protect: b.protect, fast: !!b.fast });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
