// AI-генератор сценариев: по текстовому запросу собирает граф блоков.
// С ключом ANTHROPIC_API_KEY использует Claude, иначе — эвристический mock.

import {
  FlowNode,
  Edge,
  NodeKind,
  NODE_META,
  MatchMode,
  RandomVariant,
  uid,
} from "./scenarios";
import { layoutFlow } from "./layout";

export type GenGraph = { name: string; nodes: FlowNode[]; edges: Edge[] };

const ALLOWED_KINDS: NodeKind[] = [
  "event_start",
  "event_message",
  "event_comment",
  "action_message",
  "action_process",
  "action_set_var",
  "action_manager",
  "action_gsheet",
  "action_stat",
  "action_random",
  "logic_subscribe",
  "action_ai",
  "condition",
];

function systemPrompt(): string {
  return [
    "Ты — конструктор диалоговых сценариев для чат-ботов BotPilot.",
    "По запросу пользователя собери сценарий как граф блоков и верни СТРОГО валидный JSON без пояснений и markdown.",
    "",
    "Формат ответа:",
    '{ "name": "короткое название", "nodes": [ {"id":"n1","kind":"...", ...поля}, ... ], "edges": [ {"from":"n1","to":"n2"}, ... ] }',
    "",
    "Доступные типы блоков (kind) и их поля:",
    "- event_start — старт бота (/start). Событие, с которого начинается диалог.",
    "- event_message — сообщение от пользователя. Поля: text (фраза-триггер), match ('similar'|'equals'|'contains').",
    "- event_comment — новый комментарий под постом. Поля: text.",
    "- action_message — отправить сообщение. Поля: text. Может иметь buttons: [{label}].",
    "- action_process — обработать/сохранить ответ. Поля: varName, useTemplate(bool), format('phone'|'email'|'number'|'any').",
    "- action_set_var — установить переменную. Поля: varName, varValue (можно '{{ %Var% + 1 }}').",
    "- action_manager — написать менеджеру. Поля: text (можно %Переменная%).",
    "- action_gsheet — добавить строку в Google Таблицу.",
    "- action_stat — записать метку в статистику. Поля: statLabel.",
    "- action_random — случайная ветка. Поля: variants: [{percent}].",
    "- logic_subscribe — проверка подписки. Два выхода (подписан/нет).",
    "- action_ai — передать диалог AI-боту (ответ по базе знаний).",
    "- condition — условие. Поля: text, match.",
    "",
    "Правила:",
    "- Начинай с event_start (и при необходимости event_message как второй триггер).",
    "- id — короткие уникальные строки (n1, n2, …). Позиции НЕ указывай.",
    "- edges связывают id блоков по порядку логики диалога.",
    "- Тексты сообщений — на русском, дружелюбные, по сути запроса.",
    "- Не больше 12 блоков. Верни ТОЛЬКО JSON.",
  ].join("\n");
}

