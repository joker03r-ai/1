// Общий вызов провайдера для сбора/улучшения текста (сервер).

export async function callText(provider: string, apiKey: string, model: string, system: string, user: string): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || "gpt-4o-mini", max_tokens: 900, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error("openai " + res.status);
    const d = await res.json();
    return (d.choices?.[0]?.message?.content || "").trim();
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: model || "claude-haiku-4-5-20251001", max_tokens: 900, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error("anthropic " + res.status);
  const d = await res.json();
  return (Array.isArray(d.content) ? d.content.map((c: any) => c.text || "").join("") : "").trim();
}

export async function callJSON(provider: string, apiKey: string, model: string, system: string, user: string): Promise<any | null> {
  const raw = await callText(provider, apiKey, model, system, user);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
