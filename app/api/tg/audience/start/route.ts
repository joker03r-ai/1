import { NextRequest, NextResponse } from "next/server";
import { startAudienceJob, JobMode, Protect } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: JobMode[] = ["participants", "message_authors", "comment_authors"];
const PROTECTS: Protect[] = ["off", "conservative", "balanced", "aggressive"];

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || "");
  // Список чатов: массив либо строка (по одному в строке).
  const sources: string[] = Array.isArray(b.sources)
    ? b.sources.map((s: any) => String(s))
    : String(b.sources || b.source || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const mode = (MODES.includes(b.mode) ? b.mode : "participants") as JobMode;
  const target = Number(b.target) || 1000;
  const days = Math.max(Number(b.days) || 0, 0);
  const keywords: string[] = Array.isArray(b.keywords)
    ? b.keywords
    : String(b.keywords || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const protect = (PROTECTS.includes(b.protect) ? b.protect : "off") as Protect;
  const fast = !!b.fast;
  const filters = b.filters && typeof b.filters === "object" ? b.filters : {};
  const delayChat = Number(b.delayChat) || 0;
  const delayUser = Number(b.delayUser) || 0;
  if (!sources.length) return NextResponse.json({ error: "Укажите источник" }, { status: 400 });
  const res = startAudienceJob(accountId, { sources, mode, target, days, keywords, filters, protect, fast, delayChat, delayUser });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
