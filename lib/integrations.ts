// Каталог интеграций: платёжные системы и внешние сервисы.

export type IntegrationCategory = "payment" | "crm" | "other";

export type IntegrationField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean; // маскировать значение
  hint?: string;
  optional?: boolean;
};

export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  emoji: string;
  color: string;
  desc: string;
  fields: IntegrationField[];
  guide?: string[]; // короткая инструкция «где взять данные»
  docsUrl?: string;
};

export const INTEGRATIONS: Integration[] = [
  // Платёжные системы
  {
    id: "yookassa", name: "ЮKassa", category: "payment", emoji: "💳", color: "#1a1a2e",
    desc: "Приём оплаты картами, СБП и кошельками.",
    fields: [
      { key: "shopId", label: "shopId (идентификатор магазина)", placeholder: "123456" },
      { key: "secretKey", label: "Секретный ключ", placeholder: "live_AbC...", secret: true },
    ],
    guide: [
      "Войдите в личный кабинет ЮKassa → «Настройки» → «Магазин».",
      "Скопируйте shopId и выпустите секретный ключ в разделе «API-ключи».",
      "Вставьте оба значения сюда. Для боевых платежей нужен live-ключ.",
    ],
    docsUrl: "https://yookassa.ru/developers",
  },
  {
    id: "yoomoney", name: "ЮMoney", category: "payment", emoji: "🟡", color: "#8b3ffd",
    desc: "Кошелёк ЮMoney для приёма платежей.",
    fields: [
      { key: "wallet", label: "Номер кошелька", placeholder: "4100 1XXX XXXX" },
      { key: "token", label: "API-токен", placeholder: "410011...", secret: true },
    ],
    guide: [
      "Откройте yoomoney.ru → «Настройки» → «Для разработчиков».",
      "Выпустите токен приложения с правом на приём переводов.",
    ],
  },
  {
    id: "qiwi", name: "Qiwi", category: "payment", emoji: "🥝", color: "#ff8c00",
    desc: "Оплата через Qiwi-кошелёк.",
    fields: [{ key: "token", label: "Секретный токен", placeholder: "eyJ2...", secret: true }],
    guide: ["Получите приватный токен в личном кабинете Qiwi Кассы (p2p.qiwi.com)."],
  },
  {
    id: "tgpay", name: "Telegram Payments", category: "payment", emoji: "✈️", color: "#2aabee",
    desc: "Нативная оплата внутри Telegram.",
    fields: [{ key: "providerToken", label: "Токен провайдера", placeholder: "284685063:TEST:...", secret: true }],
    guide: [
      "Откройте @BotFather → /mybots → ваш бот → Payments.",
      "Подключите провайдера (например ЮKassa) и скопируйте выданный токен провайдера.",
    ],
  },
  {
    id: "prodamus", name: "Prodamus", category: "payment", emoji: "🧾", color: "#00b956",
    desc: "Платёжная форма Prodamus.",
    fields: [
      { key: "formUrl", label: "Ссылка на форму", placeholder: "https://shop.payform.ru" },
      { key: "secretKey", label: "Секретный ключ", placeholder: "", secret: true },
    ],
    guide: ["Ссылка на форму и секретный ключ — в личном кабинете Prodamus → «Настройки»."],
  },
  {
    id: "tinkoff", name: "Тинькофф", category: "payment", emoji: "🟨", color: "#ffdd2d",
    desc: "Эквайринг Тинькофф Кассы.",
    fields: [
      { key: "terminalKey", label: "Terminal Key", placeholder: "1600000000" },
      { key: "password", label: "Пароль терминала", placeholder: "", secret: true },
    ],
    guide: ["Terminal Key и пароль — в личном кабинете Тинькофф Кассы → «Терминалы»."],
  },
  // CRM и сервисы
  {
    id: "amocrm", name: "amoCRM", category: "crm", emoji: "🟦", color: "#2a9df4",
    desc: "Создание сделок и контактов в amoCRM.",
    fields: [
      { key: "subdomain", label: "Поддомен", placeholder: "mycompany" },
      { key: "token", label: "Долгосрочный токен", placeholder: "", secret: true },
    ],
    guide: ["Создайте интеграцию в amoCRM → «Настройки» → «Интеграции» и выпустите долгосрочный токен."],
  },
  {
    id: "getcourse", name: "GetCourse", category: "crm", emoji: "🎓", color: "#1e8fff",
    desc: "Регистрация учеников и заказов.",
    fields: [
      { key: "account", label: "Аккаунт (домен)", placeholder: "school.getcourse.ru" },
      { key: "secretKey", label: "Секретный ключ", placeholder: "", secret: true },
    ],
    guide: ["Секретный ключ — в GetCourse → «Настройки аккаунта» → «API»."],
  },
  {
    id: "gsheets", name: "Google Таблицы", category: "other", emoji: "📊", color: "#22a06b",
    desc: "Запись данных в Google-таблицу.",
    fields: [
      { key: "sheetUrl", label: "Ссылка на таблицу", placeholder: "https://docs.google.com/spreadsheets/..." },
      { key: "serviceEmail", label: "E-mail сервисного аккаунта", placeholder: "bot@project.iam.gserviceaccount.com", optional: true },
    ],
    guide: ["Дайте доступ на редактирование таблицы сервисному аккаунту и вставьте ссылку на таблицу."],
  },
  {
    id: "bitrix", name: "Битрикс24", category: "crm", emoji: "🅱️", color: "#2fc6f6",
    desc: "Лиды и сделки в Битрикс24.",
    fields: [{ key: "webhookUrl", label: "Вебхук-URL", placeholder: "https://xxx.bitrix24.ru/rest/1/xxxx/", secret: true }],
    guide: ["Создайте входящий вебхук в Битрикс24 → «Разработчикам» → «Другое» → «Входящий вебхук»."],
  },
];

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  payment: "Платёжные системы",
  crm: "CRM",
  other: "Сервисы",
};

