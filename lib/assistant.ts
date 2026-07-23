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

export type Assistant = {
  name: string;
  style: AssistantStyle;
  styleCustom?: string; // описание своего стиля
  role: string; // роль/инструкция
  knowledge: string[]; // источники знаний
  forbidden: string; // запрещённые темы
  examples: QA[];
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
};

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