function extractJson(text: string): any {
  let t = text.trim();
  // Убираем возможные ```json ... ```
  t = t.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

// Приводим сырой граф от модели к валидным нодам/связям.
function sanitize(raw: any): GenGraph {
  const name = typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : "Сценарий от ИИ";
  const idMap: Record<string, string> = {};
  const nodes: FlowNode[] = [];

  const rawNodes = Array.isArray(raw?.nodes) ? raw.nodes.slice(0, 12) : [];
  for (const rn of rawNodes) {
    const kind: NodeKind = ALLOWED_KINDS.includes(rn?.kind) ? rn.kind : "action_message";
    const id = uid();
    if (rn?.id) idMap[String(rn.id)] = id;
    const meta = NODE_META[kind];
    const node: FlowNode = { id, kind, x: 0, y: 0, title: meta.label };
    if (typeof rn?.text === "string") node.text = rn.text;
    if (kind === "event_message" || kind === "condition" || kind === "event_comment") {
      node.match = (["similar", "equals", "contains", "not_equals", "not_contains", "starts_with", "greater", "less"].includes(rn?.match) ? rn.match : "similar") as MatchMode;
      if (node.text === undefined) node.text = "";
    }
    if (kind === "action_process") {
      node.varName = typeof rn?.varName === "string" ? rn.varName : "Ответ";
      node.useTemplate = !!rn?.useTemplate;
      if (rn?.format) node.format = rn.format;
    }
    if (kind === "action_set_var") {
      node.varName = typeof rn?.varName === "string" ? rn.varName : "Переменная";
      node.varValue = typeof rn?.varValue === "string" ? rn.varValue : "";
    }
    if (kind === "action_stat") node.statLabel = typeof rn?.statLabel === "string" ? rn.statLabel : "Событие";
    if (kind === "logic_subscribe") node.channelTarget = "smartbot_pro";
    if (kind === "action_random") {
      const vs = Array.isArray(rn?.variants) && rn.variants.length ? rn.variants : [{}, {}];
      const each = Math.round((100 / vs.length) * 10) / 10;
      node.variants = vs.map((v: any): RandomVariant => ({ id: uid("v"), percent: typeof v?.percent === "number" ? v.percent : each }));
    }
    if (kind === "action_message" && Array.isArray(rn?.buttons)) {
      node.buttons = rn.buttons.slice(0, 6).map((b: any) => ({ id: uid("btn"), label: typeof b?.label === "string" ? b.label : (typeof b === "string" ? b : "Кнопка") }));
    }
    nodes.push(node);
  }

  const edges: Edge[] = [];
  const rawEdges = Array.isArray(raw?.edges) ? raw.edges : [];
  for (const re of rawEdges) {
    const from = idMap[String(re?.from)];
    const to = idMap[String(re?.to)];
    if (from && to && from !== to) edges.push({ id: uid("e"), from, to });
  }

  layout(nodes, edges);
  return { name, nodes, edges };
}

// Оценка высоты блока по типу (на сервере реальные размеры неизвестны).
// Значения откалиброваны по фактически отрисованным карточкам редактора.
function estHeight(n: FlowNode): number {
  switch (n.kind) {
    case "event_start":
      return 100;
    case "event_message":
    case "event_comment":
    case "condition":
      return 165;
    case "action_message": {
      let h = 255;
      if (n.buttons?.length) h += n.buttons.length * 40;
      return h;
    }
    case "action_process":
      return 265;
    case "action_set_var":
      return 200;
    case "action_gsheet":
    case "action_stat":
      return 160;
    case "action_manager":
      return 390;
    case "action_notify":
      return 260;
    case "action_random":
      return 150 + (n.variants?.length ?? 2) * 40;
    case "logic_subscribe":
      return 190;
    case "action_ai":
      return 130;
    default:
      return 200;
  }
}

// Древовидная раскладка — та же, что «Упорядочить» в редакторе.
function layout(nodes: FlowNode[], edges: Edge[]) {
  if (!nodes.length) return;
  const hById: Record<string, number> = {};
  nodes.forEach((n) => (hById[n.id] = estHeight(n)));
  const pos = layoutFlow(nodes, edges, (id) => hById[id] ?? 120, {
    nodeW: 250,
    hGap: 80,
    vGap: 90,
    startX: 160,
    startY: 60,
  });
  nodes.forEach((n) => {
    if (pos[n.id]) {
      n.x = pos[n.id].x;
      n.y = pos[n.id].y;
    }
  });
}

async function callClaude(prompt: string): Promise<GenGraph> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: systemPrompt(),
      messages: [{ role: "user", content: `Запрос: ${prompt}\n\nВерни только JSON.` }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const text = Array.isArray(data.content) ? data.content.map((c: any) => c.text || "").join("") : "";
  return sanitize(extractJson(text));
}

// Эвристический генератор без ключа: собирает разумный сценарий по ключевым словам.
function mockGraph(prompt: string): GenGraph {
  const p = prompt.toLowerCase();
  const N: any[] = [];
  const E: [string, string][] = [];
  const add = (kind: NodeKind, extra: any = {}) => {
    const id = "m" + (N.length + 1);
    N.push({ id, kind, ...extra });
    return id;
  };
  const link = (a: string, b: string) => E.push([a, b]);

  const start = add("event_start");
  const trigger = add("event_message", { text: "заявка", match: "similar" });
  const hello = add("action_message", { text: "Здравствуйте! Спасибо за интерес. Задайте вопрос или оставьте контакт — поможем." });
  link(start, hello);
  link(trigger, hello);

  let last = hello;

  const wantsAI = /ai|нейросеть|консультир|вопрос|поддержк|faq/.test(p);
  const wantsContact = /заявк|контакт|телефон|лид|вебинар|запис|заказ|оплат/.test(p);
  const wantsQuiz = /тест|викторин|балл|квиз/.test(p);
  const wantsSubscribe = /подписк|канал|бонус|лид-магнит|магнит/.test(p);

  if (wantsSubscribe) {
    const sub = add("logic_subscribe");
    link(last, sub);
    const bonus = add("action_message", { text: "Спасибо за подписку! 🎁 Ваш бонус: https://example.com/bonus" });
    const nosub = add("action_message", { text: "Похоже, вы ещё не подписаны. Подпишитесь и напишите снова 🙂" });
    link(sub, bonus);
    link(sub, nosub);
    last = bonus;
  }

  if (wantsContact) {
    const ask = add("action_message", { text: "Оставьте, пожалуйста, номер телефона — менеджер свяжется с вами." });
    const proc = add("action_process", { varName: "Телефон", useTemplate: true, format: "phone" });
    const sheet = add("action_gsheet");
    const mgr = add("action_manager", { text: "Новая заявка от %first_name% с телефоном %Телефон%." });
    const reply = add("action_message", { text: "Заявка принята! Мы свяжемся с вами в ближайшее время 🙌" });
    link(last, ask);
    link(ask, proc);
    link(proc, sheet);
    link(sheet, mgr);
    link(mgr, reply);
    last = reply;
  }

  if (wantsQuiz) {
    const reset = add("action_set_var", { varName: "Баллы", varValue: "0" });
    const q = add("action_message", { text: "Вопрос 1. Готовы начать тест?", buttons: [{ label: "Да" }, { label: "Нет" }] });
    const score = add("action_set_var", { varName: "Баллы", varValue: "{{ %Баллы% + 1 }}" });
    const result = add("action_message", { text: "Тест завершён! Ваш результат: %Баллы% баллов." });
    link(last, reset);
    link(reset, q);
    link(q, score);
    link(score, result);
    last = result;
  }

  if (wantsAI || (!wantsContact && !wantsQuiz && !wantsSubscribe)) {
    const ai = add("action_ai");
    link(last, ai);
  }

  const raw = {
    name: prompt.length > 40 ? prompt.slice(0, 38) + "…" : prompt || "Сценарий от ИИ",
    nodes: N,
    edges: E.map(([from, to]) => ({ from, to })),
  };
  return sanitize(raw);
}

export async function generateScenario(prompt: string): Promise<{ graph: GenGraph; source: "claude" | "mock" }> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { graph: await callClaude(prompt), source: "claude" };
    } catch {
      return { graph: mockGraph(prompt), source: "mock" };
    }
  }
  return { graph: mockGraph(prompt), source: "mock" };
}
