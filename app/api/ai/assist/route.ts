import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Помощник по полю: улучшить / сократить / примеры / FAQ.
// С ключом — модель; без ключа — аккуратная эвристика (без выдумывания фактов).

function sentences(t: string) { return t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean); }
function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "improve");
  const text = String(b.text || "").trim();
  const provider = String(b.provider || "builtin");
  const apiKey = String(b.apiKey || "").trim();
  const model = String(b.model || "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "Добавьте текст." }, { status: 400 });

  const prompts: Record<string, string> = {
    improve: "Улучши формулировки текста для базы знаний бота: сделай понятно, вежливо и по делу. НЕ добавляй новых фактов (цен, адресов, дат), которых нет в тексте. Верни только улучшенный текст.",
    shorten: "Сократи текст до 1–2 ёмких предложений, сохранив суть. Без новых фактов.",
    examples: "На основе текста сформулируй 3 коротких примера типичных вопросов клиента и ответы на них. Формат: строками «Вопрос — Ответ».",
    faq: "Составь 3–5 пар «вопрос — ответ» для FAQ строго по тексту. НЕ выдумывай факты. Верни JSON: {\"faq\":[{\"q\":\"\",\"a\":\"\"}]}.",
  };

  if (provider !== "builtin" && apiKey) {
    try {
      const { callText, callJSON } = await import("../_model");
      if (action === "faq") {
        const j = await callJSON(provider, apiKey, model, prompts.faq, text);
        if (j?.faq) return NextResponse.json({ ok: true, faq: j.faq });
      } else {
        const out = await callText(provider, apiKey, model, prompts[action] || prompts.improve, text);
        if (out) return NextResponse.json({ ok: true, result: out });
      }
    } catch {}
  }

  // Эвристики.
  if (action === "shorten") return NextResponse.json({ ok: true, result: cap(sentences(text)[0] || text).slice(0, 180) });
  if (action === "examples") {
    const topic = (sentences(text)[0] || "услуге").slice(0, 30);
    return NextResponse.json({ ok: true, result: `Сколько стоит ${topic}? — Уточните у менеджера.\nКак записаться? — Оставьте контакт, мы свяжемся.\nГде вы находитесь? — Смотрите раздел «Контакты».` });
  }
  if (action === "faq") {
    return NextResponse.json({ ok: true, faq: [
      { q: "Как оставить заявку?", a: "Напишите нам — мы свяжемся и поможем." },
      { q: "Сколько стоит?", a: sentences(text).find((s) => /\d/.test(s)) || "Уточните, пожалуйста, интересующую услугу." },
    ] });
  }
  // improve: аккуратно нормализуем.
  const cleaned = sentences(text).map((s) => cap(s.replace(/\s+/g, " "))).join(" ");
  return NextResponse.json({ ok: true, result: cleaned });
}
