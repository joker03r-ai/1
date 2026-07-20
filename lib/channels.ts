// Каналы подключения бота: мессенджеры и соцсети (напрямую и через
// коннекторы JivoChat / Wazzup24). Данные хранятся в localStorage.

export type ChannelGroup = "direct" | "jivochat" | "wazzup24";

export type Platform = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  group: ChannelGroup;
  isNew?: boolean;
  // Поле для подключения (обычно токен/ссылка). Для Telegram — токен бота.
  connectLabel?: string;
  connectPlaceholder?: string;
  guide?: string;
};

export const GROUP_LABELS: Record<ChannelGroup, string> = {
  direct: "Создать канал для",
  jivochat: "Подключить через JivoChat",
  wazzup24: "Подключить через Wazzup24",
};

export const PLATFORMS: Platform[] = [
  // Напрямую
  { id: "tg", label: "Telegram", emoji: "✈️", color: "#2aabee", group: "direct", connectLabel: "Токен бота", connectPlaceholder: "123456:AA...", guide: "Токен бота — у @BotFather → /newbot." },
  { id: "vk", label: "ВКонтакте", emoji: "🆚", color: "#0077ff", group: "direct", connectLabel: "Ключ доступа сообщества", connectPlaceholder: "vk1.a...", guide: "Управление сообществом → Работа с API → Ключ доступа." },
  { id: "wa", label: "WhatsApp", emoji: "💬", color: "#25d366", group: "direct", connectLabel: "Токен доступа", connectPlaceholder: "" },
  { id: "ok", label: "Одноклассники", emoji: "🟠", color: "#ee8208", group: "direct", connectLabel: "Токен группы", connectPlaceholder: "" },
  { id: "viber", label: "Viber", emoji: "🟣", color: "#7360f2", group: "direct", connectLabel: "Токен паблик-аккаунта", connectPlaceholder: "" },
  { id: "avito", label: "Avito", emoji: "🅰️", color: "#00aa00", group: "direct", isNew: true, connectLabel: "Client ID / Secret", connectPlaceholder: "" },
  { id: "web", label: "Веб-виджет", emoji: "🌐", color: "#6c5ce7", group: "direct", isNew: true, connectLabel: "Домен сайта", connectPlaceholder: "example.com" },

  // Через JivoChat
  { id: "jivo-tg", label: "Telegram", emoji: "✈️", color: "#2aabee", group: "jivochat", connectLabel: "JivoChat токен", connectPlaceholder: "" },
  { id: "jivo-vk", label: "ВКонтакте", emoji: "🆚", color: "#0077ff", group: "jivochat", connectLabel: "JivoChat токен", connectPlaceholder: "" },
  { id: "jivo-viber", label: "Viber", emoji: "🟣", color: "#7360f2", group: "jivochat", connectLabel: "JivoChat токен", connectPlaceholder: "" },
  { id: "jivo-wa", label: "WhatsApp", emoji: "💬", color: "#25d366", group: "jivochat", connectLabel: "JivoChat токен", connectPlaceholder: "" },
  { id: "jivo-ig", label: "Instagram", emoji: "📷", color: "#e1306c", group: "jivochat", connectLabel: "JivoChat токен", connectPlaceholder: "" },
  { id: "jivo-avito", label: "Avito", emoji: "🅰️", color: "#00aa00", group: "jivochat", connectLabel: "JivoChat токен", connectPlaceholder: "" },
  { id: "jivo-fb", label: "Facebook", emoji: "📘", color: "#1877f2", group: "jivochat", connectLabel: "JivoChat токен", connectPlaceholder: "" },
  { id: "jivo-ok", label: "Одноклассники", emoji: "🟠", color: "#ee8208", group: "jivochat", connectLabel: "JivoChat токен", connectPlaceholder: "" },

  // Через Wazzup24
  { id: "wz-wa-api", label: "WhatsApp API", emoji: "💚", color: "#128c7e", group: "wazzup24", connectLabel: "Wazzup24 API-ключ", connectPlaceholder: "" },
  { id: "wz-wa", label: "WhatsApp", emoji: "💬", color: "#25d366", group: "wazzup24", connectLabel: "Wazzup24 API-ключ", connectPlaceholder: "" },
  { id: "wz-ig", label: "Instagram", emoji: "📷", color: "#e1306c", group: "wazzup24", connectLabel: "Wazzup24 API-ключ", connectPlaceholder: "" },
  { id: "wz-tg", label: "Telegram", emoji: "✈️", color: "#2aabee", group: "wazzup24", connectLabel: "Wazzup24 API-ключ", connectPlaceholder: "" },
  { id: "wz-avito", label: "Avito", emoji: "🅰️", color: "#00aa00", group: "wazzup24", connectLabel: "Wazzup24 API-ключ", connectPlaceholder: "" },
];

export type Channel = {
  id: string;
  platformId: string;
  name: string;
  token: string;
  scenarioId?: string;
  createdAt: number;
};

const KEY = "sb_channels";

export function loadChannels(): Channel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Channel[]) : [];
  } catch {
    return [];
  }
}

export function saveChannels(list: Channel[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function chid(): string {
  return "ch_" + Math.random().toString(36).slice(2, 9);
}

export function addChannel(ch: Omit<Channel, "id" | "createdAt">): Channel {
  const c: Channel = { ...ch, id: chid(), createdAt: Date.now() };
  saveChannels([...loadChannels(), c]);
  return c;
}

export function updateChannel(id: string, patch: Partial<Channel>) {
  saveChannels(loadChannels().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

export function removeChannel(id: string) {
  saveChannels(loadChannels().filter((c) => c.id !== id));
}

export function platformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}
