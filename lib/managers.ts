// Менеджеры кабинета и каналы-адресаты для уведомлений о заявках.

export type Manager = {
  id: string;
  name: string;
  handle: string;
  admin?: boolean;
};

const KEY = "sb_managers";

const SEED: Manager[] = [
  { id: "m_admin", name: "Игорь (вы)", handle: "@raskatov", admin: true },
  { id: "m_anna", name: "Анна Ким", handle: "@anna_kim" },
  { id: "m_dev", name: "Отдел продаж", handle: "@sales_team" },
];

export function loadManagers(): Manager[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Manager[]) : SEED;
  } catch {
    return SEED;
  }
}

export function saveManagers(list: Manager[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function mid() {
  return "m_" + Math.random().toString(36).slice(2, 8);
}

// Каналы-адресаты (куда бот отправит уведомление). Могут быть с другим ботом.
export type NotifyChannel = { id: string; name: string; bot: string };

export const NOTIFY_CHANNELS: NotifyChannel[] = [
  { id: "all", name: "Отправить во все каналы", bot: "" },
  { id: "botpilot_pro", name: "BotPilot_PRO", bot: "Telegram" },
  { id: "trouble_shooter", name: "trouble_shooter", bot: "Telegram" },
];
