import { NextRequest, NextResponse } from "next/server";
import { generateScenario } from "@/lib/aiScenario";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { prompt?: string };
    const prompt = (body?.prompt || "").trim();
    if (!prompt) return NextResponse.json({ error: "empty prompt" }, { status: 400 });
    const { graph, source } = await generateScenario(prompt);
    return NextResponse.json({ ...graph, source });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
