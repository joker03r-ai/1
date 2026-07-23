// Настройки ИИ-ассистента: роль, стиль общения, база знаний, ограничения, примеры.
// Хранится в localStorage (демо без бэкенда). На реальном сервере это уходит в модель.

export type AssistantStyle = "friendly" | "professional" | "short" | "detailed" | "sales" | "consultant";

export const STYLE_LABELS: Record<AssistantStyle, string> = {
  friendly: "Дружелюбно",
  professional: "Профессионально",
  short: "Кратко",
  detailed: "Подробно",
  sales: "Как менеджер по продажам",
  consultant: "Как консультант",
};

export type QA = { q: string; a: string };

export type Assistant = {
  name: string;
  style: AssistantStyle;
  role: string; // роль/инструкция
  knowledge: string[]; // источники знаний
  forbidden: string; // запрещённые темы
  examples: QA[];
};

const KEY = "sb_assistant";

export const DEFAULT_ASSISTANT: Assistant = {
  name: "Анна",
  style: "friendly",
  role: "",
  knowledge: [],
  forbidden: "",
  examples: [],
};

export function loadAssistant(): Assistant {
  if (typeof window === "undefined") return DEFAULT_ASSISTANT;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_ASSISTANT, ...(JSON.parse(raw) as Assistant) } : DEFAULT_ASSISTANT;
  } catch {
    return DEFAULT_ASSISTANT;
  }
}

export function saveAssistant(a: Assistant) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {}
}
