// Пользовательские настройки оформления: цветовая гамма и язык.

export type Accent =
  | "violet" | "blue" | "green" | "rose" | "graphite"
  | "orange" | "amber" | "teal" | "cyan" | "red" | "indigo" | "pink"
  | "custom";
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

// Свой оттенок (ползунок), 0..360.
export function loadHue(): number {
  if (typeof window === "undefined") return 265;
  const v = Number(localStorage.getItem("sb_accent_hue"));
  return Number.isFinite(v) && v > 0 ? v : 265;
}

const CUSTOM_VARS = [
  "--violet", "--violet-600", "--violet-700", "--violet-050", "--violet-100",
  "--grad", "--grad-soft", "--shadow-violet",
];

function clearCustomVars() {
  const s = document.documentElement.style;
  CUSTOM_VARS.forEach((n) => s.removeProperty(n));
}

// Применяет свой оттенок инлайн-переменными (с учётом тёмной темы).
export function applyCustomHue(h: number) {
  if (typeof document === "undefined") return;
  const de = document.documentElement;
  de.setAttribute("data-accent", "custom");
  const dark = de.getAttribute("data-theme") === "dark";
  const s = de.style;
  const h2 = (h + 18) % 360;
  const h3 = (h + 36) % 360;
  s.setProperty("--violet", `hsl(${h} 72% 55%)`);
  s.setProperty("--violet-600", `hsl(${h} 72% 48%)`);
  s.setProperty("--violet-700", `hsl(${h} 68% ${dark ? "68%" : "40%"})`);
  s.setProperty("--violet-050", dark ? `hsl(${h} 38% 17%)` : `hsl(${h} 82% 96%)`);
  s.setProperty("--violet-100", dark ? `hsl(${h} 38% 26%)` : `hsl(${h} 76% 90%)`);
  s.setProperty("--grad", `linear-gradient(135deg, hsl(${h} 75% 58%), hsl(${h2} 75% 62%) 55%, hsl(${h3} 75% 70%))`);
  s.setProperty("--grad-soft", `linear-gradient(135deg, hsl(${h} 72% 60%), hsl(${h2} 72% 66%))`);
  s.setProperty("--shadow-violet", `0 8px 20px -4px hsla(${h} 70% 55% / .4)`);
}

export function applyAccent(a: Accent) {
  if (typeof document === "undefined") return;
  if (a === "custom") {
    applyCustomHue(loadHue());
    return;
  }
  clearCustomVars();
  if (a === "violet") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", a);
}

export function saveAccent(a: Accent) {
  try {
    localStorage.setItem("sb_accent", a);
  } catch {}
  applyAccent(a);
}

export function saveHue(h: number) {
  try {
    localStorage.setItem("sb_accent_hue", String(h));
    localStorage.setItem("sb_accent", "custom");
  } catch {}
  applyCustomHue(h);
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
  // Свой оттенок зависит от темы — пересчитываем при переключении.
  if (loadAccent() === "custom") applyCustomHue(loadHue());
}

export function saveTheme(t: Theme) {
  try {
    localStorage.setItem("sb_theme", t);
  } catch {}
  applyTheme(t);
}