// Провайдеры для кнопки «Создать платёж».
export const PAYMENT_PROVIDERS = INTEGRATIONS.filter((i) => i.category === "payment");

const KEY = "sb_integrations"; // список подключённых id (обратная совместимость)
const CFG = "sb_integrations_cfg"; // сохранённые значения полей по id

export function loadConfigs(): Record<string, Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CFG);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getConfig(id: string): Record<string, string> {
  return loadConfigs()[id] || {};
}

// Подключено = сохранён конфиг со всеми обязательными полями.
export function isConnected(id: string): boolean {
  const integ = INTEGRATIONS.find((i) => i.id === id);
  const cfg = getConfig(id);
  if (!integ) return false;
  return integ.fields.filter((f) => !f.optional).every((f) => (cfg[f.key] || "").trim().length > 0);
}

export function loadConnected(): string[] {
  const cfgs = loadConfigs();
  return Object.keys(cfgs).filter((id) => isConnected(id));
}

export function saveConfig(id: string, values: Record<string, string>) {
  const cfgs = loadConfigs();
  cfgs[id] = values;
  try {
    localStorage.setItem(CFG, JSON.stringify(cfgs));
    localStorage.setItem(KEY, JSON.stringify(Object.keys(cfgs).filter((k) => isConnected(k))));
  } catch {}
}

export function disconnectIntegration(id: string) {
  const cfgs = loadConfigs();
  delete cfgs[id];
  try {
    localStorage.setItem(CFG, JSON.stringify(cfgs));
    localStorage.setItem(KEY, JSON.stringify(Object.keys(cfgs).filter((k) => isConnected(k))));
  } catch {}
}

// Оставлено для обратной совместимости (не используется в новом UI).
export function toggleConnected(id: string): string[] {
  const cur = loadConnected();
  if (cur.includes(id)) disconnectIntegration(id);
  return loadConnected();
}
