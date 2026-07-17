// Модель визуальных сценариев (блок-схема диалога).

export type MatchMode =
  | "equals"
  | "not_equals"
  | "similar"
  | "contains"
  | "not_contains"
  | "starts_with";

export const MATCH_LABELS: Record<MatchMode, string> = {
  equals: "равно",
  not_equals: "не равно",
  similar: "похоже на",
  contains: "содержит",
  not_contains: "не содержит",
  starts_with: "начинается с",
};

export type NodeKind =
  | "event_start" // Первое сообщение и старт бота
  | "event_broadcast_start" // Старт рассылки
  | "event_message" // Сообщение от пользователя
  | "action_message" // Отправить сообщение
  | "action_process" // Обработать сообщение (сохранить в переменную)
  | "action_set_var" // Установить переменную
  | "action_notify" // Отправить уведомление
  | "action_manager" // Написать менеджеру
  | "action_gsheet" // Добавление строки в Google Таблицу
  | "action_ai" // Общение со Smartbot AI
  | "condition"; // Условие

export type FlowNode = {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  title: string;
  text?: string; // текст ответа / условия / сообщения пользователя
  match?: MatchMode; // режим сравнения для event_message / condition
  varName?: string; // переменная для action_process / action_set_var
  varValue?: string; // значение для action_set_var
  managers?: string[]; // id менеджеров для action_manager
  channelTarget?: string; // id канала-адресата для action_manager
  forwardUser?: boolean; // переслать сообщение пользователя (action_manager)
  useTemplate?: boolean; // проверка данных по шаблону (action_process)
  template?: string; // шаблон ответа, напр. Мой телефон «телефон»
  format?: DataFormat; // ожидаемый формат значения
  requestContact?: boolean; // кнопка «Отправить номер» (action_message)
  sheetUrl?: string; // ссылка на Google Таблицу (action_gsheet)
  buttons?: FlowButton[]; // кнопки-ответы (action_message)
  waitAnswer?: boolean; // «ждать ответы от пользователя» в этом блоке
};

// branch: "error" — выход при ошибке проверки данных (помечен «!»).
// fromButton: id кнопки-ответа, из которой выходит связь.
export type Edge = { id: string; from: string; to: string; branch?: "error"; fromButton?: string };

// Кнопка-ответ под сообщением (варианты ответа в тесте и т.п.).
export type FlowButton = { id: string; label: string };

export type DataFormat = "any" | "number" | "email" | "phone";

export const FORMAT_LABELS: Record<DataFormat, string> = {
  any: "любой",
  number: "число",
  email: "почта",
  phone: "телефон",
};

export type Scenario = {
  id: string;
  name: string;
  allChannels: boolean;
  published: boolean;
  nodes: FlowNode[];
  edges: Edge[];
  updatedAt: number;
};

export const NODE_META: Record<
  NodeKind,
  { label: string; color: string; icon: string; group: string }
> = {
  event_start: { label: "Первое сообщение и старт бота", color: "#22c55e", icon: "▶", group: "Событие" },
  event_broadcast_start: { label: "Старт рассылки", color: "#f97316", icon: "📣", group: "Событие" },
  event_message: { label: "Сообщение от пользователя", color: "#3b82f6", icon: "✉", group: "Событие" },
  action_message: { label: "Отправить сообщение", color: "#6c5ce7", icon: "✈", group: "Действие" },
  action_process: { label: "Обработать сообщение", color: "#0ea5e9", icon: "⤵", group: "Действие" },
  action_set_var: { label: "Установить переменную", color: "#14b8a6", icon: "(x)", group: "Действие" },
  action_notify: { label: "Отправить уведомление", color: "#ec4899", icon: "🔔", group: "Действие" },
  action_manager: { label: "Написать менеджеру", color: "#ef4444", icon: "🧑‍💼", group: "Действие" },
  action_gsheet: { label: "Добавление строки в Google Таблицу", color: "#22a06b", icon: "📊", group: "Интеграция" },
  action_ai: { label: "Общение со Smartbot AI", color: "#a855f7", icon: "🤖", group: "Действие" },
  condition: { label: "Условие", color: "#f59e0b", icon: "◈", group: "Условие" },
};

const KEY = "sb_scenarios";

export function loadScenarios(): Scenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Scenario[]) : [];
  } catch {
    return [];
  }
}

