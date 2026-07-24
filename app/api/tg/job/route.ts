import { NextRequest, NextResponse } from "next/server";
import { jobSnapshot } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Снимок состояния задачи (прогресс, найдено/сохранено/пропущено, ошибка).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("jobId") || "";
  const snap = jobSnapshot(id);
  if (!snap) return NextResponse.json({ ok: false, error: "Задача не найдена" }, { status: 404 });
  return NextResponse.json({ ok: true, job: snap });
}
