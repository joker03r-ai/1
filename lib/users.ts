// Пользователи, написавшие боту. Каждый хранит значения переменных.

export type BotUser = {
  id: string;
  name: string;
  username: string;
  channel: "Telegram" | "ВКонтакте" | "WhatsApp" | "Сайт";
  firstSeen: string; // дата
  values: Record<string, string>; // значения переменных по имени
  blocked?: boolean; // заблокирован администратором
};

// Детерминированный цвет аватара по имени — чтобы у каждого был стабильный оттенок.
const AVATAR_COLORS = ["#6c5ce7", "#2b6ef6", "#16a34a", "#ec4899", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ef4444"];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const KEY = "sb_users";

const SEED: BotUser[] = [
  { id: "u1", name: "Игорь Раскатов", username: "@raskatov", channel: "Telegram", firstSeen: "24.06", values: { Телефон: "89112223344" } },
  { id: "u2", name: "Анна Ким", username: "@anna_kim", channel: "ВКонтакте", firstSeen: "24.06", values: { Телефон: "89055671020" } },
  { id: "u3", name: "Дмитрий Волков", username: "@dvolkov", channel: "Telegram", firstSeen: "23.06", values: {} },
  { id: "u4", name: "Мария П.", username: "maria_p", channel: "WhatsApp", firstSeen: "23.06", values: { Телефон: "89261234567" } },
  { id: "u5", name: "Гость", username: "site-8842", channel: "Сайт", firstSeen: "22.06", values: {} },
];

export function loadUsers(): BotUser[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BotUser[]) : SEED;
  } catch {
    return SEED;
  }
}

export function saveUsers(list: BotUser[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}
