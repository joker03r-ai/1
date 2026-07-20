// Модель визуальных сценариев (блок-схема диалога).

import { arrangeGraph } from "./layout";

export type MatchMode =
  | "equals"
  | "not_equals"
  | "similar"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "greater"
  | "less";

export const MATCH_LABELS: Record<MatchMode, string> = {
  equals: "равно",
  not_equals: "не равно",
  similar: "похоже на",
  contains: "содержит",
  not_contains: "не содержит",
  starts_with: "начинается с",
  greater: "больше",
  less: "меньше",
};

export type NodeKind =
  | "event_start" // Первое сообщение и старт бота
  | "event_broadcast_start" // Старт рассылки
  | "event_comment" // Новый комментарий
  | "event_message" // Сообщение от пользователя
  | "action_message" // Отправить сообщение
  | "action_process" // Обработать сообщение (сохранить в переменную)
  | "action_set_var" // Установить переменную
  | "action_notify" // Отправить уведомление
  | "action_manager" // Написать менеджеру
  | "action_gsheet" // Добавление строки в Google Таблицу
  | "action_stat" // Записать в статистику
  | "action_random" // Рандом (случайный выбор ветки)
  | "logic_subscribe" // Проверка подписки (подписан / не подписан)
  | "action_ai" // Общение со BotPilot AI
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
  contactVar?: string; // переменная для сохранения телефона из кнопки контакта
  sheetUrl?: string; // ссылка на Google Таблицу (action_gsheet)
  buttons?: FlowButton[]; // кнопки-ответы (action_message)
  waitAnswer?: boolean; // «ждать ответы от пользователя» в этом блоке
  statLabel?: string; // метка для action_stat
  postId?: string; // ID поста для event_comment (реагировать под конкретным постом)
  variants?: RandomVariant[]; // варианты блока «Рандом»
  alts?: string[]; // доп. фразы-условия «ИЛИ» (event_message / condition)
};

// branch: "error" — выход при ошибке проверки данных (помечен «!»).
// fromButton: id кнопки-ответа, из которой выходит связь.
export type Edge = { id: string; from: string; to: string; branch?: "error"; fromButton?: string };

// Кнопка-ответ под сообщением (варианты ответа в тесте и т.п.).
// type "payment" — кнопка «Создать платёж».
export type FlowButton = {
  id: string;
  label: string;
  type?: "normal" | "payment";
  amount?: string;
  purpose?: string;
  provider?: string;
};

// Вариант блока «Рандом» с вероятностью (%).
export type RandomVariant = { id: string; percent: number };

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
  // Порог совпадения для режима «Похоже на» (0..1, рекомендуется 0.4).
  similarityThreshold?: number;
  // Папка, в которой лежит сценарий (пусто — «Без папки»).
  folderId?: string;
};

export type ScenarioFolder = { id: string; name: string; createdAt: number };

export const NODE_META: Record<
  NodeKind,
  { label: string; color: string; icon: string; group: string }
> = {
  event_start: { label: "Первое сообщение и старт бота", color: "#22c55e", icon: "▶", group: "Событие" },
  event_broadcast_start: { label: "Старт рассылки", color: "#f97316", icon: "📣", group: "Событие" },
  event_comment: { label: "Новый комментарий", color: "#0ea5e9", icon: "💬", group: "Событие" },
  event_message: { label: "Сообщение от пользователя", color: "#3b82f6", icon: "✉", group: "Событие" },
  action_message: { label: "Отправить сообщение", color: "#6c5ce7", icon: "✈", group: "Действие" },
  action_process: { label: "Обработать сообщение", color: "#0ea5e9", icon: "⤵", group: "Действие" },
  action_set_var: { label: "Установить переменную", color: "#14b8a6", icon: "(x)", group: "Действие" },
  action_notify: { label: "Отправить уведомление", color: "#ec4899", icon: "🔔", group: "Действие" },
  action_manager: { label: "Написать менеджеру", color: "#ef4444", icon: "🧑‍💼", group: "Действие" },
  action_gsheet: { label: "Добавление строки в Google Таблицу", color: "#22a06b", icon: "📊", group: "Интеграция" },
  action_stat: { label: "Записать в статистику", color: "#0891b2", icon: "📈", group: "Действие" },
  action_random: { label: "Рандом", color: "#8b5cf6", icon: "🎲", group: "Условие" },
  logic_subscribe: { label: "Проверка подписки", color: "#16a34a", icon: "🔔", group: "Условие" },
  action_ai: { label: "Общение со BotPilot AI", color: "#a855f7", icon: "🤖", group: "Действие" },
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

// ===== Папки сценариев =====
const FKEY = "sb_scenario_folders";

export function loadFolders(): ScenarioFolder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FKEY);
    return raw ? (JSON.parse(raw) as ScenarioFolder[]) : [];
  } catch {
    return [];
  }
}

