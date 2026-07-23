// Пользовательские настройки оформления: цветовая гамма и язык.

export type Accent = "violet" | "blue" | "green" | "rose" | "graphite";
export type Lang = "ru" | "en";

export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: "violet", label: "Фиолетовая", color: "#6c5ce7" },
  { id: "blue", label: "Синяя", color: "#2b6ef6" },
  { id: "green", label: "Зелёная", color: "#16a34a" },
  { id: "rose", label: "Розовая", color: "#ec4899" },
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
