// Мини-i18n: словарь ключевых надписей интерфейса (навигация, шапка, настройки).
// Полный перевод всех экранов подключается постепенно.

import { Lang, loadLang } from "./appPrefs";

type Dict = Record<string, { ru: string; en: string }>;

export const STR: Dict = {
  "nav.home": { ru: "Главная", en: "Home" },
  "nav.bots": { ru: "Мои боты", en: "My bots" },
  "nav.scenarios": { ru: "Сценарии", en: "Scenarios" },
  "nav.assistant": { ru: "ИИ-ассистент", en: "AI assistant" },
  "nav.clients": { ru: "Клиенты", en: "Clients" },
  "nav.promo": { ru: "Рассылки и продвижение", en: "Broadcasts & promotion" },
  "nav.analytics": { ru: "Аналитика", en: "Analytics" },
  "nav.team": { ru: "Команда", en: "Team" },
  "nav.settings": { ru: "Настройки", en: "Settings" },
  "nav.help": { ru: "Помощь", en: "Help" },

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

  "brand.createAi": { ru: "Создать бота с помощью ИИ", en: "Create a bot with AI" },

  "brand.trial": { ru: "🎁 Пробный период", en: "🎁 Free trial" },
  "brand.trialLeft": { ru: "Осталось 7 дней · все функции", en: "7 days left · all features" },
  "brand.choosePlan": { ru: "Выбрать тариф", en: "Choose a plan" },
  "brand.orderBot": { ru: "Заказать бота", en: "Order a bot" },
  "brand.partners": { ru: "Партнёры", en: "Partners" },

  "settings.title": { ru: "Настройки", en: "Settings" },
  "settings.theme": { ru: "Цветовая гамма", en: "Color theme" },
  "settings.mode": { ru: "Оформление", en: "Appearance" },
  "settings.light": { ru: "Светлое", en: "Light" },
  "settings.dark": { ru: "Тёмное", en: "Dark" },
  "settings.language": { ru: "Язык", en: "Language" },
  "settings.done": { ru: "Готово", en: "Done" },

  "partners.title": { ru: "Партнёрская программа", en: "Partner program" },
  "partners.lead": {
    ru: "Приглашайте клиентов и получайте 30% от каждой их оплаты — пожизненно.",
    en: "Invite clients and earn 30% of every payment they make — for life.",
  },
  "partners.yourLink": { ru: "Ваша реферальная ссылка", en: "Your referral link" },
  "partners.copy": { ru: "Копировать", en: "Copy" },
  "partners.copied": { ru: "Скопировано ✓", en: "Copied ✓" },
  "partners.commission": { ru: "Комиссия", en: "Commission" },
  "partners.invited": { ru: "Приглашено", en: "Invited" },
  "partners.earned": { ru: "Заработано", en: "Earned" },
  "partners.how": { ru: "Как это работает", en: "How it works" },
  "partners.step1": {
    ru: "Отправьте свою ссылку клиенту или разместите её на сайте.",
    en: "Send your link to a client or post it on your website.",
  },
  "partners.step2": {
    ru: "Клиент регистрируется и оплачивает любой тариф.",
    en: "The client registers and pays for any plan.",
  },
  "partners.step3": {
    ru: "Вы получаете 30% на баланс с каждой его оплаты — навсегда.",
    en: "You get 30% on your balance from each of their payments — forever.",
  },
  "partners.close": { ru: "Закрыть", en: "Close" },

  "order.title": { ru: "Заказать бота под ключ", en: "Order a custom bot" },
  "order.lead": {
    ru: "Наша команда соберёт бота под вашу задачу: сценарии, интеграции, оплату и рассылки. Оставьте контакт — свяжемся в течение дня.",
    en: "Our team will build a bot for your task: scenarios, integrations, payments and broadcasts. Leave a contact — we'll reach out within a day.",
  },
  "order.contact": { ru: "Telegram или e-mail для связи", en: "Telegram or e-mail to contact you" },
  "order.task": { ru: "Коротко опишите задачу", en: "Briefly describe the task" },
  "order.send": { ru: "Отправить заявку", en: "Send request" },
  "order.sent": { ru: "Заявка отправлена — мы свяжемся с вами!", en: "Request sent — we'll contact you!" },
};

export function t(key: string, lang?: Lang): string {
  const l = lang || loadLang();
  const e = STR[key];
  if (!e) return key;
  return e[l] || e.ru;
}