export function saveScenarios(list: Scenario[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function getScenario(id: string): Scenario | undefined {
  return loadScenarios().find((s) => s.id === id);
}

export function upsertScenario(s: Scenario) {
  const list = loadScenarios();
  const i = list.findIndex((x) => x.id === s.id);
  if (i >= 0) list[i] = s;
  else list.push(s);
  saveScenarios(list);
}

export function deleteScenario(id: string) {
  saveScenarios(loadScenarios().filter((s) => s.id !== id));
}

export function uid(prefix = "n"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// Стартовый набор блоков нового сценария (как в мини-курсе):
// «Первое сообщение и старт бота» + «Сообщение пользователя = привет» -> «Привет из бота!».
export function starterNodes(): { nodes: FlowNode[]; edges: Edge[] } {
  const start: FlowNode = {
    id: uid(),
    kind: "event_start",
    x: 120,
    y: 80,
    title: NODE_META.event_start.label,
  };
  const msg: FlowNode = {
    id: uid(),
    kind: "event_message",
    x: 460,
    y: 80,
    title: "Сообщение от пользователя",
    text: "привет",
    match: "similar",
  };
  const hello: FlowNode = {
    id: uid(),
    kind: "action_message",
    x: 290,
    y: 300,
    title: NODE_META.action_message.label,
    text: "Привет из бота!",
  };
  return {
    nodes: [start, msg, hello],
    edges: [
      { id: uid("e"), from: start.id, to: hello.id },
      { id: uid("e"), from: msg.id, to: hello.id },
    ],
  };
}

export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  uses: number;
  emoji: string;
};

export const TEMPLATE_CATEGORIES = [
  "Все",
  "Для магазина и кафе",
  "Для салонов и студий",
  "Для онлайн-школ",
  "SMM малого бизнеса",
  "Для HR",
  "Шаблоны AI-ботов",
  "Мои шаблоны",
];

export const TEMPLATES: Template[] = [
  { id: "santa", name: "Тайный Санта", category: "SMM малого бизнеса", description: "Отличный способ организовать Тайного Санту для небольшой компании.", uses: 691, emoji: "🎅" },
  { id: "amo-status", name: "AI-бот с изменением статуса в amoCRM", category: "Шаблоны AI-ботов", description: "Бот меняет статус сделки в amoCRM в зависимости от ответа клиента.", uses: 3095, emoji: "🔄" },
  { id: "leadmagnet", name: "Лид-магнит", category: "SMM малого бизнеса", description: "Выдаёт бонус за подписку и собирает контакт клиента.", uses: 402, emoji: "🧲" },
  { id: "ai-consult", name: "Консультация в режиме AI", category: "Шаблоны AI-ботов", description: "Используйте этот шаблон, чтобы AI консультировал клиентов 24/7.", uses: 1145, emoji: "💬" },
  { id: "sales-ai", name: "Продажи с помощью Smartbot AI", category: "Шаблоны AI-ботов", description: "Обрабатывает вопросы, консультирует и продаёт с помощью AI.", uses: 1650, emoji: "💸" },
  { id: "support-ai", name: "AI-бот тех. поддержки: сбор обращений", category: "Шаблоны AI-ботов", description: "Собирает обращения клиентов и передаёт оператору.", uses: 2661, emoji: "🎧" },
  { id: "onboarding", name: "Адаптация сотрудника", category: "Для HR", description: "Бот помогает адаптировать нового сотрудника и отвечает на вопросы.", uses: 1073, emoji: "🧑‍💼" },
  { id: "lead-ai", name: "Получение лида через Smartbot AI", category: "Шаблоны AI-ботов", description: "Бот собирает контакт и передаёт горячий лид менеджеру.", uses: 796, emoji: "🎯" },
  { id: "shop-order", name: "Приём заказов для магазина", category: "Для магазина и кафе", description: "Оформление заказа прямо в чате с уведомлением менеджеру.", uses: 1284, emoji: "🛒" },
  { id: "booking", name: "Запись в салон", category: "Для салонов и студий", description: "Запись клиентов на услугу с выбором даты и времени.", uses: 934, emoji: "📅" },
  { id: "school-lead", name: "Запись на пробный урок", category: "Для онлайн-школ", description: "Собирает заявки на пробный урок и напоминает о нём.", uses: 612, emoji: "🎓" },
  { id: "webinar-simple", name: "Простой сбор заявок", category: "SMM малого бизнеса", description: "Собирает заявки по слову «заявка», сохраняет контакт, пишет в Google Таблицу и уведомляет админа.", uses: 3410, emoji: "📝" },
  { id: "webinar-funnel", name: "Автоворонка для вебинара", category: "Для онлайн-школ", description: "Готовая воронка сбора заявок на вебинар с записью в таблицу и уведомлениями. Все переменные уже настроены.", uses: 2874, emoji: "🎥" },
  { id: "quiz-score", name: "Тест с набором баллов", category: "Для онлайн-школ", description: "Интерактивный тест: кнопки-ответы, начисление баллов за верные ответы и вывод результата.", uses: 1902, emoji: "🧠" },
];

// Собирает полный флоу для шаблона. Для вебинарных шаблонов —
// цепочка «заявка → приветствие → сохранить контакт → Google Таблица →
// уведомление админам → ответ клиенту» (как в мини-курсе).
export function buildTemplate(templateId: string): { nodes: FlowNode[]; edges: Edge[] } {
  if (templateId === "quiz-score") return buildQuizTemplate();
  if (templateId !== "webinar-simple" && templateId !== "webinar-funnel") {
    return starterNodes();
  }
  const startEvent: FlowNode = { id: uid(), kind: "event_start", x: 470, y: 40, title: "Первое сообщение и старт бота" };
  const zayavka: FlowNode = { id: uid(), kind: "event_message", x: 120, y: 40, title: "Если ввели «заявка»", text: "заявка", match: "contains" };
  const hello: FlowNode = { id: uid(), kind: "action_message", x: 120, y: 250, title: "Отправить сообщение", text: "Привет! Спасибо за интерес к нашему вебинару. Оставьте контакт — пришлём ссылку на трансляцию." };
  const save: FlowNode = { id: uid(), kind: "action_process", x: 120, y: 430, title: "Обработать сообщение", varName: "Контакт", useTemplate: false };
  const gsheet: FlowNode = { id: uid(), kind: "action_gsheet", x: 120, y: 610, title: "Добавление строки в Google Таблицу", sheetUrl: "" };
  const notify: FlowNode = { id: uid(), kind: "action_manager", x: 120, y: 820, title: "Написать менеджеру", text: "Поступила новая заявка от %first_name% (%Контакт%).", managers: [], channelTarget: "all", forwardUser: false };
  const reply: FlowNode = { id: uid(), kind: "action_message", x: 120, y: 1060, title: "Отправить сообщение", text: "Заявка принята! Ссылку на вебинар пришлём за 10 минут до старта. До встречи 🙌" };

  return {
    nodes: [startEvent, zayavka, hello, save, gsheet, notify, reply],
    edges: [
      { id: uid("e"), from: startEvent.id, to: hello.id },
      { id: uid("e"), from: zayavka.id, to: hello.id },
      { id: uid("e"), from: hello.id, to: save.id },
      { id: uid("e"), from: save.id, to: gsheet.id },
      { id: uid("e"), from: gsheet.id, to: notify.id },
      { id: uid("e"), from: notify.id, to: reply.id },
    ],
  };
}

// Шаблон «Тест с набором баллов»: событие «Тест» -> обнулить баллы ->
// вопрос с кнопками -> начислить балл за верный -> результат.
function buildQuizTemplate(): { nodes: FlowNode[]; edges: Edge[] } {
  const bRight: FlowButton = { id: uid("btn"), label: "Азот (~78%)" };
  const bWrong1: FlowButton = { id: uid("btn"), label: "Кислород (~78%)" };
  const bWrong2: FlowButton = { id: uid("btn"), label: "Углекислый газ" };

  const start: FlowNode = { id: uid(), kind: "event_message", x: 120, y: 40, title: "Если ввели «Тест»", text: "тест", match: "contains" };
  const reset: FlowNode = { id: uid(), kind: "action_set_var", x: 120, y: 230, title: "Установить переменную", varName: "Баллы", varValue: "0" };
  const q1: FlowNode = { id: uid(), kind: "action_message", x: 120, y: 430, title: "Отправить сообщение", text: "Вопрос 1. Из чего в основном состоит атмосфера Земли?", waitAnswer: true, buttons: [bRight, bWrong1, bWrong2] };
  const score: FlowNode = { id: uid(), kind: "action_set_var", x: 520, y: 430, title: "Установить переменную", varName: "Баллы", varValue: "{{ %Баллы% + 1 }}" };
  const correct: FlowNode = { id: uid(), kind: "action_message", x: 520, y: 660, title: "Отправить сообщение", text: "Верно! ✅ Правильный ответ — азот (~78%)." };
  const wrong: FlowNode = { id: uid(), kind: "action_message", x: 120, y: 720, title: "Отправить сообщение", text: "Неверно. Правильный ответ — азот (~78%)." };
  const result: FlowNode = { id: uid(), kind: "action_message", x: 300, y: 940, title: "Отправить сообщение", text: "Тест завершён! Ваш результат: %Баллы% из 1. Спасибо за участие 🙌" };

  return {
    nodes: [start, reset, q1, score, correct, wrong, result],
    edges: [
      { id: uid("e"), from: start.id, to: reset.id },
      { id: uid("e"), from: reset.id, to: q1.id },
      { id: uid("e"), from: q1.id, to: score.id, fromButton: bRight.id },
      { id: uid("e"), from: q1.id, to: wrong.id, fromButton: bWrong1.id },
      { id: uid("e"), from: q1.id, to: wrong.id, fromButton: bWrong2.id },
      { id: uid("e"), from: score.id, to: correct.id },
      { id: uid("e"), from: correct.id, to: result.id },
      { id: uid("e"), from: wrong.id, to: result.id },
    ],
  };
}
