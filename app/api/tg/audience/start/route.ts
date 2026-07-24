import { NextRequest, NextResponse } from "next/server";
import { startAudienceJob, JobMode } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: JobMode[] = ["participants", "message_authors", "comment_authors"];

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || "");
  const source = String(b.source || "");
  const mode = (MODES.includes(b.mode) ? b.mode : "participants") as JobMode;
  const target = Number(b.target) || 1000;
  if (!source) return NextResponse.json({ error: "Укажите источник" }, { status: 400 });
  const res = startAudienceJob(accountId, source, mode, target);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
