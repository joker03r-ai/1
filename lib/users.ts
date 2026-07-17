// Пользователи, написавшие боту. Каждый хранит значения переменных.

export type BotUser = {
  id: string;
  name: string;
  username: string;
  channel: "Telegram" | "ВКонтакте" | "WhatsApp" | "Сайт";
  firstSeen: string; // дата
  values: Record<string, string>; // значения переменных по имени
};

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
