// Модель спарсенных Telegram-чатов и демо-парсер.
//
// БОЕВОЙ ПАРСИНГ: подключается токен бота (вкладка «Каналы» бота). Далее сервер
// опрашивает Telegram Bot API: getUpdates (новые сообщения), getChat, getChatAdministrators,
// getChatMemberCount. Для истории закрытых чатов используется MTProto (например Telethon)
// на отдельном воркере. Здесь, во фронтовой демо-версии, парсинг наполняет
// localStorage реалистичным набором чатов той же структуры, что и боевой ответ API.

export type TgRole = "creator" | "administrator" | "member";

export type TgUser = {
  id: string;
  name: string;
  username?: string;
  tgRole: TgRole;
};

export type TgMessage = {
  id: string;
  from: string; // имя автора
  text: string;
  ts: number; // unix ms
  out?: boolean; // сообщение от нашего бота/оператора
};

export type ChatType = "group" | "supergroup" | "channel" | "private";

export type TgChat = {
  id: string;
  title: string;
  type: ChatType;
  username?: string;
  membersCount: number;
  participants: TgUser[];
  messages: TgMessage[];
  parsedAt: number;
};

export const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  group: "Группа",
  supergroup: "Супергруппа",
  channel: "Канал",
  private: "Личный чат",
};

export const CHAT_TYPE_ICON: Record<ChatType, string> = {
  group: "👥",
  supergroup: "🏙️",
  channel: "📢",
  private: "👤",
};

const KEY = "sb_tg_chats";

export function loadChats(): TgChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TgChat[]) : [];
  } catch {
    return [];
  }
}

export function saveChats(list: TgChat[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function cid(prefix = "c"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 8);
}

function ago(min: number): number {
  return Date.now() - min * 60 * 1000;
}

// Демо-парсер: имитирует ответ Telegram Bot API и возвращает набор чатов.
export function parseChats(): TgChat[] {
  const chats: TgChat[] = [
    {
      id: cid(),
      title: "Клиенты — Онлайн-школа",
      type: "supergroup",
      username: "@school_clients",
      membersCount: 248,
      parsedAt: Date.now(),
      participants: [
        { id: cid("u"), name: "Вы", username: "@you", tgRole: "creator" },
        { id: cid("u"), name: "Анна Ким", username: "@anna_kim", tgRole: "administrator" },
        { id: cid("u"), name: "Игорь Раскатов", username: "@raskatov", tgRole: "member" },
        { id: cid("u"), name: "Мария П.", username: "@maria_p", tgRole: "member" },
        { id: cid("u"), name: "Дмитрий Волков", username: "@dvolkov", tgRole: "member" },
      ],
      messages: [
        { id: cid("m"), from: "Игорь Раскатов", text: "Здравствуйте! Когда старт нового потока?", ts: ago(52) },
        { id: cid("m"), from: "Бот", text: "Старт 1 августа. Оставить заявку — /start", ts: ago(51), out: true },
        { id: cid("m"), from: "Мария П.", text: "А рассрочка есть?", ts: ago(38) },
        { id: cid("m"), from: "Анна Ким", text: "Да, до 6 месяцев без процентов 🙂", ts: ago(36), out: true },
        { id: cid("m"), from: "Дмитрий Волков", text: "Записался, спасибо!", ts: ago(12) },
      ],
    },
    {
      id: cid(),
      title: "Анонсы и новости",
      type: "channel",
      username: "@botpilot_news",
      membersCount: 1320,
      parsedAt: Date.now(),
      participants: [
        { id: cid("u"), name: "Вы", username: "@you", tgRole: "creator" },
        { id: cid("u"), name: "Пётр Смирнов", username: "@petr_s", tgRole: "administrator" },
      ],
      messages: [
        { id: cid("m"), from: "Канал", text: "🎁 Розыгрыш среди подписчиков — итоги в пятницу!", ts: ago(600), out: true },
        { id: cid("m"), from: "Канал", text: "Новый вебинар «Автоворонки» — регистрация открыта.", ts: ago(120), out: true },
      ],
    },
    {
      id: cid(),
      title: "Поддержка — Магазин",
      type: "group",
      username: "@shop_support",
      membersCount: 34,
      parsedAt: Date.now(),
      participants: [
        { id: cid("u"), name: "Вы", username: "@you", tgRole: "creator" },
        { id: cid("u"), name: "Пётр Смирнов", username: "@petr_s", tgRole: "administrator" },
        { id: cid("u"), name: "Ольга Ф.", username: "@olga_f", tgRole: "member" },
      ],
      messages: [
        { id: cid("m"), from: "Ольга Ф.", text: "Заказ №1841 не пришёл 😔", ts: ago(90) },
        { id: cid("m"), from: "Пётр Смирнов", text: "Проверяю трек-номер, минуту", ts: ago(88), out: true },
        { id: cid("m"), from: "Пётр Смирнов", text: "Курьер сегодня до 18:00, извините за задержку!", ts: ago(80), out: true },
      ],
    },
    {
      id: cid(),
      title: "Игорь Раскатов",
      type: "private",
      username: "@raskatov",
      membersCount: 2,
      parsedAt: Date.now(),
      participants: [
        { id: cid("u"), name: "Игорь Раскатов", username: "@raskatov", tgRole: "member" },
        { id: cid("u"), name: "Бот", username: "@your_bot", tgRole: "member" },
      ],
      messages: [
        { id: cid("m"), from: "Игорь Раскатов", text: "Можно счёт на оплату?", ts: ago(20) },
        { id: cid("m"), from: "Бот", text: "Конечно! Отправил счёт на почту 📩", ts: ago(19), out: true },
      ],
    },
  ];
  saveChats(chats);
  return chats;
}

// Повысить/понизить участника в Telegram-чате (Bot API: promoteChatMember).
export function setParticipantRole(chatId: string, userId: string, tgRole: TgRole) {
  const chats = loadChats().map((c) => {
    if (c.id !== chatId) return c;
    return {
      ...c,
      participants: c.participants.map((p) => (p.id === userId ? { ...p, tgRole } : p)),
    };
  });
  saveChats(chats);
}
