// Настройки ИИ-ассистента: роль, стиль общения, база знаний, ограничения, примеры.
// Хранится в localStorage (демо без бэкенда). На реальном сервере это уходит в модель.

export type AssistantStyle = "friendly" | "professional" | "short" | "detailed" | "sales" | "consultant" | "custom";

export const STYLE_LABELS: Record<AssistantStyle, string> = {
  friendly: "Дружелюбно",
  professional: "Профессионально",
  short: "Кратко",
  detailed: "Подробно",
  sales: "Как менеджер по продажам",
  consultant: "Как консультант",
  custom: "Свой вариант",
};

// Источники знаний, которые можно подключить ассистенту.
export const KNOWLEDGE_OPTIONS = [
  "Сайт",
  "PDF-файлы",
  "Документы",
  "Прайс-лист",
  "Каталог товаров",
  "Таблица",
  "Ответы на частые вопросы",
];

export type QA = { q: string; a: string };
export type KbFile = { name: string; type: string; size: number; text?: string };

export type Provider = "builtin" | "anthropic" | "openai";
export const PROVIDERS: { id: Provider; label: string; needsKey: boolean; models: string[]; keyHint: string }[] = [
  { id: "builtin", label: "BotPilot (встроенный)", needsKey: false, models: ["Быстрый", "Умный"], keyHint: "Ключ не нужен — работает из коробки." },
  { id: "anthropic", label: "Anthropic (Claude)", needsKey: true, models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5", "claude-opus-4-1"], keyHint: "Ключ вида sk-ant-… с console.anthropic.com" },
  { id: "openai", label: "OpenAI (GPT)", needsKey: true, models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"], keyHint: "Ключ вида sk-… с platform.openai.com" },
];

export type Length = "short" | "medium" | "long";
export const LENGTHS: { id: Length; label: string }[] = [
  { id: "short", label: "Кратко (1–2 предложения)" },
  { id: "medium", label: "Средне (до 4 предложений)" },
  { id: "long", label: "Подробно (развёрнуто)" },
];
export type NoAnswer = "manager" | "generic" | "silent";
export const NO_ANSWER_LABELS: Record<NoAnswer, string> = {
  manager: "Предложить передать вопрос менеджеру",
  generic: "Дать общий ответ и попросить уточнить",
  silent: "Сообщить, что информации нет",
};
export const NO_ANSWER_PHRASE = "Я не нашёл точной информации в базе знаний. Хотите, я передам ваш вопрос менеджеру?";

export type Assistant = {
  name: string;
  style: AssistantStyle;
  styleCustom?: string; // описание своего стиля
  role: string; // системная инструкция
  knowledge: string[]; // (устар.) источники-чипы
  forbidden: string; // запрещённые темы
  examples: QA[];
  // Подключение нейросети
  aiEnabled: boolean;
  provider: Provider;
  model: string;
  apiKey: string;
  // Структурированная база знаний
  kbCompany: string;
  kbServices: string;
  kbPrices: string;
  kbContacts: string;
  kbHours: string;
  kbPayment: string;
  kbDelivery: string;
  kbFaq: QA[];
  kbFiles: KbFile[];
  kbLinks: string[];
  // Поведение
  language: string;
  length: Length;
  address: "ты" | "вы";
  noAnswer: NoAnswer;
};

// Карта «id бота → ассистент». У каждого бота свой ассистент.
const KEY = "sb_assistants";
const LEGACY_KEY = "sb_assistant";

export const DEFAULT_ASSISTANT: Assistant = {
  name: "Анна",
  style: "friendly",
  role: "",
  knowledge: [],
  forbidden: "",
  examples: [],
  aiEnabled: false,
  provider: "builtin",
  model: "Быстрый",
  apiKey: "",
  kbCompany: "",
  kbServices: "",
  kbPrices: "",
  kbContacts: "",
  kbHours: "",
  kbPayment: "",
  kbDelivery: "",
  kbFaq: [],
  kbFiles: [],
  kbLinks: [],
  language: "Русский",
  length: "medium",
  address: "вы",
  noAnswer: "manager",
};

// Заполнена ли база знаний (для заметного уведомления).
export function kbFilled(a: Assistant): boolean {
  const parts = [a.kbCompany, a.kbServices, a.kbPrices, a.kbContacts, a.kbHours, a.kbPayment, a.kbDelivery];
  return parts.some((p) => (p || "").trim().length > 0) || (a.kbFaq && a.kbFaq.length > 0) || (a.kbFiles && a.kbFiles.length > 0) || (a.kbLinks && a.kbLinks.length > 0);
}

// Собирает всю базу знаний в один текст для нейросети.
export function kbText(a: Assistant): string {
  const blocks: string[] = [];
  const add = (title: string, v?: string) => { if ((v || "").trim()) blocks.push(`## ${title}\n${v!.trim()}`); };
  add("О компании", a.kbCompany);
  add("Услуги и товары", a.kbServices);
  add("Цены", a.kbPrices);
  add("Адреса и контакты", a.kbContacts);
  add("Часы работы", a.kbHours);
  add("Оплата", a.kbPayment);
  add("Доставка", a.kbDelivery);
  if (a.kbFaq?.length) blocks.push("## Частые вопросы\n" + a.kbFaq.filter((f) => f.q || f.a).map((f) => `В: ${f.q}\nО: ${f.a}`).join("\n\n"));
  const filesText = (a.kbFiles || []).map((f) => f.text ? `### ${f.name}\n${f.text}` : "").filter(Boolean).join("\n\n");
  if (filesText) blocks.push("## Из загруженных файлов\n" + filesText);
  if (a.kbLinks?.length) blocks.push("## Ссылки на сайт\n" + a.kbLinks.filter(Boolean).join("\n"));
  if (a.examples?.length) blocks.push("## Примеры ответов\n" + a.examples.filter((e) => e.q || e.a).map((e) => `В: ${e.q}\nО: ${e.a}`).join("\n\n"));
  return blocks.join("\n\n");
}

// Строит инструкцию поведения (стиль, язык, длина, обращение, «нет ответа»).
export function behaviorInstruction(a: Assistant): string {
  const styleWord = a.style === "custom" ? (a.styleCustom || "нейтрально") : STYLE_LABELS[a.style].toLowerCase();
  const lenWord = a.length === "short" ? "коротко, 1–2 предложения" : a.length === "long" ? "развёрнуто и подробно" : "не длиннее 3–4 предложений";
  const parts = [
    a.role || `Ты — ${a.name}, ИИ-ассистент компании. Помогаешь клиентам по услугам, ценам и заявкам.`,
    `Общайся ${styleWord}, на «${a.address}», отвечай на языке: ${a.language}.`,
    `Длина ответа: ${lenWord}.`,
  ];
  if (a.forbidden.trim()) parts.push(`Не обсуждай: ${a.forbidden.trim()}.`);
  parts.push(
    a.noAnswer === "manager"
      ? `ВАЖНО: если точного ответа нет в базе знаний — НЕ придумывай. Ответь дословно: "${NO_ANSWER_PHRASE}"`
      : a.noAnswer === "silent"
      ? "ВАЖНО: если ответа нет в базе знаний — честно скажи, что такой информации у тебя нет, и не выдумывай."
      : "Если точного ответа нет в базе знаний — дай общий ответ и попроси уточнить вопрос, не выдумывай фактов."
  );
  return parts.join(" ");
}

function loadMap(): Record<string, Assistant> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, Assistant>) : {};
    // Разовая миграция старого единственного ассистента к боту по умолчанию.
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        try {
          map["bot_default"] = { ...DEFAULT_ASSISTANT, ...(JSON.parse(legacy) as Assistant) };
          localStorage.setItem(KEY, JSON.stringify(map));
        } catch {}
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function loadAssistant(botId: string): Assistant {
  const map = loadMap();
  return map[botId] ? { ...DEFAULT_ASSISTANT, ...map[botId] } : { ...DEFAULT_ASSISTANT };
}

export function saveAssistant(botId: string, a: Assistant) {
  try {
    const map = loadMap();
    map[botId] = a;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}
