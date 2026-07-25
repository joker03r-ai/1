// Пользовательские настройки оформления: цветовая гамма и язык.

export type Accent =
  | "violet" | "blue" | "green" | "rose" | "graphite"
  | "orange" | "amber" | "teal" | "cyan" | "red" | "indigo" | "pink"
  | "custom";
export type Lang = "ru" | "en";
export type Theme = "light" | "dark" | "graphite" | "night" | "system";
export type FontColor = "black" | "gray" | "white";
export type Density = "standard" | "compact";
export type GradIntensity = "off" | "soft" | "normal";

// Кураторские темы оформления. dark=true — тёмная база.
export const THEMES: { id: Theme; label: string; dark: boolean }[] = [
  { id: "light", label: "Светлая", dark: false },
  { id: "dark", label: "Тёмная", dark: true },
  { id: "graphite", label: "Графитовая", dark: true },
  { id: "night", label: "Ночная", dark: true },
  { id: "system", label: "Системная", dark: false },
];

function systemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
// Фактическая тема (для «системной»).
export function resolveTheme(t: Theme): "light" | "dark" | "graphite" | "night" {
  if (t === "system") return systemDark() ? "dark" : "light";
  return t;
}
export function isThemeDark(t: Theme): boolean {
  const r = resolveTheme(t);
  return r === "dark" || r === "graphite" || r === "night";
}

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
  const de = document.documentElement;
  const eff = resolveTheme(t);
  const isDark = eff === "dark" || eff === "graphite" || eff === "night";
  if (isDark) de.setAttribute("data-theme", "dark");
  else de.removeAttribute("data-theme");
  // Вариант тёмной темы через data-skin (graphite / night).
  if (eff === "graphite" || eff === "night") de.setAttribute("data-skin", eff);
  else de.removeAttribute("data-skin");
  // Цвет шрифта зависит от темы (автоконтроль контраста).
  applyFontColor(loadFontColor());
  applyCustomHue(loadHue()); // акцент управляется ползунком оттенка
  applyLogoHue(loadLogoHue());
}
export function saveTheme(t: Theme) {
  try { localStorage.setItem("sb_theme", t); } catch {}
  applyTheme(t);
}

// ---- Цвет логотипа ----
export type LogoColor = "accent" | "violet" | "blue" | "green" | "amber" | "rose" | "cyan" | "graphite" | "sunset" | "ocean";
export const LOGO_COLORS: { id: LogoColor; label: string; grad: string }[] = [
  { id: "accent", label: "Как акцент", grad: "var(--grad)" },
  { id: "violet", label: "Фиолетовый", grad: "linear-gradient(140deg,#6d5cf0,#5a8bff)" },
  { id: "blue", label: "Синий", grad: "linear-gradient(140deg,#2b6ef6,#4f8bf7)" },
  { id: "cyan", label: "Голубой", grad: "linear-gradient(140deg,#06b6d4,#22d3ee)" },
  { id: "green", label: "Зелёный", grad: "linear-gradient(140deg,#10b981,#34d399)" },
  { id: "amber", label: "Янтарный", grad: "linear-gradient(140deg,#f59e0b,#fbbf24)" },
  { id: "sunset", label: "Закат", grad: "linear-gradient(140deg,#f97316,#ec4899)" },
  { id: "rose", label: "Розовый", grad: "linear-gradient(140deg,#ec4899,#f472b6)" },
  { id: "ocean", label: "Океан", grad: "linear-gradient(140deg,#0ea5e9,#6366f1)" },
  { id: "graphite", label: "Графит", grad: "linear-gradient(140deg,#475569,#64748b)" },
];
export function loadLogo(): LogoColor {
  if (typeof window === "undefined") return "violet";
  return (localStorage.getItem("sb_logo") as LogoColor) || "violet";
}
export function applyLogo(c: LogoColor) {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  const found = LOGO_COLORS.find((x) => x.id === c);
  if (found) s.setProperty("--logo-grad", found.grad);
  else s.removeProperty("--logo-grad");
}
export function saveLogo(c: LogoColor) {
  try { localStorage.setItem("sb_logo", c); } catch {}
  applyLogo(c);
}

// ---- Цвет логотипа ползунком (оттенок 0..360) ----
export function loadLogoHue(): number {
  if (typeof window === "undefined") return 258;
  const v = Number(localStorage.getItem("sb_logo_hue"));
  return Number.isFinite(v) && v >= 0 ? v : 258;
}
export function applyLogoHue(h: number) {
  if (typeof document === "undefined") return;
  const h2 = (h + 40) % 360;
  document.documentElement.style.setProperty("--logo-grad", `linear-gradient(140deg, hsl(${h} 78% 62%), hsl(${h2} 78% 60%))`);
}
export function saveLogoHue(h: number) {
  try { localStorage.setItem("sb_logo_hue", String(h)); } catch {}
  applyLogoHue(h);
}

