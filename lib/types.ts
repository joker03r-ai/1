// Общие типы конфигурации AI-бота.

export type BotGoal = "consult" | "get_phone";

export type BotConfig = {
  id: string;
  name: string;
  modelId: string;
  goal: BotGoal;
  // Бриф: описание компании, товаров, скрипты для сотрудников — база знаний.
  knowledge: string;
  // Дополнительный контекст к сайту и документам.
  extraContext: string;
  // Инструкция: как вести диалог.
  instruction: string;
  sites: string[];
  documents: string[];
  showSources: boolean;
  // Слово, по которому бот останавливается и передаёт диалог оператору.
  stopWord: string;
  // Максимум сообщений AI в одном диалоге (0 — без лимита).
  maxMessages: number;
};

export const GOAL_LABELS: Record<BotGoal, string> = {
  consult: "Проконсультировать",
  get_phone: "Получить телефон",
};

export const DEFAULT_BOT: BotConfig = {
  id: "1",
  name: "Smartbot AI",
  modelId: "gpt-4o-mini",
  goal: "consult",
  knowledge:
    'Наша компания "Гранинг" находится в Лондоне и занимается производством дрелей. ' +
    "Мы помогаем клиентам подобрать подходящую модель дрели под их задачи. " +
    "Работаем 24/7, отвечаем вежливо и по делу.",
  extraContext: "",
  instruction:
    "Ты — менеджер по продажам. Общайся вежливо и доброжелательно. " +
    "Отвечай только по теме компании и товаров. Если не знаешь ответа — предложи связаться с оператором. " +
    "Старайся мягко узнать номер телефона клиента для консультации.",
  sites: ["www.smartbotpro.ru"],
  documents: [],
  showSources: false,
  stopWord: "Оператор",
  maxMessages: 0,
};
