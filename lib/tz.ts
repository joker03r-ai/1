// Часовые пояса по базе IANA. Пересчёт времени с учётом сезонного перевода
// делает браузер через Intl — вручную смещения не задаём.

export type City = { id: string; name: string; tz: string };

// Основные города РФ + несколько мировых. tz — идентификатор IANA.
export const CITIES: City[] = [
  // Калининградская зона (МСК−1)
  { id: "kaliningrad", name: "Калининград", tz: "Europe/Kaliningrad" },
  // Московская зона (МСК)
  { id: "moscow", name: "Москва", tz: "Europe/Moscow" },
  { id: "spb", name: "Санкт-Петербург", tz: "Europe/Moscow" },
  { id: "novgorod", name: "Нижний Новгород", tz: "Europe/Moscow" },
  { id: "kazan", name: "Казань", tz: "Europe/Moscow" },
  { id: "rostov", name: "Ростов-на-Дону", tz: "Europe/Moscow" },
  { id: "krasnodar", name: "Краснодар", tz: "Europe/Moscow" },
  { id: "voronezh", name: "Воронеж", tz: "Europe/Moscow" },
  { id: "volgograd", name: "Волгоград", tz: "Europe/Volgograd" },
  { id: "sochi", name: "Сочи", tz: "Europe/Moscow" },
  { id: "sevastopol", name: "Севастополь", tz: "Europe/Simferopol" },
  { id: "simferopol", name: "Симферополь", tz: "Europe/Simferopol" },
  { id: "murmansk", name: "Мурманск", tz: "Europe/Moscow" },
  { id: "arkhangelsk", name: "Архангельск", tz: "Europe/Moscow" },
  { id: "tula", name: "Тула", tz: "Europe/Moscow" },
  { id: "yaroslavl", name: "Ярославль", tz: "Europe/Moscow" },
  // Самарская зона (МСК+1)
  { id: "samara", name: "Самара", tz: "Europe/Samara" },
  { id: "izhevsk", name: "Ижевск", tz: "Europe/Samara" },
  { id: "ulyanovsk", name: "Ульяновск", tz: "Europe/Ulyanovsk" },
  { id: "saratov", name: "Саратов", tz: "Europe/Saratov" },
  { id: "astrakhan", name: "Астрахань", tz: "Europe/Astrakhan" },
  // Екатеринбургская зона (МСК+2)
  { id: "ekb", name: "Екатеринбург", tz: "Asia/Yekaterinburg" },
  { id: "chelyabinsk", name: "Челябинск", tz: "Asia/Yekaterinburg" },
  { id: "ufa", name: "Уфа", tz: "Asia/Yekaterinburg" },
  { id: "perm", name: "Пермь", tz: "Asia/Yekaterinburg" },
  { id: "tyumen", name: "Тюмень", tz: "Asia/Yekaterinburg" },
  { id: "orenburg", name: "Оренбург", tz: "Asia/Yekaterinburg" },
  // Омская зона (МСК+3)
  { id: "omsk", name: "Омск", tz: "Asia/Omsk" },
  // Новосибирская зона (МСК+4)
  { id: "nsk", name: "Новосибирск", tz: "Asia/Novosibirsk" },
  { id: "barnaul", name: "Барнаул", tz: "Asia/Barnaul" },
  { id: "tomsk", name: "Томск", tz: "Asia/Tomsk" },
  { id: "kemerovo", name: "Кемерово", tz: "Asia/Novokuznetsk" },
  // Красноярская зона (МСК+4)
  { id: "krasnoyarsk", name: "Красноярск", tz: "Asia/Krasnoyarsk" },
  { id: "abakan", name: "Абакан", tz: "Asia/Krasnoyarsk" },
  { id: "norilsk", name: "Норильск", tz: "Asia/Krasnoyarsk" },
  // Иркутская зона (МСК+5)
  { id: "irkutsk", name: "Иркутск", tz: "Asia/Irkutsk" },
  { id: "ulanude", name: "Улан-Удэ", tz: "Asia/Irkutsk" },
  { id: "bratsk", name: "Братск", tz: "Asia/Irkutsk" },
  // Якутская зона (МСК+6)
  { id: "yakutsk", name: "Якутск", tz: "Asia/Yakutsk" },
  { id: "chita", name: "Чита", tz: "Asia/Chita" },
  { id: "blagoveshchensk", name: "Благовещенск", tz: "Asia/Yakutsk" },
  // Владивостокская зона (МСК+7)
  { id: "vladivostok", name: "Владивосток", tz: "Asia/Vladivostok" },
  { id: "khabarovsk", name: "Хабаровск", tz: "Asia/Vladivostok" },
  { id: "yuzhno", name: "Южно-Сахалинск", tz: "Asia/Sakhalin" },
  // Магаданская зона (МСК+8)
  { id: "magadan", name: "Магадан", tz: "Asia/Magadan" },
  // Камчатская зона (МСК+9)
  { id: "kamchatka", name: "Петропавловск-Камчатский", tz: "Asia/Kamchatka" },
  { id: "anadyr", name: "Анадырь", tz: "Asia/Anadyr" },
  // СНГ и ближнее зарубежье
  { id: "minsk", name: "Минск", tz: "Europe/Minsk" },
  { id: "kyiv", name: "Киев", tz: "Europe/Kyiv" },
  { id: "kishinev", name: "Кишинёв", tz: "Europe/Chisinau" },
  { id: "almaty", name: "Алматы", tz: "Asia/Almaty" },
  { id: "astana", name: "Астана", tz: "Asia/Almaty" },
  { id: "tashkent", name: "Ташкент", tz: "Asia/Tashkent" },
  { id: "bishkek", name: "Бишкек", tz: "Asia/Bishkek" },
  { id: "dushanbe", name: "Душанбе", tz: "Asia/Dushanbe" },
  { id: "ashgabat", name: "Ашхабад", tz: "Asia/Ashgabat" },
  { id: "tbilisi", name: "Тбилиси", tz: "Asia/Tbilisi" },
  { id: "yerevan", name: "Ереван", tz: "Asia/Yerevan" },
  { id: "baku", name: "Баку", tz: "Asia/Baku" },
  // Мир
  { id: "istanbul", name: "Стамбул", tz: "Europe/Istanbul" },
  { id: "dubai", name: "Дубай", tz: "Asia/Dubai" },
  { id: "telaviv", name: "Тель-Авив", tz: "Asia/Jerusalem" },
  { id: "bangkok", name: "Бангкок", tz: "Asia/Bangkok" },
  { id: "beijing", name: "Пекин", tz: "Asia/Shanghai" },
  { id: "tokyo", name: "Токио", tz: "Asia/Tokyo" },
  { id: "delhi", name: "Дели", tz: "Asia/Kolkata" },
  { id: "london", name: "Лондон", tz: "Europe/London" },
  { id: "paris", name: "Париж", tz: "Europe/Paris" },
  { id: "berlin", name: "Берлин", tz: "Europe/Berlin" },
  { id: "madrid", name: "Мадрид", tz: "Europe/Madrid" },
  { id: "newyork", name: "Нью-Йорк", tz: "America/New_York" },
  { id: "losangeles", name: "Лос-Анджелес", tz: "America/Los_Angeles" },
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
