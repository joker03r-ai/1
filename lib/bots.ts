// Боты кабинета. Каждый бот — отдельный сценарий, площадка и ИИ-ассистент.

export type BotStatus = "active" | "draft" | "off";

export type Bot = {
  id: string;
  name: string;
  goal?: string;
  platform?: string;
  scenarioId?: string;
  status: BotStatus;
  createdAt: number;
  // Подключение Telegram: только безопасные метаданные (без самого токена).
  tgConnected?: boolean;
  tgUsername?: string;
};

export const STATUS_LABELS: Record<BotStatus, string> = {
  active: "активен",
  draft: "черновик",
  off: "отключён",
};

const KEY = "sb_bots";
const CUR = "sb_bot_current";

const SEED: Bot[] = [
  { id: "bot_default", name: "BotPilot AI", goal: "Консультировать", platform: "Telegram", status: "active", createdAt: Date.now() },
];

export function loadBots(): Bot[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const list = JSON.parse(raw) as Bot[];
    return list.length ? list : SEED;
  } catch {
    return SEED;
  }
}

export function saveBots(list: Bot[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function bid(): string {
  return "bot_" + Math.random().toString(36).slice(2, 9);
}

export function addBot(partial: Omit<Partial<Bot>, "id" | "createdAt">): Bot {
  const bot: Bot = {
    id: bid(),
    name: partial.name || "Новый бот",
    goal: partial.goal,
    platform: partial.platform,
    scenarioId: partial.scenarioId,
    status: partial.status || "active",
    createdAt: Date.now(),
    tgConnected: partial.tgConnected,
    tgUsername: partial.tgUsername,
  };
  saveBots([...loadBots(), bot]);
  setCurrentBotId(bot.id);
  return bot;
}

export function updateBot(id: string, patch: Partial<Bot>) {
  saveBots(loadBots().map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

export function removeBot(id: string) {
  const next = loadBots().filter((b) => b.id !== id);
  saveBots(next);
  if (getCurrentBotId() === id) setCurrentBotId(next[0]?.id || "");
}

export function getCurrentBotId(): string {
  if (typeof window === "undefined") return SEED[0].id;
  return localStorage.getItem(CUR) || loadBots()[0]?.id || "";
}

export function setCurrentBotId(id: string) {
  try {
    localStorage.setItem(CUR, id);
  } catch {}
}

export function currentBot(bots: Bot[]): Bot | undefined {
  const id = getCurrentBotId();
  return bots.find((b) => b.id === id) || bots[0];
}
