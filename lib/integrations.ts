// Каталог интеграций: платёжные системы и внешние сервисы.

export type IntegrationCategory = "payment" | "crm" | "other";

export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  emoji: string;
  color: string;
  desc: string;
};

export const INTEGRATIONS: Integration[] = [
  // Платёжные системы
  { id: "yookassa", name: "ЮKassa", category: "payment", emoji: "💳", color: "#1a1a2e", desc: "Приём оплаты картами, СБП и кошельками." },
  { id: "yoomoney", name: "ЮMoney", category: "payment", emoji: "🟡", color: "#8b3ffd", desc: "Кошелёк ЮMoney для приёма платежей." },
  { id: "qiwi", name: "Qiwi", category: "payment", emoji: "🥝", color: "#ff8c00", desc: "Оплата через Qiwi-кошелёк." },
  { id: "tgpay", name: "Telegram Payments", category: "payment", emoji: "✈️", color: "#2aabee", desc: "Нативная оплата внутри Telegram." },
  { id: "prodamus", name: "Prodamus", category: "payment", emoji: "🧾", color: "#00b956", desc: "Платёжная форма Prodamus." },
  { id: "tinkoff", name: "Тинькофф", category: "payment", emoji: "🟨", color: "#ffdd2d", desc: "Эквайринг Тинькофф Кассы." },
  // CRM и сервисы
  { id: "amocrm", name: "amoCRM", category: "crm", emoji: "🟦", color: "#2a9df4", desc: "Создание сделок и контактов в amoCRM." },
  { id: "getcourse", name: "GetCourse", category: "crm", emoji: "🎓", color: "#1e8fff", desc: "Регистрация учеников и заказов." },
  { id: "gsheets", name: "Google Таблицы", category: "other", emoji: "📊", color: "#22a06b", desc: "Запись данных в Google-таблицу." },
  { id: "bitrix", name: "Битрикс24", category: "crm", emoji: "🅱️", color: "#2fc6f6", desc: "Лиды и сделки в Битрикс24." },
];

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  payment: "Платёжные системы",
  crm: "CRM",
  other: "Сервисы",
};

// Провайдеры для кнопки «Создать платёж».
export const PAYMENT_PROVIDERS = INTEGRATIONS.filter((i) => i.category === "payment");

const KEY = "sb_integrations";

export function loadConnected(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleConnected(id: string): string[] {
  const cur = loadConnected();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}
