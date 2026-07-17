import { NextRequest, NextResponse } from "next/server";
import { generateReply, ChatMessage } from "@/lib/ai";
import { BotConfig } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      bot: BotConfig;
      history: ChatMessage[];
    };
    if (!body?.bot || !Array.isArray(body?.history)) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const { reply, source } = await generateReply(body.bot, body.history);
    return NextResponse.json({ reply, source });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
