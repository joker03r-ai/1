// Анализ сайта для автозаполнения карточки бизнеса в мастере.
// С ключом ANTHROPIC_API_KEY извлекает данные через Claude; без ключа —
// эвристика по <title> и мета-описанию.

export type BizInfo = {
  name: string;
  about: string;
  products: string;
  clients: string;
  contacts: string;
  schedule: string;
};

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// Достаём читаемый текст из HTML (грубо, без внешних зависимостей).
function htmlToText(html: string): { title: string; description: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const description = (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    ""
  ).trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
  return { title, description, text };
}

async function fetchSite(url: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; BotPilotBot/1.0)" },
    });
    if (!res.ok) throw new Error(`Сайт ответил ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function extractWithClaude(url: string, parsed: { title: string; description: string; text: string }): Promise<BizInfo> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const system =
    "Ты извлекаешь данные о бизнесе с сайта. Верни ТОЛЬКО JSON с полями: " +
    "name (название компании), about (чем занимается), products (товары или услуги), " +
    "clients (кто основные клиенты), contacts (телефон/почта/адрес), schedule (график работы). " +
    "Пиши кратко, по-русски. Если данных нет — оставь пустую строку. Без пояснений, только JSON.";
  const content = `Сайт: ${url}\nЗаголовок: ${parsed.title}\nОписание: ${parsed.description}\nТекст страницы: ${parsed.text}`;
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 800, system, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const textOut = Array.isArray(data.content) ? data.content.map((c: any) => c.text || "").join("") : "";
  const jsonStr = textOut.slice(textOut.indexOf("{"), textOut.lastIndexOf("}") + 1);
  const raw = JSON.parse(jsonStr);
  return {
    name: String(raw.name || "").slice(0, 120),
    about: String(raw.about || "").slice(0, 300),
    products: String(raw.products || "").slice(0, 300),
    clients: String(raw.clients || "").slice(0, 200),
    contacts: String(raw.contacts || "").slice(0, 200),
    schedule: String(raw.schedule || "").slice(0, 120),
  };
}

// Эвристика без ИИ: название из <title>, описание из meta description.
function extractHeuristic(parsed: { title: string; description: string }): BizInfo {
  const name = parsed.title.split(/[|—\-–:]/)[0].trim();
  return {
    name: name.slice(0, 120),
    about: parsed.description.slice(0, 300),
    products: "",
    clients: "",
    contacts: "",
    schedule: "",
  };
}

export async function analyzeSite(rawUrl: string): Promise<{ data: BizInfo; source: "claude" | "heuristic" }> {
  const url = normalizeUrl(rawUrl);
  const html = await fetchSite(url);
  const parsed = htmlToText(html);
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { data: await extractWithClaude(url, parsed), source: "claude" };
    } catch {
      // Падаем на эвристику, если модель недоступна.
    }
  }
  return { data: extractHeuristic(parsed), source: "heuristic" };
}