export function saveFolders(list: ScenarioFolder[]) {
  try {
    localStorage.setItem(FKEY, JSON.stringify(list));
  } catch {}
}

export function addFolder(name: string): ScenarioFolder {
  const f: ScenarioFolder = { id: uid("f"), name: name.trim() || "Новая папка", createdAt: Date.now() };
  saveFolders([...loadFolders(), f]);
  return f;
}

export function renameFolder(id: string, name: string) {
  saveFolders(loadFolders().map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)));
}

// Удаляет папку; сценарии из неё остаются, но становятся «Без папки».
export function deleteFolder(id: string) {
  saveFolders(loadFolders().filter((f) => f.id !== id));
  const scns = loadScenarios().map((s) => (s.folderId === id ? { ...s, folderId: undefined } : s));
  saveScenarios(scns);
}

export function moveScenarioToFolder(scenarioId: string, folderId?: string) {
  const scns = loadScenarios().map((s) => (s.id === scenarioId ? { ...s, folderId } : s));
  saveScenarios(scns);
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
  const nodes = [start, msg, hello];
  const edges = [
    { id: uid("e"), from: start.id, to: hello.id },
    { id: uid("e"), from: msg.id, to: hello.id },
  ];
  arrangeGraph(nodes, edges);
  return { nodes, edges };
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
  "Рецепты",
  "Мои шаблоны",
];

export const TEMPLATES: Template[] = [
  { id: "santa", name: "Тайный Санта", category: "SMM малого бизнеса", description: "Отличный способ организовать Тайного Санту для небольшой компании.", uses: 691, emoji: "🎅" },
  { id: "amo-status", name: "AI-бот с изменением статуса в amoCRM", category: "Шаблоны AI-ботов", description: "Бот меняет статус сделки в amoCRM в зависимости от ответа клиента.", uses: 3095, emoji: "🔄" },
  { id: "leadmagnet", name: "Лид-магнит за подписку", category: "Рецепты", description: "Проверяет подписку на канал/сообщество и выдаёт бонус подписчикам. Блок «Проверка подписки».", uses: 402, emoji: "🧲" },
  { id: "ai-consult", name: "Консультация в режиме AI", category: "Шаблоны AI-ботов", description: "Используйте этот шаблон, чтобы AI консультировал клиентов 24/7.", uses: 1145, emoji: "💬" },
  { id: "sales-ai", name: "Продажи с помощью BotPilot AI", category: "Шаблоны AI-ботов", description: "Обрабатывает вопросы, консультирует и продаёт с помощью AI.", uses: 1650, emoji: "💸" },
  { id: "support-ai", name: "AI-бот тех. поддержки: сбор обращений", category: "Шаблоны AI-ботов", description: "Собирает обращения клиентов и передаёт оператору.", uses: 2661, emoji: "🎧" },
  { id: "onboarding", name: "Адаптация сотрудника", category: "Для HR", description: "Бот помогает адаптировать нового сотрудника и отвечает на вопросы.", uses: 1073, emoji: "🧑‍💼" },
  { id: "lead-ai", name: "Получение лида через BotPilot AI", category: "Шаблоны AI-ботов", description: "Бот собирает контакт и передаёт горячий лид менеджеру.", uses: 796, emoji: "🎯" },
  { id: "shop-order", name: "Приём заказов для магазина", category: "Для магазина и кафе", description: "Оформление заказа прямо в чате с уведомлением менеджеру.", uses: 1284, emoji: "🛒" },
  { id: "booking", name: "Запись в салон", category: "Для салонов и студий", description: "Запись клиентов на услугу с выбором даты и времени.", uses: 934, emoji: "📅" },
  { id: "school-lead", name: "Запись на пробный урок", category: "Для онлайн-школ", description: "Собирает заявки на пробный урок и напоминает о нём.", uses: 612, emoji: "🎓" },
  { id: "webinar-simple", name: "Простой сбор заявок", category: "SMM малого бизнеса", description: "Собирает заявки по слову «заявка», сохраняет контакт, пишет в Google Таблицу и уведомляет админа.", uses: 3410, emoji: "📝" },
  { id: "webinar-funnel", name: "Автоворонка для вебинара", category: "Для онлайн-школ", description: "Готовая воронка сбора заявок на вебинар с записью в таблицу и уведомлениями. Все переменные уже настроены.", uses: 2874, emoji: "🎥" },
  { id: "quiz-score", name: "Тест с набором баллов", category: "Для онлайн-школ", description: "Интерактивный тест: кнопки-ответы, начисление баллов за верные ответы и вывод результата.", uses: 1902, emoji: "🧠" },
  { id: "comments-game", name: "Игра в комментариях", category: "Рецепты", description: "Бот отвечает на комментарии под постом случайным предсказанием. Реакция на «Новый комментарий» + блок «Рандом».", uses: 1567, emoji: "🎯" },
  { id: "faq", name: "Ответы на частые вопросы", category: "Шаблоны AI-ботов", description: "Готовые цепочки на частые вопросы: адрес, доставка, график, ассортимент, оплата. Режим «Похоже на» распознаёт смысл.", uses: 1234, emoji: "❓" },
  { id: "get-phone", name: "Получение телефона", category: "Рецепты", description: "Бот запрашивает телефон, проверяет формат и переспрашивает при ошибке. Кнопка «Отправить телефон» для Telegram.", uses: 2140, emoji: "📱" },
];

