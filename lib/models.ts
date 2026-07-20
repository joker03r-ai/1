// Каталог AI-моделей и тарификация (как на вкладке «Баланс» в BotPilot AI).
// Цены — демонстрационные, в рублях за 1 млн токенов.

export type AiModel = {
  id: string;
  name: string;
  badge?: "Новинка" | "Хит" | "Дешевле";
  description: string;
  price: { incoming: number; outgoing: number; cached: number };
};

export const AI_MODELS: AiModel[] = [
  {
    id: "gpt-5-mini",
    name: "ChatGPT 5 mini",
    badge: "Новинка",
    description: "Быстрый и недорогой. Подходит для типовых консультаций и ответов по базе знаний.",
    price: { incoming: 15.5, outgoing: 73.12, cached: 1.95 },
  },
  {
    id: "gpt-5-nano",
    name: "ChatGPT 5 nano",
    badge: "Дешевле",
    description: "Самый экономичный вариант для простых сценариев и большого потока сообщений.",
    price: { incoming: 3.1, outgoing: 24.9, cached: 0.4 },
  },
  {
    id: "gpt-5",
    name: "ChatGPT 5",
    badge: "Хит",
    description: "Флагман для сложных диалогов, где важно качество и точность ответов.",
    price: { incoming: 121.86, outgoing: 408.75, cached: 7.31 },
  },
  {
    id: "gpt-4-1",
    name: "ChatGPT 4.1",
    description: "Универсальная модель с хорошим балансом цены и качества.",
    price: { incoming: 198, outgoing: 792, cached: 46.75 },
  },
  {
    id: "gpt-4o-mini",
    name: "ChatGPT 4o mini",
    description: "Проверенная временем модель для консультаций и приёма контактов.",
    price: { incoming: 12.3, outgoing: 49.2, cached: 6.15 },
  },
];

export const DEFAULT_MODEL_ID = "gpt-4o-mini";

export function getModel(id: string): AiModel {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[AI_MODELS.length - 1];
}
