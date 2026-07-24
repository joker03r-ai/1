// Команда кабинета и доступы к чатам.
// Роли: owner (владелец), admin (администратор), operator (оператор).
// Владелец и админ видят все чаты; оператор — только те, к которым открыт доступ.

export type Role = "owner" | "admin" | "operator";

export type Member = {
  id: string;
  name: string;
  username?: string; // @ в Telegram
  role: Role;
  chatAccess: string[]; // id чатов, доступных оператору (для owner/admin игнорируется)
  addedAt: number;
  avatar?: string; // выбранная аватарка (эмодзи из AVATARS) — иначе инициалы
};

// Максимум участников команды.
export const TEAM_LIMIT = 10;

// Набор аккуратных аватарок на выбор (эмодзи на цветном градиенте).
export const AVATARS = [
  "🦊", "🐼", "🐨", "🦁", "🐯", "🐵", "🐸", "🐧", "🦉", "🐺",
  "🦄", "🐱", "🐶", "🐰", "🐻", "🐤", "🦝", "🐙", "🐬", "🦕",
];
// Градиент фона под аватарку — стабильно по эмодзи.
export const AVATAR_GRADS = [
  "linear-gradient(135deg,#7b6cf6,#9b8cff)", "linear-gradient(135deg,#3b82f6,#60a5fa)",
  "linear-gradient(135deg,#10b981,#34d399)", "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#ec4899,#f472b6)", "linear-gradient(135deg,#06b6d4,#22d3ee)",
  "linear-gradient(135deg,#ef4444,#f87171)", "linear-gradient(135deg,#8b5cf6,#a78bfa)",
];
export function avatarGrad(seed: string): string {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADS[h % AVATAR_GRADS.length];
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Владелец",
  admin: "Администратор",
  operator: "Оператор",
};

export const ROLE_HINTS: Record<Role, string> = {
  owner: "Полный доступ, управляет командой и доступами",
  admin: "Видит все чаты, может выдавать доступы",
  operator: "Видит только открытые ему чаты",
};

const KEY = "sb_team";
const CUR = "sb_team_current";

const SEED: Member[] = [
  { id: "me", name: "Вы", username: "@you", role: "owner", chatAccess: [], addedAt: Date.now() },
  { id: "t_anna", name: "Анна Ким", username: "@anna_kim", role: "admin", chatAccess: [], addedAt: Date.now() },
  { id: "t_petr", name: "Пётр Смирнов", username: "@petr_s", role: "operator", chatAccess: [], addedAt: Date.now() },
];

export function loadTeam(): Member[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    return JSON.parse(raw) as Member[];
  } catch {
    return SEED;
  }
}

export function saveTeam(list: Member[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function tid(prefix = "t"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 8);
}

export function addMember(m: Omit<Member, "id" | "addedAt">): Member | null {
  const list = loadTeam();
  if (list.length >= TEAM_LIMIT) return null; // достигнут лимит команды
  const member: Member = { ...m, id: tid(), addedAt: Date.now() };
  saveTeam([...list, member]);
  return member;
}

export function updateMember(id: string, patch: Partial<Member>) {
  saveTeam(loadTeam().map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

export function removeMember(id: string) {
  saveTeam(loadTeam().filter((m) => m.id !== id));
  if (getCurrentId() === id) setCurrentId("me");
}

export function getCurrentId(): string {
  if (typeof window === "undefined") return "me";
  return localStorage.getItem(CUR) || "me";
}

export function setCurrentId(id: string) {
  try {
    localStorage.setItem(CUR, id);
  } catch {}
}

export function currentMember(team: Member[]): Member {
  const id = getCurrentId();
  return team.find((m) => m.id === id) || team[0];
}

export function canSeeAll(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function canManage(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function memberCanSeeChat(m: Member, chatId: string): boolean {
  return canSeeAll(m.role) || m.chatAccess.includes(chatId);
}

// Переключить доступ оператора к конкретному чату.
export function toggleChatAccess(memberId: string, chatId: string) {
  const team = loadTeam().map((m) => {
    if (m.id !== memberId) return m;
    const has = m.chatAccess.includes(chatId);
    return {
      ...m,
      chatAccess: has ? m.chatAccess.filter((c) => c !== chatId) : [...m.chatAccess, chatId],
    };
  });
  saveTeam(team);
}
