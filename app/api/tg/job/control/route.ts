import { NextRequest, NextResponse } from "next/server";
import { controlJob } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Управление задачей: пауза / продолжить / остановить.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const id = String(b.jobId || "");
  const action = b.action as "pause" | "resume" | "stop";
  if (!["pause", "resume", "stop"].includes(action)) return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
  const ok = controlJob(id, action);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
