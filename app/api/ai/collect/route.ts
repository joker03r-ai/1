import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Сбор базы знаний из источников. С ключом провайдера — модель извлекает
// данные; без ключа — честная эвристика. Важно: цены, адреса, часы и т.п.
// НЕ выдумываются — если не найдены, помечаются «Требуется уточнение».

type Field = { value: string; source: "site" | "doc" | "ai" | "text" | "none"; status: "found" | "ai" | "needs" };

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 3);
}
function pick(text: string, re: RegExp): string {
  return sentences(text).filter((s) => re.test(s.toLowerCase())).slice(0, 3).join(" ");
}

async function fetchSite(url: string): Promise<string> {
  try {
    const u = url.startsWith("http") ? url : "https://" + url;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(u, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 BotPilot" } });
    clearTimeout(t);
    const html = await res.text();
    return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);
  } catch {
    return "";
  }
}

function heuristic(text: string, siteText: string, hasSite: boolean, hasDoc: boolean) {
  const all = [text, siteText].filter(Boolean).join("\n");
  const srcOf = (): Field["source"] => (hasSite ? "site" : hasDoc ? "doc" : "text");
  const field = (value: string, foundRe?: RegExp): Field => {
    if (value.trim()) return { value: value.trim(), source: srcOf(), status: "found" };
    return { value: "", source: "none", status: "needs" };
  };

  const company = field(sentences(text).slice(0, 2).join(" ") || pick(all, /компан|мы —|о нас|бренд|студи|клиник|магазин/));
  const services = field(pick(all, /услуг|товар|продук|сервис|предлага|делаем|ассортимент/));
  const priceMatch = all.match(/[^.!?]*\b\d[\d\s]*\s?(₽|руб|р\.|рублей)[^.!?]*/gi);
  const prices: Field = priceMatch ? { value: priceMatch.slice(0, 5).map((s) => s.trim()).join("\n"), source: srcOf(), status: "found" } : { value: "", source: "none", status: "needs" };
  const contactMatch = all.match(/(\+?\d[\d\-\s()]{7,}\d)|([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|(ул\.|улица|проспект|пр-т|г\.\s?[А-Я])/gi);
  const contacts: Field = contactMatch ? { value: Array.from(new Set(contactMatch.map((s) => s.trim()))).slice(0, 6).join("\n"), source: srcOf(), status: "found" } : { value: "", source: "none", status: "needs" };
  const hoursMatch = all.match(/(круглосуточно|\bежедневно\b|(пн|вт|ср|чт|пт|сб|вс|пон|втор)[^.!?]{0,40}\d{1,2}[:.]\d{2})/gi);
  const hours: Field = hoursMatch ? { value: hoursMatch.slice(0, 3).map((s) => s.trim()).join("; "), source: srcOf(), status: "found" } : { value: "", source: "none", status: "needs" };
  const payment = field(pick(all, /оплат|картой|наличн|рассрочк|перевод|касса|эквайринг/));
  const delivery = field(pick(all, /доставк|самовывоз|курьер|отправ|логист/));

  const topic = (company.value.split(/[.,]/)[0] || "нашей теме").slice(0, 40);
  const faq = [
    { q: "Как с вами связаться?", a: contacts.value || "", src: contacts.status === "found" ? "ai" : "needs" },
    { q: "Сколько стоят услуги?", a: prices.value || "", src: prices.status === "found" ? "ai" : "needs" },
    { q: "Как работает доставка/оплата?", a: [payment.value, delivery.value].filter(Boolean).join(" ") || "", src: (payment.status === "found" || delivery.status === "found") ? "ai" : "needs" },
  ].map((f) => ({ q: f.q, a: f.a, source: "ai" as const, status: (f.a ? "ai" : "needs") as "ai" | "needs" }));

  const instruction: Field = {
    value: `Ты — вежливый ассистент компании «${topic}». Отвечай по услугам, ценам и записи на основе базы знаний. Если точного ответа нет — не выдумывай, предложи связаться с менеджером.`,
    source: "ai", status: "ai",
  };
  return { company, services, prices, contacts, hours, payment, delivery, faq, instruction, style: "friendly" };
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const about = String(b.about || "");
  const siteUrl = String(b.siteUrl || "").trim();
  const docsText = String(b.docsText || "");
  const provider = String(b.provider || "builtin");
  const apiKey = String(b.apiKey || "").trim();
  const model = String(b.model || "").trim();

  const siteText = siteUrl ? await fetchSite(siteUrl) : "";
  const hasSite = !!siteText;
  const hasDoc = !!docsText;

  // С ключом — пробуем извлечь моделью в JSON.
  if (provider !== "builtin" && apiKey) {
    try {
      const src = [about && `ОПИСАНИЕ КОМПАНИИ:\n${about}`, siteText && `САЙТ:\n${siteText}`, docsText && `ДОКУМЕНТЫ:\n${docsText}`].filter(Boolean).join("\n\n").slice(0, 12000);
      const sys = 'Извлеки данные о компании СТРОГО из текста. Не выдумывай цены, адреса, телефоны и часы работы — если их нет в тексте, оставь пустую строку. Верни ТОЛЬКО JSON: {"company":"","services":"","prices":"","contacts":"","hours":"","payment":"","delivery":"","faq":[{"q":"","a":""}],"instruction":""}';
      const { callJSON } = await import("../_model");
      const json = await callJSON(provider, apiKey, model, sys, src);
      if (json) {
        const f = (v: string, foundByModel: boolean): Field => v && v.trim() ? { value: v.trim(), source: hasSite ? "site" : hasDoc ? "doc" : "ai", status: "found" } : { value: "", source: "none", status: "needs" };
        return NextResponse.json({
          ok: true, byModel: true,
          company: f(json.company, true), services: f(json.services, true), prices: f(json.prices, true),
          contacts: f(json.contacts, true), hours: f(json.hours, true), payment: f(json.payment, true), delivery: f(json.delivery, true),
          faq: (json.faq || []).slice(0, 6).map((x: any) => ({ q: String(x.q || ""), a: String(x.a || ""), source: "ai", status: x.a ? "ai" : "needs" })),
          instruction: json.instruction ? { value: String(json.instruction), source: "ai", status: "ai" } : { value: "", source: "none", status: "needs" },
          style: "friendly",
        });
      }
    } catch {}
  }

  return NextResponse.json({ ok: true, byModel: false, ...heuristic(about, siteText, hasSite, hasDoc) });
}
