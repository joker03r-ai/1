import { NextRequest } from "next/server";
import { audienceCsv } from "@/lib/tgParseJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Экспорт аудитории в CSV — БЕЗ номеров телефонов.
// Колонки: user_id, username, name, source, activity_date.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("jobId") || "";
  const csv = audienceCsv(id);
  return new Response("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audience_${id}.csv"`,
    },
  });
}
