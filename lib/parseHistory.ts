// История парсинга (клиент): автосохранение завершённых задач в localStorage,
// чтобы к любой базе можно было вернуться в любой момент. Плюс экспорт баз
// в Excel(CSV) / TXT / JSON / список ссылок — в т.ч. «плоский» файл под ChatGPT.

import type { ChannelRow, AudienceRow, ResolvedRow } from "./tgParseJobs";

export type RunKind = "channels" | "audience" | "content" | "resolve";
export type HistoryRun = {
  id: string;
  kind: RunKind;
  title: string;
  date: number;
  params?: Record<string, any>;
  counts: { found: number; saved: number };
  channels?: ChannelRow[];
  audience?: AudienceRow[];
  resolved?: ResolvedRow[];
};

const KEY = "sb_parse_history";

export function loadHistory(): HistoryRun[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as HistoryRun[]; } catch { return []; }
}
export function saveHistory(list: HistoryRun[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch {}
}
export function addRun(run: Omit<HistoryRun, "id" | "date">): HistoryRun {
  const r: HistoryRun = { ...run, id: "run_" + Math.random().toString(36).slice(2, 9), date: Date.now() };
  saveHistory([r, ...loadHistory()]);
  return r;
}
export function removeRun(id: string) { saveHistory(loadHistory().filter((r) => r.id !== id)); }

/* -------- экспорт -------- */
function esc(s: any) { return `"${String(s ?? "").replace(/"/g, '""')}"`; }
export function download(name: string, content: string, mime = "text/plain") {
  const blob = new Blob(["﻿" + content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Каналы — обычный Excel/CSV (базовые данные).
export function channelsCSV(rows: ChannelRow[]): string {
  const head = ["title", "link", "username", "subscribers"];
  const body = rows.map((r) => [esc(r.title), esc(r.link), esc(r.username), r.subscribers].join(","));
  return [head.join(","), ...body].join("\n");
}
// Каналы — расширенный экспорт (все категории), плоский формат под ChatGPT.
export function channelsExtended(rows: ChannelRow[], format: "csv" | "json" | "txt"): string {
  const flat = rows.map((r) => ({
    title: r.title, link: r.link, username: r.username, subscribers: r.subscribers,
    rating: r.rating, open_comments: r.comments, language: r.language,
    channel_id: r.id, created: r.created, type: r.type,
    avg_views: r.avgViews, posts_per_day: r.postFreq, description: r.description,
  }));
  if (format === "json") return JSON.stringify(flat, null, 2);
  if (format === "csv") {
    const cols = Object.keys(flat[0] || { title: "" });
    const head = cols.join(",");
    const body = flat.map((o) => cols.map((c) => esc((o as any)[c])).join(","));
    return [head, ...body].join("\n");
  }
  // txt — человекочитаемо для нейросети
  return flat.map((o) =>
    `${o.title} (${o.link || o.username})\n  подписчиков: ${o.subscribers} · рейтинг: ${o.rating}/10 · комментарии: ${o.open_comments ? "открыты" : "закрыты"} · язык: ${o.language}\n  ~${o.avg_views} просмотров, ${o.posts_per_day} постов/день, тип: ${o.type}, создан: ${o.created}\n  ${o.description || ""}`.trim()
  ).join("\n\n");
}
export function channelLinks(rows: ChannelRow[]): string {
  return rows.map((r) => r.link || r.username).filter(Boolean).join("\n");
}
export function audienceCSVClient(rows: AudienceRow[]): string {
  const head = "user_id,username,name,source,activity_date,premium";
  const body = rows.map((r) => [r.user_id, r.username, esc(r.name), esc(r.source), r.activity_date, r.premium ? "yes" : "no"].join(","));
  return [head, ...body].join("\n");
}
export function audienceLinks(rows: AudienceRow[]): string {
  return rows.filter((r) => r.username).map((r) => "https://t.me/" + r.username.replace(/^@/, "")).join("\n");
}
export function resolvedCSV(rows: ResolvedRow[]): string {
  const head = "phone,user_id,username,name,found";
  const body = rows.map((r) => [r.phone, r.user_id, r.username, esc(r.name), r.found ? "yes" : "no"].join(","));
  return [head, ...body].join("\n");
}
