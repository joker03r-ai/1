// Мини-i18n: словарь ключевых надписей интерфейса (навигация, шапка, настройки).
// Полный перевод всех экранов подключается постепенно.

import { Lang, loadLang } from "./appPrefs";

type Dict = Record<string, { ru: string; en: string }>;

export const STR: Dict = {
  "nav.bots": { ru: "BotPilot AI", en: "BotPilot AI" },
  "nav.scenarios": { ru: "Сценарии", en: "Scenarios" },
  "nav.nocode": { ru: "Nocode Cloud", en: "Nocode Cloud" },
  "nav.mailings": { ru: "Рассылки", en: "Broadcasts" },
  "nav.chats": { ru: "Чаты", en: "Chats" },
  "nav.parser": { ru: "Продвижение", en: "Promotion" },
  "nav.users": { ru: "Пользователи", en: "Users" },
  "nav.shops": { ru: "Магазины", en: "Shops" },
  "nav.stats": { ru: "Статистика", en: "Statistics" },
  "nav.integrations": { ru: "Интеграции", en: "Integrations" },
  "nav.channels": { ru: "Каналы", en: "Channels" },
  "nav.docs": { ru: "Документация", en: "Documentation" },

  "brand.trial": { ru: "🎁 Пробный период", en: "🎁 Free trial" },
  "brand.trialLeft": { ru: "Осталось 7 дней · все функции", en: "7 days left · all features" },
  "brand.choosePlan": { ru: "Выбрать тариф", en: "Choose a plan" },
  "brand.orderBot": { ru: "Заказать бота", en: "Order a bot" },
  "brand.partners": { ru: "Партнёры", en: "Partners" },

  "settings.title": { ru: "Настройки", en: "Settings" },
  "settings.theme": { ru: "Цветовая гамма", en: "Color theme" },
  "settings.language": { ru: "Язык", en: "Language" },
  "settings.done": { ru: "Готово", en: "Done" },
};

export function t(key: string, lang?: Lang): string {
  const l = lang || loadLang();
  const e = STR[key];
  if (!e) return key;
  return e[l] || e.ru;
}
