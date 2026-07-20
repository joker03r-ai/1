// Тарифы кабинета и текущий план.

export type PlanId = "free" | "start" | "pro" | "business";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number; // ₽/мес при помесячной оплате
  annual: number; // ₽/мес при годовой оплате (списывается за год)
  emoji: string;
  popular?: boolean;
  highlights: string[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Бесплатный",
    tagline: "Попробовать и запустить первого бота",
    monthly: 0,
    annual: 0,
    emoji: "🚀",
    highlights: ["1 бот", "100 диалогов/мес", "Базовые блоки сценариев", "1 канал"],
  },
  {
    id: "start",
    name: "Старт",
    tagline: "Для небольших проектов и первых продаж",
    monthly: 990,
    annual: 790,
    emoji: "⭐",
    highlights: ["3 бота", "2 000 диалогов/мес", "Все блоки сценариев", "Рассылки", "Сбор заявок и Google Таблицы"],
  },
  {
    id: "pro",
    name: "Про",
    tagline: "ИИ-ответы, команда и интеграции",
    monthly: 2490,
    annual: 1990,
    emoji: "💎",
    popular: true,
    highlights: ["10 ботов", "15 000 диалогов/мес", "AI-ответы (Claude)", "Сборка сценариев ИИ", "Команда и доступы", "Все интеграции и приём оплаты"],
  },
  {
    id: "business",
    name: "Бизнес",
    tagline: "Без лимитов, приоритет и API",
    monthly: 6900,
    annual: 5500,
    emoji: "🏢",
    highlights: ["Без лимита ботов", "Безлимит диалогов", "Приоритетная поддержка", "Выгрузки и отчёты", "API и вебхуки", "Персональный менеджер"],
  },
];

// Таблица сравнения возможностей.
export type CompareRow = { feature: string; values: Record<PlanId, string | boolean> };

export const COMPARE: CompareRow[] = [
  { feature: "Ботов", values: { free: "1", start: "3", pro: "10", business: "∞" } },
  { feature: "Диалогов в месяц", values: { free: "100", start: "2 000", pro: "15 000", business: "∞" } },
  { feature: "Каналов подключения", values: { free: "1", start: "3", pro: "10", business: "∞" } },
  { feature: "Визуальные сценарии", values: { free: true, start: true, pro: true, business: true } },
  { feature: "Рассылки", values: { free: false, start: true, pro: true, business: true } },
  { feature: "Сбор заявок и Google Таблицы", values: { free: false, start: true, pro: true, business: true } },
  { feature: "AI-ответы (Claude)", values: { free: false, start: false, pro: true, business: true } },
  { feature: "Сборка сценариев ИИ", values: { free: false, start: false, pro: true, business: true } },
  { feature: "Команда и доступы", values: { free: false, start: false, pro: true, business: true } },
  { feature: "Приём оплаты и интеграции", values: { free: false, start: "частично", pro: true, business: true } },
  { feature: "Выгрузки и отчёты", values: { free: false, start: false, pro: false, business: true } },
  { feature: "API и вебхуки", values: { free: false, start: false, pro: false, business: true } },
  { feature: "Поддержка", values: { free: "чат", start: "чат", pro: "приоритет", business: "персональный менеджер" } },
];

const KEY = "sb_plan";

export function loadPlan(): PlanId {
  if (typeof window === "undefined") return "free";
  try {
    return (localStorage.getItem(KEY) as PlanId) || "free";
  } catch {
    return "free";
  }
}

export function setPlan(id: PlanId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
}

export function fmtRub(n: number): string {
  return n === 0 ? "0 ₽" : n.toLocaleString("ru-RU") + " ₽";
}
