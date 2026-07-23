// Пробный период: 7 дней с первого запуска кабинета.

const KEY = "sb_trial_start";
export const TRIAL_DAYS = 7;

export function trialStart(): number {
  if (typeof window === "undefined") return Date.now();
  let v = Number(localStorage.getItem(KEY));
  if (!v) {
    v = Date.now();
    try {
      localStorage.setItem(KEY, String(v));
    } catch {}
  }
  return v;
}

export function trialDaysLeft(): number {
  const start = trialStart();
  const passed = Math.floor((Date.now() - start) / 86_400_000);
  return Math.max(0, TRIAL_DAYS - passed);
}

// Русское склонение слова «день».
export function daysWord(n: number): string {
  const a = n % 100;
  if (a >= 11 && a <= 14) return "дней";
  const b = n % 10;
  if (b === 1) return "день";
  if (b >= 2 && b <= 4) return "дня";
  return "дней";
}
