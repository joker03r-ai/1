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
};

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

export function addMember(m: Omit<Member, "id" | "addedAt">): Member {
  const member: Member = { ...m, id: tid(), addedAt: Date.now() };
  saveTeam([...loadTeam(), member]);
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
