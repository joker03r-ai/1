// Серверная логика ответа AI-бота.
// Если задан ANTHROPIC_API_KEY — отвечает реальная модель Claude.
// Иначе включается умный демо-режим (mock) на данных обучения бота.

import { BotConfig, GOAL_LABELS } from "./types";
import { getModel } from "./models";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function buildSystemPrompt(bot: BotConfig): string {
  const goal = GOAL_LABELS[bot.goal];
  const parts = [
    `Ты — AI-ассистент компании, встроенный в чат-бота «${bot.name}».`,
    `Главная цель диалога: ${goal}.`,
    bot.goal === "get_phone"
      ? "Веди диалог так, чтобы вежливо получить номер телефона клиента для связи."
      : "Веди диалог так, чтобы максимально полезно проконсультировать клиента.",
    "",
    "БАЗА ЗНАНИЙ О КОМПАНИИ (отвечай строго на её основе):",
    bot.knowledge || "(база знаний не заполнена)",
  ];
  if (bot.extraContext.trim()) {
    parts.push("", "ДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ:", bot.extraContext);
  }
  if (bot.instruction.trim()) {
    parts.push("", "ИНСТРУКЦИЯ ПО ВЕДЕНИЮ ДИАЛОГА:", bot.instruction);
  }
  parts.push(
    "",
    "ПРАВИЛА:",
    "- Отвечай на русском, вежливо и по делу.",
    "- Не выдумывай фактов, которых нет в базе знаний. Если не знаешь — предложи связаться с оператором.",
    "- Не ищи информацию в интернете и не сообщай новости.",
    `- Если пользователь пишет слово-стоп «${bot.stopWord}» — не отвечай по теме, а сообщи, что передаёшь диалог оператору.`
  );
  return parts.join("\n");
}

// Проверка стоп-слова (передача оператору).
export function isStopWord(bot: BotConfig, text: string): boolean {
  const w = bot.stopWord.trim().toLowerCase();
  if (!w) return false;
  return text.trim().toLowerCase().includes(w);
}

export type AiOverride = { provider?: "builtin" | "anthropic" | "openai"; apiKey?: string; model?: string };

// Вызов нейросети: провайдер и ключ можно передать из настроек ассистента
// (override) или взять из переменных окружения сервера.
async function callProvider(bot: BotConfig, history: ChatMessage[], ov: AiOverride): Promise<string> {
  const system = buildSystemPrompt(bot);
  const msgs = history.map((m) => ({ role: m.role, content: m.content }));
  let provider: "anthropic" | "openai" = "anthropic";
  if (ov.provider === "openai") provider = "openai";
  else if (ov.provider === "anthropic") provider = "anthropic";
  else if (!process.env.ANTHROPIC_API_KEY && process.env.OPENAI_API_KEY) provider = "openai";

  if (provider === "openai") {
    const apiKey = ov.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Не указан ключ OpenAI");
    const model = ov.model || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: "system", content: system }, ...msgs] }),
    });
    if (!res.ok) { const d = await res.text().catch(() => ""); throw new Error(`OpenAI ${res.status}: ${d.slice(0, 200)}`); }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim() || "Извините, не удалось сформировать ответ.";
  }

  // Anthropic (по умолчанию)
  const apiKey = ov.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Не указан ключ Anthropic");
  const model = ov.model || process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 700, system, messages: msgs }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = Array.isArray(data.content) ? data.content.map((c: any) => c.text || "").join("") : "";
  return text.trim() || "Извините, не удалось сформировать ответ.";
}

// Демо-ответ без ключа: грубый поиск по базе знаний + скрипт по цели.
function mockReply(bot: BotConfig, history: ChatMessage[]): string {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const q = (lastUser?.content || "").toLowerCase();

  // Первое сообщение — приветствие менеджера.
  const isFirst = history.filter((m) => m.role === "user").length <= 1 && q.includes("/start");
  if (isFirst || !q) {
    return `Здравствуйте! Я ${bot.name}, виртуальный консультант компании. ${
      bot.goal === "get_phone"
        ? "Готов помочь и подобрать решение — подскажите ваш вопрос."
        : "Чем могу помочь?"
    }`;
  }

  // Простейший «RAG»: ищем предложения из базы знаний, где встречаются слова запроса.
  const sentences = bot.knowledge
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const words = q.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3);
  const scored = sentences
    .map((s) => {
      const sl = s.toLowerCase();
      const score = words.reduce((acc, w) => acc + (sl.includes(w) ? 1 : 0), 0);
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  let answer: string;
  if (scored.length) {
    answer = scored.slice(0, 2).map((x) => x.s).join(" ");
  } else {
    answer =
      "По вашему вопросу лучше уточнить детали. " +
      (bot.knowledge ? "Вот что я знаю о компании: " + sentences.slice(0, 1).join(" ") : "");
  }

  if (bot.goal === "get_phone") {
    answer += " Оставьте, пожалуйста, ваш номер телефона — менеджер свяжется с вами и подберёт решение.";
  }
  return answer.trim() || "Уточните, пожалуйста, ваш вопрос — я помогу.";
}

export async function generateReply(
  bot: BotConfig,
  history: ChatMessage[],
  override?: AiOverride
): Promise<{ reply: string; source: "claude" | "mock" | "operator" }> {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (lastUser && isStopWord(bot, lastUser.content)) {
    return { reply: "Хорошо, сейчас соединю с оператором :)", source: "operator" };
  }

  const ov = override || {};
  const hasUserKey = ov.provider && ov.provider !== "builtin" && !!ov.apiKey;
  const hasEnvKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;

  if (hasUserKey || (ov.provider !== "openai" && ov.provider !== "anthropic" && hasEnvKey) || (hasEnvKey && ov.provider === "builtin")) {
    try {
      const reply = await callProvider(bot, history, ov);
      return { reply, source: "claude" };
    } catch {
      return { reply: mockReply(bot, history), source: "mock" };
    }
  }
  return { reply: mockReply(bot, history), source: "mock" };
}

// Метаданные для UI (какая модель отображается).
export function modelLabel(bot: BotConfig): string {
  return getModel(bot.modelId).name;
}