// Собирает полный флоу для шаблона. Для вебинарных шаблонов —
// цепочка «заявка → приветствие → сохранить контакт → Google Таблица →
// уведомление админам → ответ клиенту» (как в мини-курсе).
// Публичная сборка шаблона: строит граф и сразу аккуратно раскладывает его,
// чтобы сценарий открывался ровным, а не «разбросанным».
export function buildTemplate(templateId: string): { nodes: FlowNode[]; edges: Edge[] } {
  const g = buildTemplateRaw(templateId);
  arrangeGraph(g.nodes, g.edges);
  return g;
}

function buildTemplateRaw(templateId: string): { nodes: FlowNode[]; edges: Edge[] } {
  if (templateId === "quiz-score") return buildQuizTemplate();
  if (templateId === "comments-game") return buildCommentsGame();
  if (templateId === "faq") return buildFAQ();
  if (templateId === "get-phone") return buildGetPhone();
  if (templateId === "leadmagnet") return buildLeadMagnet();
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

// Рецепт «Игра в комментариях»: новый комментарий -> Рандом (4 по 25%) ->
// 4 случайных предсказания.
function buildCommentsGame(): { nodes: FlowNode[]; edges: Edge[] } {
  const v1: RandomVariant = { id: uid("v"), percent: 25 };
  const v2: RandomVariant = { id: uid("v"), percent: 25 };
  const v3: RandomVariant = { id: uid("v"), percent: 25 };
  const v4: RandomVariant = { id: uid("v"), percent: 25 };

  const comment: FlowNode = { id: uid(), kind: "event_comment", x: 120, y: 60, title: "Новый комментарий", text: "предсказание", match: "contains", postId: "" };
  const rnd: FlowNode = { id: uid(), kind: "action_random", x: 120, y: 300, title: "Рандом", variants: [v1, v2, v3, v4] };
  const predictions = [
    "В новом году вас ждёт удача! 🍀",
    "Скоро вас ждёт приятная новость 💌",
    "Смелый шаг приведёт к успеху 🚀",
    "Впереди — тёплая встреча со старым другом ☕",
  ];
  const msgNodes: FlowNode[] = predictions.map((t, i) => ({
    id: uid(),
    kind: "action_message" as const,
    x: 520,
    y: 120 + i * 180,
    title: "Отправить сообщение",
    text: t,
  }));

  const variants = [v1, v2, v3, v4];
  return {
    nodes: [comment, rnd, ...msgNodes],
    edges: [
      { id: uid("e"), from: comment.id, to: rnd.id },
      ...msgNodes.map((m, i) => ({ id: uid("e"), from: rnd.id, to: m.id, fromButton: variants[i].id })),
    ],
  };
}

// Рецепт «Ответы на частые вопросы»: несколько цепочек вопрос -> ответ,
// каждое событие в режиме «похоже на» с доп. формулировками «ИЛИ».
function buildFAQ(): { nodes: FlowNode[]; edges: Edge[] } {
  const faqs: { q: string; alts: string[]; a: string }[] = [
    { q: "адрес", alts: ["где вы находитесь", "как вас найти"], a: "Мы находимся по адресу: г. Москва, ул. Примерная, 1. Ждём вас!" },
    { q: "доставка", alts: ["есть ли доставка", "как заказать доставку"], a: "Да, доставляем по всему городу за 1–2 часа. Оформить можно прямо в чате." },
    { q: "график", alts: ["время работы", "во сколько открываетесь"], a: "Работаем ежедневно с 9:00 до 21:00." },
    { q: "ассортимент", alts: ["что у вас есть", "каталог"], a: "У нас широкий ассортимент — пришлём каталог, если интересно 🙂" },
    { q: "оплата", alts: ["как оплатить", "способы оплаты"], a: "Принимаем оплату картой, наличными и переводом. Оплатить можно при получении." },
  ];
  const nodes: FlowNode[] = [];
  const edges: Edge[] = [];
  faqs.forEach((f, i) => {
    const ev: FlowNode = { id: uid(), kind: "event_message", x: 120, y: 60 + i * 210, title: "Сообщение от пользователя", text: f.q, match: "similar", alts: f.alts };
    const ans: FlowNode = { id: uid(), kind: "action_message", x: 520, y: 60 + i * 210, title: "Отправить сообщение", text: f.a };
    nodes.push(ev, ans);
    edges.push({ id: uid("e"), from: ev.id, to: ans.id });
  });
  return { nodes, edges };
}

// Рецепт «Получение телефона»: запрос -> проверка формата -> сохранение,
// при ошибке переспросить (выход-ошибка возвращает на обработку).
function buildGetPhone(): { nodes: FlowNode[]; edges: Edge[] } {
  const start: FlowNode = { id: uid(), kind: "event_start", x: 300, y: 40, title: "Первое сообщение и старт бота" };
  const ask: FlowNode = { id: uid(), kind: "action_message", x: 300, y: 240, title: "Отправить сообщение", text: "Оставьте, пожалуйста, номер телефона — менеджер свяжется с вами.", requestContact: true, contactVar: "Телефон" };
  const process: FlowNode = { id: uid(), kind: "action_process", x: 300, y: 470, title: "Обработать сообщение", varName: "Телефон", useTemplate: true, template: "Мой телефон «телефон»", format: "phone" };
  const ok: FlowNode = { id: uid(), kind: "action_message", x: 620, y: 700, title: "Отправить сообщение", text: "Спасибо! Мы свяжемся с вами по номеру %Телефон%." };
  const err: FlowNode = { id: uid(), kind: "action_message", x: 60, y: 700, title: "Отправить сообщение", text: "Кажется, это не похоже на телефон. Введите номер ещё раз, пожалуйста." };

  return {
    nodes: [start, ask, process, ok, err],
    edges: [
      { id: uid("e"), from: start.id, to: ask.id },
      { id: uid("e"), from: ask.id, to: process.id },
      { id: uid("e"), from: process.id, to: ok.id },
      { id: uid("e"), from: process.id, to: err.id, branch: "error" },
      { id: uid("e"), from: err.id, to: process.id },
    ],
  };
}

// Рецепт «Лид-магнит за подписку»: проверка подписки на канал ->
// подписан -> бонус; не подписан -> просьба подписаться.
function buildLeadMagnet(): { nodes: FlowNode[]; edges: Edge[] } {
  const start: FlowNode = { id: uid(), kind: "event_start", x: 260, y: 40, title: "Первое сообщение и старт бота" };
  const check: FlowNode = { id: uid(), kind: "logic_subscribe", x: 260, y: 240, title: "Проверка подписки", channelTarget: "botpilot_pro" };
  const bonus: FlowNode = { id: uid(), kind: "action_message", x: 60, y: 490, title: "Отправить сообщение", text: "Спасибо за подписку! 🎁 Держите ваш бонус: https://example.com/lead-magnet.pdf" };
  const notsub: FlowNode = { id: uid(), kind: "action_message", x: 520, y: 490, title: "Отправить сообщение", text: "Ой, кажется, вы ещё не подписаны на канал. Подпишитесь и напишите снова 🙂" };
  return {
    nodes: [start, check, bonus, notsub],
    edges: [
      { id: uid("e"), from: start.id, to: check.id },
      { id: uid("e"), from: check.id, to: bonus.id },
      { id: uid("e"), from: check.id, to: notsub.id, branch: "error" },
    ],
  };
}