// ---- Иллюстрация героя на главной (10 вариантов) ----
export const ILLUSTS: { id: number; label: string; core: string; nodes: [string, string, string]; grad: string; status?: boolean }[] = [
  { id: 0, label: "Ассистент", core: "bot", nodes: ["send", "spark", "users"], grad: "linear-gradient(150deg,#5b8cff,#8b5cf6)" },
  { id: 1, label: "Ракета", core: "rocket", nodes: ["spark", "chart", "send"], grad: "linear-gradient(150deg,#f97316,#ec4899)" },
  { id: 2, label: "Магия ИИ", core: "spark", nodes: ["bot", "chat", "layers"], grad: "linear-gradient(150deg,#8b5cf6,#22d3ee)" },
  { id: 3, label: "Общение", core: "chat", nodes: ["users", "send", "spark"], grad: "linear-gradient(150deg,#3b82f6,#06b6d4)" },
  { id: 4, label: "Аудитория", core: "users", nodes: ["chat", "send", "chart"], grad: "linear-gradient(150deg,#10b981,#3b82f6)" },
  { id: 5, label: "Продажи", core: "store", nodes: ["chart", "users", "send"], grad: "linear-gradient(150deg,#16a34a,#84cc16)" },
  { id: 6, label: "Аналитика", core: "chart", nodes: ["spark", "users", "layers"], grad: "linear-gradient(150deg,#6366f1,#a855f7)" },
  { id: 7, label: "Рассылки", core: "send", nodes: ["users", "chat", "spark"], grad: "linear-gradient(150deg,#0ea5e9,#6366f1)" },
  { id: 8, label: "Сценарии", core: "layers", nodes: ["bot", "spark", "send"], grad: "linear-gradient(150deg,#f59e0b,#f97316)" },
  { id: 9, label: "Глобально", core: "globe", nodes: ["users", "send", "chat"], grad: "linear-gradient(150deg,#ec4899,#8b5cf6)" },
  { id: 10, label: "Статус ботов", core: "bot", nodes: ["chat", "send", "users"], grad: "linear-gradient(150deg,#22c55e,#3b82f6)", status: true },
];
export function loadIllust(): number {
  if (typeof window === "undefined") return 0;
  const v = Number(localStorage.getItem("sb_illust"));
  return Number.isFinite(v) && v >= 0 && v < ILLUSTS.length ? v : 0;
}
export function saveIllust(n: number) {
  try { localStorage.setItem("sb_illust", String(n)); } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new Event("sb-illust"));
}

// ---- Цвет шрифта (чёрный / тёмно-серый / белый) с автоконтролем контраста ----
export function loadFontColor(): FontColor {
  if (typeof window === "undefined") return "black";
  return (localStorage.getItem("sb_font_color") as FontColor) || "black";
}
export function applyFontColor(fc: FontColor) {
  if (typeof document === "undefined") return;
  const de = document.documentElement;
  const dark = de.getAttribute("data-theme") === "dark";
  // Белый текст допускаем только на тёмном фоне — иначе откатываем к чёрному.
  const safe: FontColor = fc === "white" && !dark ? "black" : fc;
  de.setAttribute("data-ink", safe);
}
export function saveFontColor(fc: FontColor) {
  try { localStorage.setItem("sb_font_color", fc); } catch {}
  applyFontColor(fc);
}

// ---- Плотность интерфейса ----
export function loadDensity(): Density {
  if (typeof window === "undefined") return "standard";
  return (localStorage.getItem("sb_density") as Density) || "standard";
}
export function applyDensity(d: Density) {
  if (typeof document === "undefined") return;
  if (d === "compact") document.documentElement.setAttribute("data-density", "compact");
  else document.documentElement.removeAttribute("data-density");
}
export function saveDensity(d: Density) {
  try { localStorage.setItem("sb_density", d); } catch {}
  applyDensity(d);
}

// ---- Интенсивность градиентов ----
export function loadGrad(): GradIntensity {
  if (typeof window === "undefined") return "normal";
  return (localStorage.getItem("sb_grad") as GradIntensity) || "normal";
}
export function applyGrad(g: GradIntensity) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-grad", g);
}
export function saveGrad(g: GradIntensity) {
  try { localStorage.setItem("sb_grad", g); } catch {}
  applyGrad(g);
}

// ---- Анимации ----
export function loadAnim(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("sb_anim") !== "0";
}
export function applyAnim(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.removeAttribute("data-anim");
  else document.documentElement.setAttribute("data-anim", "off");
}
export function saveAnim(on: boolean) {
  try { localStorage.setItem("sb_anim", on ? "1" : "0"); } catch {}
  applyAnim(on);
}

// Следим за системной темой, если выбрана «Системная».
export function watchSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => { if (loadTheme() === "system") applyTheme("system"); };
  try { mq.addEventListener("change", handler); } catch { mq.addListener?.(handler); }
}
