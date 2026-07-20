// Статистика: метки (события в статистике) и демо-данные для графика.

export type StatLabel = { id: string; name: string; count: number };

const KEY = "sb_stat_labels";

// Метки создаются заранее, но счётчики начинаются с нуля — они растут только
// когда бот реально срабатывает на блоке «Записать в статистику».
const SEED: StatLabel[] = [
  { id: "sl_dialog", name: "Начал диалог", count: 0 },
  { id: "sl_phone", name: "Есть номер телефона", count: 0 },
  { id: "sl_quiz", name: "Прошёл тест", count: 0 },
  { id: "sl_lead", name: "Оставил заявку", count: 0 },
];

export function loadLabels(): StatLabel[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StatLabel[]) : SEED;
  } catch {
    return SEED;
  }
}

export function saveLabels(list: StatLabel[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function addLabel(name: string): StatLabel[] {
  const list = loadLabels();
  list.push({ id: "sl_" + Math.random().toString(36).slice(2, 8), name, count: 0 });
  saveLabels(list);
  return list;
}

export type Point = { date: string; value: number };

// Честный ряд активности из реальных сообщений: раскладываем метки времени
// сообщений по дням. Если сообщений нет — вернётся ряд из нулей.
export function seriesFromMessageTimes(times: number[], days = 30): Point[] {
  const now = new Date();
  const buckets: Record<string, number> = {};
  const key = (d: Date) => d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

  const out: Point[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - (days - 1));

  for (const t of times) {
    const d = new Date(t);
    if (d >= start) buckets[key(d)] = (buckets[key(d)] || 0) + 1;
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const k = key(d);
    out.push({ date: k, value: buckets[k] || 0 });
  }
  return out;
}
