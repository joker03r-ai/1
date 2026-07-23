// Пользовательские настройки оформления: цветовая гамма и язык.

export type Accent =
  | "violet" | "blue" | "green" | "rose" | "graphite"
  | "orange" | "amber" | "teal" | "cyan" | "red" | "indigo" | "pink";
export type Lang = "ru" | "en";
export type Theme = "light" | "dark";

export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: "violet", label: "Фиолетовая", color: "#6c5ce7" },
  { id: "indigo", label: "Индиго", color: "#6366f1" },
  { id: "blue", label: "Синяя", color: "#2b6ef6" },
  { id: "cyan", label: "Голубая", color: "#0ea5e9" },
  { id: "teal", label: "Бирюзовая", color: "#14b8a6" },
  { id: "green", label: "Зелёная", color: "#16a34a" },
  { id: "amber", label: "Янтарная", color: "#f59e0b" },
  { id: "orange", label: "Оранжевая", color: "#f97316" },
  { id: "red", label: "Красная", color: "#ef4444" },
  { id: "rose", label: "Розовая", color: "#ec4899" },
  { id: "pink", label: "Малиновая", color: "#db2777" },
  { id: "graphite", label: "Графит", color: "#475569" },
];

export function loadAccent(): Accent {
  if (typeof window === "undefined") return "violet";
  return (localStorage.getItem("sb_accent") as Accent) || "violet";
}

export function applyAccent(a: Accent) {
  if (typeof document === "undefined") return;
  if (a === "violet") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", a);
}

export function saveAccent(a: Accent) {
  try {
    localStorage.setItem("sb_accent", a);
  } catch {}
  applyAccent(a);
}

export function loadLang(): Lang {
  if (typeof window === "undefined") return "ru";
  return (localStorage.getItem("sb_lang") as Lang) || "ru";
}

export function saveLang(l: Lang) {
  try {
    localStorage.setItem("sb_lang", l);
  } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export function loadTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("sb_theme") as Theme) || "light";
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

export function saveTheme(t: Theme) {
  try {
    localStorage.setItem("sb_theme", t);
  } catch {}
  applyTheme(t);
}
