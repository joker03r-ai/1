// Статистика: метки (события в статистике) и демо-данные для графика.

export type StatLabel = { id: string; name: string; count: number };

const KEY = "sb_stat_labels";

const SEED: StatLabel[] = [
  { id: "sl_dialog", name: "Начал диалог", count: 1240 },
  { id: "sl_phone", name: "Есть номер телефона", count: 612 },
  { id: "sl_quiz", name: "Прошёл тест", count: 348 },
  { id: "sl_lead", name: "Оставил заявку", count: 205 },
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

// Детерминированный «псевдослучайный» ряд с всплеском (как на скриншоте).
export type Point = { date: string; value: number };

export function generateSeries(days = 30): Point[] {
  const out: Point[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const idx = days - 1 - i;
    // База с мягкими колебаниями + резкий всплеск ближе к концу.
    const wave = 28 + Math.round(14 * Math.sin(idx / 2.3) + 8 * Math.sin(idx / 1.1));
    const spike = idx === days - 6 ? 150 : idx === days - 7 ? 60 : idx === days - 5 ? 40 : 0;
    out.push({
      date: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      value: Math.max(6, wave + spike),
    });
  }
  return out;
}
