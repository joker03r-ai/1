import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Проверка подключения нейросети: делает минимальный запрос к провайдеру.
// Ключ идёт только в теле POST и не логируется.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const provider = String(b.provider || "builtin");
  const apiKey = String(b.apiKey || "").trim();
  const model = String(b.model || "").trim();

  if (provider === "builtin") {
    return NextResponse.json({ ok: true, status: "connected", note: "Встроенная модель — ключ не требуется." });
  }
  if (!apiKey) {
    return NextResponse.json({ ok: false, status: "no_key", error: "Ключ не указан." }, { status: 200 });
  }

  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || "gpt-4o-mini", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      });
      if (res.ok) return NextResponse.json({ ok: true, status: "connected" });
      const d = await res.text().catch(() => "");
      return NextResponse.json({ ok: false, status: "error", error: `OpenAI ${res.status}: ${d.slice(0, 160)}` }, { status: 200 });
    }
    // anthropic
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: model || "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
    });
    if (res.ok) return NextResponse.json({ ok: true, status: "connected" });
    const d = await res.text().catch(() => "");
    return NextResponse.json({ ok: false, status: "error", error: `Anthropic ${res.status}: ${d.slice(0, 160)}` }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, status: "error", error: "Не удалось подключиться к провайдеру. Проверьте ключ и сеть сервера." }, { status: 200 });
  }
}
