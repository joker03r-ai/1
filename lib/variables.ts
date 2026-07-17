// Переменные сценариев: пользовательские (у каждого клиента своё значение)
// и глобальные (одно значение для всех).

export type VarType = "string" | "number" | "boolean" | "date";
export type VarScope = "user" | "global";

export const VAR_TYPE_LABELS: Record<VarType, string> = {
  string: "Строка",
  number: "Число",
  boolean: "Да/Нет",
  date: "Дата",
};

export const VAR_SCOPE_LABELS: Record<VarScope, string> = {
  user: "Пользовательская",
  global: "Глобальная",
};

export type Variable = {
  id: string;
  name: string;
  type: VarType;
  scope: VarScope;
  initial: string;
};

const KEY = "sb_variables";

export const DEFAULT_VARIABLES: Variable[] = [
  { id: "v_phone", name: "Телефон", type: "string", scope: "user", initial: "" },
];

export function loadVariables(): Variable[] {
  if (typeof window === "undefined") return DEFAULT_VARIABLES;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Variable[]) : DEFAULT_VARIABLES;
  } catch {
    return DEFAULT_VARIABLES;
  }
}

export function saveVariables(list: Variable[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function addVariable(v: Variable) {
  const list = loadVariables();
  list.push(v);
  saveVariables(list);
  return list;
}

export function vid() {
  return "v_" + Math.random().toString(36).slice(2, 8);
}

// Подстановка значений переменных вида %Имя% в текст.
export function interpolate(text: string, values: Record<string, string>): string {
  return text.replace(/%([^%]+)%/g, (_, name) => values[name.trim()] ?? `%${name}%`);
}
