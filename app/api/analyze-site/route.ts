import { NextRequest, NextResponse } from "next/server";
import { analyzeSite } from "@/lib/siteAnalyze";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = (body?.url || "").trim();
    if (!url) return NextResponse.json({ error: "empty url" }, { status: 400 });
    const { data, source } = await analyzeSite(url);
    return NextResponse.json({ data, source });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Не удалось прочитать сайт" }, { status: 502 });
  }
}
