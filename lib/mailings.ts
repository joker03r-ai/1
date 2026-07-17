// Рассылки. Рассылка = сценарий, начинающийся с блока «Старт рассылки».

import { FlowNode, Edge, NODE_META, uid } from "./scenarios";

export type BroadcastStatus = "draft" | "scheduled" | "sent";

export const STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  sent: "Отправлена",
};

export type Broadcast = {
  id: string;
  name: string;
  allChannels: boolean;
  published: boolean;
  nodes: FlowNode[];
  edges: Edge[];
  updatedAt: number;
  // Параметры рассылки:
  status: BroadcastStatus;
  channel: string;
  audience: "all" | "list";
  recipients: number;
  scheduledAt?: string; // ISO — если запланирована
};

const KEY = "sb_broadcasts";

export function loadBroadcasts(): Broadcast[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Broadcast[]) : [];
  } catch {
    return [];
  }
}

export function saveBroadcasts(list: Broadcast[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function getBroadcast(id: string): Broadcast | undefined {
  return loadBroadcasts().find((b) => b.id === id);
}

export function upsertBroadcast(b: Broadcast) {
  const list = loadBroadcasts();
  const i = list.findIndex((x) => x.id === b.id);
  if (i >= 0) list[i] = b;
  else list.push(b);
  saveBroadcasts(list);
}

export function deleteBroadcast(id: string) {
  saveBroadcasts(loadBroadcasts().filter((b) => b.id !== id));
}

// Стартовый набор рассылки: «Старт рассылки» -> «Отправить сообщение».
export function starterBroadcast(name: string): Broadcast {
  const start: FlowNode = {
    id: uid(),
    kind: "event_broadcast_start",
    x: 200,
    y: 70,
    title: NODE_META.event_broadcast_start.label,
  };
  const msg: FlowNode = {
    id: uid(),
    kind: "action_message",
    x: 200,
    y: 280,
    title: NODE_META.action_message.label,
    text: "Привет из рассылки! Напоминаем о вебинаре сегодня в 19:00.",
  };
  return {
    id: uid("b"),
    name,
    allChannels: false,
    published: false,
    nodes: [start, msg],
    edges: [{ id: uid("e"), from: start.id, to: msg.id }],
    updatedAt: Date.now(),
    status: "draft",
    channel: "",
    audience: "all",
    recipients: 0,
  };
}
