// Часовые пояса по базе IANA. Пересчёт времени с учётом сезонного перевода
// делает браузер через Intl — вручную смещения не задаём.

export type City = { id: string; name: string; tz: string };

// Основные города РФ + несколько мировых. tz — идентификатор IANA.
export const CITIES: City[] = [
  { id: "moscow", name: "Москва", tz: "Europe/Moscow" },
  { id: "spb", name: "Санкт-Петербург", tz: "Europe/Moscow" },
  { id: "kaliningrad", name: "Калининград", tz: "Europe/Kaliningrad" },
  { id: "samara", name: "Самара", tz: "Europe/Samara" },
  { id: "ekb", name: "Екатеринбург", tz: "Asia/Yekaterinburg" },
  { id: "omsk", name: "Омск", tz: "Asia/Omsk" },
  { id: "nsk", name: "Новосибирск", tz: "Asia/Novosibirsk" },
  { id: "krasnoyarsk", name: "Красноярск", tz: "Asia/Krasnoyarsk" },
  { id: "irkutsk", name: "Иркутск", tz: "Asia/Irkutsk" },
  { id: "ulanude", name: "Улан-Удэ", tz: "Asia/Irkutsk" },
  { id: "yakutsk", name: "Якутск", tz: "Asia/Yakutsk" },
  { id: "vladivostok", name: "Владивосток", tz: "Asia/Vladivostok" },
  { id: "magadan", name: "Магадан", tz: "Asia/Magadan" },
  { id: "kamchatka", name: "Петропавловск-Камчатский", tz: "Asia/Kamchatka" },
  { id: "minsk", name: "Минск", tz: "Europe/Minsk" },
  { id: "kyiv", name: "Киев", tz: "Europe/Kyiv" },
  { id: "almaty", name: "Алматы", tz: "Asia/Almaty" },
  { id: "tashkent", name: "Ташкент", tz: "Asia/Tashkent" },
  { id: "tbilisi", name: "Тбилиси", tz: "Asia/Tbilisi" },
  { id: "yerevan", name: "Ереван", tz: "Asia/Yerevan" },
  { id: "baku", name: "Баку", tz: "Asia/Baku" },
  { id: "istanbul", name: "Стамбул", tz: "Europe/Istanbul" },
  { id: "dubai", name: "Дубай", tz: "Asia/Dubai" },
  { id: "london", name: "Лондон", tz: "Europe/London" },
  { id: "berlin", name: "Берлин", tz: "Europe/Berlin" },
  { id: "newyork", name: "Нью-Йорк", tz: "America/New_York" },
];

export function cityById(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}

export function searchCities(q: string): City[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return CITIES.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 8);
}

// Смещение зоны (в минутах) для конкретного момента — с учётом DST.
function tzOffsetMinutes(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: any = {};
  dtf.formatToParts(date).forEach((x) => (p[x.type] = x.value));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUTC - date.getTime()) / 60000;
}

// «Настенное» время в городе (дата+время) → момент времени (UTC Date).
export function wallToInstant(dateStr: string, timeStr: string, tz: string): Date {
  const naive = new Date(`${dateStr}T${(timeStr || "00:00")}:00Z`);
  const off = tzOffsetMinutes(tz, naive);
  return new Date(naive.getTime() - off * 60000);
}

// Момент времени → местное время в зоне «ЧЧ:ММ».
export function formatInTz(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(instant);
}

// Метка смещения относительно Москвы, напр. «МСК+5».
export function mskLabel(tz: string, ref = new Date()): string {
  const base = tzOffsetMinutes("Europe/Moscow", ref);
  const cur = tzOffsetMinutes(tz, ref);
  const diff = Math.round((cur - base) / 60);
  if (diff === 0) return "МСК";
  return `МСК${diff > 0 ? "+" : "−"}${Math.abs(diff)}`;
}
