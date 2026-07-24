// Парсинг — отдельный раздел: источники, ключевые слова, частота сбора,
// найденные материалы и история запусков. Никаких переходов в «Сценарии»
// или «Продвижение» — только сбор материалов и передача их в «Черновики».

export type ParseMaterial = {
  id: string;
  kind: "chat" | "post" | "account";
  title: string;
  meta: string;
  text: string; // готовый текст, который можно сохранить в черновик
};

export type ParseRun = { id: string; at: number; keywords: string; source: string; count: number };

export type ParseConfig = {
  sources: string[]; // выбранные источники
  keywords: string;
  excludeBots: boolean;
  dedup: boolean;
  frequency: string; // частота сбора
};

export const PARSE_SOURCES = ["Чаты конкурентов", "Тематические каналы", "Комментарии под постами", "Похожие аккаунты"];
export const PARSE_FREQ = ["Разово", "Каждый час", "Раз в день", "Раз в неделю"];

export const DEFAULT_PARSE: ParseConfig = {
  sources: ["Чаты конкурентов"],
  keywords: "",
  excludeBots: true,
  dedup: true,
  frequency: "Разово",
};

const CFG = "sb_parse_cfg";
const FOUND = "sb_parse_found";
const HIST = "sb_parse_hist";

function read<T>(key: string, def: T): T {
  if (typeof window === "undefined") return def;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    return def;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export function loadConfig(): ParseConfig { return { ...DEFAULT_PARSE, ...read<ParseConfig>(CFG, DEFAULT_PARSE) }; }
export function saveConfig(c: ParseConfig) { write(CFG, c); }
export function loadFound(): ParseMaterial[] { return read<ParseMaterial[]>(FOUND, []); }
export function saveFound(list: ParseMaterial[]) { write(FOUND, list); }
export function loadHistory(): ParseRun[] { return read<ParseRun[]>(HIST, []); }
export function saveHistory(list: ParseRun[]) { write(HIST, list); }

// Имитация парсинга: генерирует найденные публикации/чаты/аккаунты по
// ключевым словам и источнику. На боевом сервере заменяется реальным сбором.
export function runParse(cfg: ParseConfig): ParseMaterial[] {
  const kw = cfg.keywords.split(/[,\s]+/).filter(Boolean).slice(0, 3);
  const base = kw.length ? kw : ["ваша ниша"];
  const src = cfg.sources[0] || "Источник";
  const found: ParseMaterial[] = [];
  let n = 0;
  base.forEach((k, i) => {
    const cap = k.charAt(0).toUpperCase() + k.slice(1);
    found.push({ id: `m_${Date.now()}_${n++}`, kind: "chat", title: `Чат «${k}»`, meta: `${420 + i * 137} участников · ${src}`, text: `Приглашаем в обсуждение «${k}» — делимся опытом и отвечаем на вопросы.` });
    found.push({ id: `m_${Date.now()}_${n++}`, kind: "post", title: `Популярный пост о «${k}»`, meta: `${20 + i * 9} реакций · высокий отклик`, text: `🔥 Разбираем «${k}»: 3 ошибки новичков и как их избежать. Сохраняйте, чтобы не потерять.` });
    found.push({ id: `m_${Date.now()}_${n++}`, kind: "account", title: `@${(k.replace(/[^a-zа-я0-9_]/gi, "") || "expert")}_expert`, meta: `лидер мнений · ${1200 + i * 300} подписчиков`, text: `Полезный контент по теме «${cap}». Подпишитесь, чтобы не пропустить новое.` });
  });
  return found;
}
