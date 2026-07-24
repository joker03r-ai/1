"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark, IconChevron } from "@/components/icons";
import { STYLE_LABELS, AssistantStyle, KNOWLEDGE_OPTIONS, Assistant, saveAssistant } from "@/lib/assistant";
import { uid, upsertScenario, Scenario } from "@/lib/scenarios";
import { addBot } from "@/lib/bots";
import TgConnect, { TgInfo } from "./TgConnect";

type Goal = { id: string; label: string; emoji: string; desc: string; prepares: string[] };
type Tmpl = { id: string; label: string; emoji: string; desc: string; result: string; example: { me: boolean; text: string }[] };

const GOALS: Goal[] = [
  {
    id: "answer",
    label: "Отвечать клиентам",
    emoji: "💬",
    desc: "Например: отвечает на вопросы о ценах, доставке и графике",
    prepares: ["Приветствие", "Частые вопросы", "Ответы по смыслу", "Передача менеджеру"],
  },
  {
    id: "leads",
    label: "Собирать заявки",
    emoji: "📥",
    desc: "Например: спросит имя и телефон и передаст менеджеру",
    prepares: ["Приветствие", "Сбор имени", "Запрос телефона", "Уведомление менеджеру"],
  },
  {
    id: "sell",
    label: "Продавать товары или услуги",
    emoji: "🛒",
    desc: "Например: покажет товар, ответит на вопросы и оформит оплату",
    prepares: ["Каталог/предложение", "Вопросы клиента", "Оформление", "Оплата"],
  },
  {
    id: "booking",
    label: "Записывать на консультацию",
    emoji: "📅",
    desc: "Например: подберёт время и запишет клиента на приём",
    prepares: ["Выбор услуги", "Выбор времени", "Контакт", "Напоминание"],
  },
  {
    id: "ai",
    label: "Консультировать с помощью ИИ",
    emoji: "🤖",
    desc: "Например: ИИ отвечает на вопросы по вашей базе знаний 24/7",
    prepares: ["Приветствие", "Ответы ИИ", "База знаний", "Передача менеджеру"],
  },
  {
    id: "poll",
    label: "Проводить опросы",
    emoji: "📊",
    desc: "Например: задаст серию вопросов и соберёт ответы",
    prepares: ["Вопросы", "Варианты ответов", "Сохранение результата", "Итог"],
  },
  {
    id: "learn",
    label: "Обучать сотрудников",
    emoji: "🎓",
    desc: "Например: проведёт по материалам и проверит знания тестом",
    prepares: ["Материалы", "Шаги обучения", "Тест", "Результат"],
  },
  {
    id: "other",
    label: "Создать другой сценарий",
    emoji: "✨",
    desc: "Соберём структуру под вашу задачу — опишете её на следующих шагах",
    prepares: ["Приветствие", "Ваши шаги", "Действия", "Завершение"],
  },
];

type Platform = { id: string; label: string; emoji: string; time: string; steps: string[] };

const PLATFORMS: Platform[] = [
  {
    id: "tg",
    label: "Telegram",
    emoji: "✈️",
    time: "≈ 2 минуты",
    steps: [
      "Откройте @BotFather в Telegram",
      "Отправьте команду /newbot и создайте бота",
      "Скопируйте полученный токен",
      "Вставьте токен в поле ниже и нажмите «Проверить и подключить»",
    ],
  },
  {
    id: "vk",
    label: "ВКонтакте",
    emoji: "🟦",
    time: "≈ 5 минут",
    steps: [
      "Создайте сообщество ВКонтакте",
      "Управление → Работа с API → создайте ключ доступа",
      "Включите Long Poll API (последняя версия)",
      "Вставьте ключ в разделе «Каналы»",
    ],
  },
  {
    id: "wa",
    label: "WhatsApp",
    emoji: "🟢",
    time: "≈ 10 минут",
    steps: [
      "Понадобится WhatsApp Business API (через провайдера)",
      "Получите номер и токен доступа",
      "Укажите их в разделе «Интеграции»",
      "Подтвердите номер по инструкции провайдера",
    ],
  },
  {
    id: "max",
    label: "MAX",
    emoji: "🟣",
    time: "≈ 3 минуты",
    steps: [
      "Создайте бота в мессенджере MAX",
      "Получите токен бота",
      "Вставьте токен в разделе «Каналы»",
      "Проверьте связь тестовым сообщением",
    ],
  },
  {
    id: "site",
    label: "Сайт",
    emoji: "🌐",
    time: "≈ 2 минуты",
    steps: [
      "Откройте раздел «Каналы» → «Виджет для сайта»",
      "Скопируйте код виджета",
      "Вставьте его перед тегом </body> на сайте",
      "Кнопка чата появится в углу страницы",
    ],
  },
  {
    id: "multi",
    label: "Несколько площадок",
    emoji: "🔗",
    time: "по инструкции каждой",
    steps: [
      "Бот работает во всех каналах одновременно",
      "Подключите каждую площадку по её инструкции",
      "Один сценарий — все мессенджеры сразу",
      "Диалоги и клиенты собираются в одном месте",
    ],
  },
];

const TEMPLATES: Tmpl[] = [
  {
    id: "lead", label: "Получение заявки", emoji: "📥",
    desc: "Приветствие, сбор имени и телефона, передача менеджеру.",
    result: "Соберёт имя и телефон, передаст менеджеру",
    example: [
      { me: false, text: "Здравствуйте! Оставьте заявку — перезвоним. Как вас зовут?" },
      { me: true, text: "Иван" },
      { me: false, text: "Иван, оставьте номер телефона 📱" },
      { me: true, text: "+7 900 000-00-00" },
      { me: false, text: "Спасибо! Менеджер свяжется с вами в ближайшее время ✅" },
    ],
  },
  {
    id: "consult", label: "Консультация клиента", emoji: "💡",
    desc: "Отвечает на вопросы и уточняет, что именно нужно клиенту.",
    result: "Ответит на вопросы и уточнит потребность",
    example: [
      { me: true, text: "Подскажите по услугам" },
      { me: false, text: "Конечно! Что вас интересует — маникюр, педикюр или уход?" },
      { me: true, text: "Маникюр" },
      { me: false, text: "Отлично! Классический — 1500 ₽, с покрытием — 2200 ₽. Записать вас?" },
    ],
  },
  {
    id: "product", label: "Продажа товара", emoji: "🛒",
    desc: "Показывает товар, отвечает на вопросы и оформляет оплату.",
    result: "Покажет товар и оформит оплату",
    example: [
      { me: true, text: "Хочу купить курс" },
      { me: false, text: "Курс «Старт» — 4900 ₽: 12 уроков и обратная связь. Оформляем?" },
      { me: true, text: "Да" },
      { me: false, text: "Ссылка на оплату: pay.example/… После оплаты пришлю доступ 🎉" },
    ],
  },
  {
    id: "booking", label: "Запись на услугу", emoji: "📅",
    desc: "Подбирает удобное время и записывает клиента на приём.",
    result: "Подберёт время и запишет клиента",
    example: [
      { me: true, text: "Хочу записаться" },
      { me: false, text: "На какую услугу и когда удобно? Есть Пн–Сб 10:00–20:00" },
      { me: true, text: "Маникюр, суббота" },
      { me: false, text: "Записала на субботу 14:00. Напомню за день до визита 🔔" },
    ],
  },
  {
    id: "faq", label: "Ответы на частые вопросы", emoji: "❓",
    desc: "Распознаёт вопрос по смыслу и сразу даёт готовый ответ.",
    result: "Отвечает на типовые вопросы сам",
    example: [
      { me: true, text: "Где вы находитесь?" },
      { me: false, text: "Мы на ул. Пушкина, 10. Работаем Пн–Сб 10:00–20:00 🕙" },
      { me: true, text: "А доставка есть?" },
      { me: false, text: "Да, по городу за 1–2 дня. Оформить заказ?" },
    ],
  },
  {
    id: "qualify", label: "Квалификация клиента", emoji: "🎯",
    desc: "Задаёт вопросы и оценивает, насколько заявка целевая.",
    result: "Задаст вопросы и оценит заявку",
    example: [
      { me: false, text: "Пара вопросов, чтобы подобрать решение. Какой бюджет?" },
      { me: true, text: "До 50 000 ₽" },
      { me: false, text: "Когда планируете начать?" },
      { me: true, text: "В этом месяце" },
      { me: false, text: "Отлично, вы наш клиент! Передаю менеджеру 🔥" },
    ],
  },
  {
    id: "support", label: "Поддержка клиентов", emoji: "🛟",
    desc: "Принимает обращение, уточняет детали и заводит тикет.",
    result: "Примет обращение и заведёт тикет",
    example: [
      { me: true, text: "Не приходит заказ" },
      { me: false, text: "Сожалею! Назовите номер заказа — проверю статус." },
      { me: true, text: "№10234" },
      { me: false, text: "Завёл обращение №58, специалист ответит в течение часа 🛟" },
    ],
  },
  {
    id: "order", label: "Оформление заказа", emoji: "📦",
    desc: "Собирает состав заказа и данные доставки.",
    result: "Соберёт заказ и данные доставки",
    example: [
      { me: true, text: "Хочу заказать 2 пиццы" },
      { me: false, text: "Принял: 2 пиццы. Укажите адрес доставки 📍" },
      { me: true, text: "ул. Ленина, 5" },
      { me: false, text: "Итого 1290 ₽, доставим за 40 минут. Подтверждаете?" },
    ],
  },
  {
    id: "magnet", label: "Выдача бесплатного материала", emoji: "🎁",
    desc: "Проверяет подписку на канал и выдаёт бонус подписчикам.",
    result: "Проверит подписку и выдаст бонус",
    example: [
      { me: true, text: "Хочу гайд" },
      { me: false, text: "Подпишитесь на канал @example и нажмите «Проверить»." },
      { me: true, text: "Проверить" },
      { me: false, text: "Подписка есть! Ваш бонус: example.com/gift 🎁" },
    ],
  },
  {
    id: "custom", label: "Индивидуальный сценарий", emoji: "✨",
    desc: "Соберём структуру под вашу задачу по описанию из мастера.",
    result: "Соберём под вашу задачу",
    example: [
      { me: false, text: "Здравствуйте! Я бот вашей компании 🤖" },
      { me: false, text: "Дальше — ваши шаги: вопросы, кнопки, действия и передача менеджеру." },
      { me: false, text: "Опишите задачу — соберём сценарий именно под неё." },
    ],
  },
];

const STEPS = ["Цель", "Площадка", "О бизнесе", "Сценарий", "Ассистент", "Запуск"];

export default function WizardClient() {
  const [step, setStep] = useState(0);

  const [goal, setGoal] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  // Подключение Telegram-бота (метаданные без самого токена).
  const [tg, setTg] = useState<TgInfo | null>(null);
  const [connectLater, setConnectLater] = useState(false);
  const [biz, setBiz] = useState({ name: "", about: "", products: "", clients: "", contacts: "", schedule: "", site: "" });
  const [tmpl, setTmpl] = useState<string>("");
  const [asstName, setAsstName] = useState("Анна");
  const [asstStyle, setAsstStyle] = useState<AssistantStyle>("friendly");
  const [asstStyleCustom, setAsstStyleCustom] = useState("");
  const [asstKnow, setAsstKnow] = useState<string[]>([]);
  const [asstKnows, setAsstKnows] = useState(false);

  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [testInput, setTestInput] = useState("");
  const [testLog, setTestLog] = useState<{ me: boolean; text: string }[]>([]);
  const [launched, setLaunched] = useState(false);
  const [builtId, setBuiltId] = useState("");

  // Автозаполнение карточки бизнеса по сайту.
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Предпросмотр примера сценария (шаг «Сценарий»).
  const [preview, setPreview] = useState<Tmpl | null>(null);

  const goalObj = GOALS.find((g) => g.id === goal);
  const platObj = PLATFORMS.find((p) => p.id === platform);
  const tmplObj = TEMPLATES.find((t) => t.id === tmpl);

  // На шаге площадки для Telegram требуем подключение бота (или «Подключить позже»).
  const platformOk = platform === "tg" ? (!!tg || connectLater) : !!platform;
  const canNext =
    (step === 0 && !!goal) ||
    (step === 1 && platformOk) ||
    (step === 2 && biz.name.trim().length > 0) ||
    (step === 3 && !!tmpl) ||
    step === 4 ||
    step === 5;

  function patchBiz(p: Partial<typeof biz>) {
    setBiz((b) => ({ ...b, ...p }));
  }

  async function fillFromSite() {
    const url = biz.site.trim();
    if (!url || analyzing) return;
    setAnalyzing(true);
    setAnalyzeMsg(null);
    try {
      const res = await fetch("/api/analyze-site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.data) throw new Error(data.error || "Не удалось прочитать сайт");
      const d = data.data as Partial<typeof biz>;
      // Заполняем только пустые поля, чтобы не затирать введённое вручную.
      setBiz((b) => ({
        name: b.name || d.name || "",
        about: b.about || d.about || "",
        products: b.products || d.products || "",
        clients: b.clients || d.clients || "",
        contacts: b.contacts || d.contacts || "",
        schedule: b.schedule || d.schedule || "",
        site: b.site,
      }));
      setAnalyzeMsg({
        ok: true,
        text: data.source === "claude" ? "Готово! Поля заполнены по сайту — проверьте и поправьте." : "Заполнили основное по сайту. Остальное добавьте вручную.",
      });
    } catch (e: any) {
      setAnalyzeMsg({ ok: false, text: e?.message || "Не удалось прочитать сайт. Заполните поля вручную." });
    } finally {
      setAnalyzing(false);
    }
  }

  function styleText(): string {
    if (asstStyle === "custom") return asstStyleCustom.trim() || "в вашем стиле";
    return STYLE_LABELS[asstStyle].toLowerCase();
  }

  function toggleKnow(k: string) {
    setAsstKnow((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
    setAsstKnows(false);
  }

  // Собирает объект ассистента из текущих ответов мастера.
  function buildAssistant(): Assistant {
    return {
      name: asstName,
      style: asstStyle,
      styleCustom: asstStyleCustom,
      knowledge: asstKnow,
      forbidden: "",
      examples: [],
      role:
        `Ты — ${asstName}, ИИ-ассистент компании «${biz.name || "—"}». ` +
        `Общайся ${styleText()}. ${biz.about ? "О компании: " + biz.about + ". " : ""}` +
        `${biz.products ? "Товары и услуги: " + biz.products + ". " : ""}` +
        `${asstKnow.length ? "Опирайся на источники: " + asstKnow.join(", ") + ". " : ""}` +
        `Помогай клиенту, отвечай на вопросы, предлагай оставить заявку и подсказывай следующий шаг. ` +
        `Не знаешь ответа — предложи связать с менеджером.`,
    };
  }

  function autoInstructions() {
    // Ассистент сохраняется при запуске под id созданного бота.
    setAsstKnows(true);
  }

  // Приветствие бота в предпросмотре — первая реплика выбранного сценария.
  const greeting =
    tmplObj?.example.find((m) => !m.me)?.text ||
    `Здравствуйте! ${biz.name ? `Это ${biz.name}. ` : ""}Чем могу помочь?`;

  function sendTest() {
    const v = testInput.trim();
    if (!v) return;
    // Ответы берём из примера сценария по порядку (приветствие уже показано).
    const botLines = (tmplObj?.example || []).filter((m) => !m.me).map((m) => m.text);
    const replyIdx = testLog.filter((m) => !m.me).length + 1;
    const reply =
      botLines[replyIdx] ||
      `Подскажу подробнее и помогу оставить заявку 🙂 ${biz.contacts ? `Или свяжитесь напрямую: ${biz.contacts}.` : "Оставьте контакт — менеджер свяжется с вами."}`;
    setTestLog((l) => [...l, { me: true, text: v }, { me: false, text: reply }]);
    setTestInput("");
  }

  function buildPrompt(): string {
    return [
      `Собери сценарий чат-бота.`,
      goalObj && `Цель: ${goalObj.label}.`,
      platObj && `Площадка: ${platObj.label}.`,
      biz.name && `Компания: ${biz.name}.`,
      biz.about && `Чем занимается: ${biz.about}.`,
      biz.products && `Товары/услуги: ${biz.products}.`,
      biz.clients && `Клиенты: ${biz.clients}.`,
      tmplObj && `Тип сценария: ${tmplObj.label} — ${tmplObj.result}.`,
      `Ассистент по имени ${asstName}, стиль общения: ${STYLE_LABELS[asstStyle]}.`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function launch() {
    if (building) return;
    setBuilding(true);
    setError("");
    // Сохраняем ассистента и бриф.
    autoInstructions();
    try {
      localStorage.setItem("sb_bot_brief", JSON.stringify({ goal, platform, biz, tmpl, asstName, asstStyle, at: Date.now() }));
    } catch {}
    try {
      const res = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt() }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.nodes)) throw new Error(data.error || "bad");
      const s: Scenario = {
        id: uid("s"),
        name: biz.name ? `${biz.name} — ${tmplObj?.label || goalObj?.label || "бот"}` : `Бот: ${tmplObj?.label || goalObj?.label || "сценарий"}`,
        allChannels: true,
        published: false,
        nodes: data.nodes,
        edges: data.edges || [],
        updatedAt: Date.now(),
      };
      // Создаём бота и сохраняем его собственного ассистента.
      const bot = addBot({
        name: biz.name || `Бот: ${tmplObj?.label || goalObj?.label || "сценарий"}`,
        goal: goalObj?.label,
        platform: platObj?.label,
        scenarioId: s.id,
        status: "active",
        tgConnected: platform === "tg" && !!tg,
        tgUsername: tg?.username,
      });
      s.botId = bot.id;
      upsertScenario(s);
      saveAssistant(bot.id, buildAssistant());
      setBuiltId(s.id);
      setBuilding(false);
      setLaunched(true);
    } catch {
      // Не удалось собрать через ИИ — ведём в раздел сценариев.
      setBuilding(false);
      setError("Не удалось автоматически собрать сценарий. Откройте раздел «Сценарии» и соберите вручную или повторите.");
    }
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Создать бота", "Мастер"]} />
      <div className="content" style={{ maxWidth: 820 }}>
        {/* Прогресс */}
        <div className="wz-progress">
          {STEPS.map((s, i) => (
            <div key={s} className={`wz-step${i === step ? " on" : ""}${i < step ? " done" : ""}`}>
              <span className="wz-step__dot">{i < step ? "✓" : i + 1}</span>
              <span className="wz-step__label">{s}</span>
            </div>
          ))}
        </div>

        {/* Шаг 1 — цель */}
        {step === 0 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Что должен делать бот?</h1>
            <p className="muted wz-sub">Выберите цель — система автоматически подготовит структуру бота.</p>
            <div className="wz-cards wz-cards--goals">
              {GOALS.map((g) => (
                <button key={g.id} className={`wz-card wz-goal${goal === g.id ? " on" : ""}`} onClick={() => setGoal(g.id)} type="button">
                  <span className="wz-card__emoji">{g.emoji}</span>
                  <span className="wz-goal__body">
                    <span className="wz-card__label">{g.label}</span>
                    <span className="wz-goal__desc">{g.desc}</span>
                  </span>
                  {goal === g.id && <span className="wz-goal__check">✓</span>}
                </button>
              ))}
            </div>

            {goalObj ? (
              <div className="wz-prepare">
                <div className="wz-prepare__head">
                  <span className="wz-prepare__ico"><IconSpark className="ico" /></span>
                  Система подготовит структуру для «{goalObj.label}»:
                </div>
                <div className="wz-prepare__flow">
                  {goalObj.prepares.map((p, i) => (
                    <span key={i} className="wz-prepare__step">
                      {p}
                      {i < goalObj.prepares.length - 1 && <span className="wz-prepare__arr">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="wz-hint">💡 Подсказка: выберите задачу, а система автоматически подготовит структуру бота.</div>
            )}
          </div>
        )}

        {/* Шаг 2 — площадка */}
        {step === 1 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Где будет работать бот?</h1>
            <p className="muted wz-sub">Выберите площадку — покажем простую инструкцию подключения.</p>
            <div className="wz-cards">
              {PLATFORMS.map((p) => (
                <button key={p.id} className={`wz-card${platform === p.id ? " on" : ""}`} onClick={() => setPlatform(p.id)} type="button">
                  <span className="wz-card__emoji">{p.emoji}</span>
                  <span className="wz-card__label">{p.label}</span>
                </button>
              ))}
            </div>

            {platObj ? (
              <div className="wz-connect">
                <div className="wz-connect__head">
                  <span className="wz-connect__emoji">{platObj.emoji}</span>
                  <span>Как подключить «{platObj.label}»</span>
                  <span className="wz-connect__time">{platObj.time}</span>
                </div>
                <ol className="wz-connect__steps">
                  {platObj.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                {platObj.id === "tg" ? (
                  <TgConnect
                    connected={tg}
                    onConnected={(info) => { setTg(info); setConnectLater(false); }}
                    onDisconnect={() => setTg(null)}
                  />
                ) : (
                  <div className="wz-connect__note">Подключить площадку можно после создания — в разделе «Каналы».</div>
                )}
              </div>
            ) : (
              <div className="wz-hint">💡 Подсказка: выберите площадку — покажем пошаговую инструкцию подключения.</div>
            )}
          </div>
        )}

        {/* Шаг 3 — о бизнесе */}
        {step === 2 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Расскажите о бизнесе</h1>
            <p className="muted wz-sub">Чем подробнее — тем точнее бот и ассистент. Обязательно только название.</p>

            {/* Автозаполнение по сайту */}
            <div className="wz-autofill">
              <div className="wz-autofill__row">
                <div className="wz-autofill__field">
                  <span className="wz-autofill__ico"><IconSpark className="ico" /></span>
                  <input
                    className="wz-autofill__inp"
                    value={biz.site}
                    onChange={(e) => patchBiz({ site: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && fillFromSite()}
                    placeholder="Вставьте ссылку на сайт или соцсети…"
                  />
                </div>
                <button className="btn btn-ai" onClick={fillFromSite} disabled={analyzing || !biz.site.trim()} type="button">
                  {analyzing ? "Анализируем сайт…" : "Заполнить автоматически по сайту"}
                </button>
              </div>
              <div className="wz-autofill__hint">
                ИИ прочитает сайт и заполнит поля ниже — вам останется проверить и поправить.
              </div>
              {analyzeMsg && (
                <div className={`wz-autofill__msg${analyzeMsg.ok ? " ok" : " err"}`}>
                  {analyzeMsg.ok ? "✓ " : "⚠ "}{analyzeMsg.text}
                </div>
              )}
            </div>

            <div className="wz-form">
              <div className="field">
                <label className="label">Название компании *</label>
                <input className="input" value={biz.name} onChange={(e) => patchBiz({ name: e.target.value })} placeholder="Например: Студия «Ромашка»" autoFocus />
              </div>
              <div className="wz-form__row">
                <div className="field">
                  <label className="label">Чем занимается</label>
                  <input className="input" value={biz.about} onChange={(e) => patchBiz({ about: e.target.value })} placeholder="Маникюр и уход" />
                </div>
                <div className="field">
                  <label className="label">Товары или услуги</label>
                  <input className="input" value={biz.products} onChange={(e) => patchBiz({ products: e.target.value })} placeholder="Маникюр, педикюр, наращивание" />
                </div>
              </div>
              <div className="wz-form__row">
                <div className="field">
                  <label className="label">Кто клиенты</label>
                  <input className="input" value={biz.clients} onChange={(e) => patchBiz({ clients: e.target.value })} placeholder="Женщины 25–45, район центра" />
                </div>
                <div className="field">
                  <label className="label">График работы</label>
                  <input className="input" value={biz.schedule} onChange={(e) => patchBiz({ schedule: e.target.value })} placeholder="Пн–Сб 10:00–20:00" />
                </div>
              </div>
              <div className="wz-form__row">
                <div className="field">
                  <label className="label">Контакты</label>
                  <input className="input" value={biz.contacts} onChange={(e) => patchBiz({ contacts: e.target.value })} placeholder="+7 900 000-00-00" />
                </div>
                <div className="field">
                  <label className="label">Сайт или соцсети</label>
                  <input className="input" value={biz.site} onChange={(e) => patchBiz({ site: e.target.value })} placeholder="https://…" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Шаг 4 — сценарий */}
        {step === 3 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Выберите готовый сценарий</h1>
            <p className="muted wz-sub">Его можно доработать в редакторе после создания.</p>
            <div className="wz-tmpls">
              {TEMPLATES.map((t) => (
                <div key={t.id} className={`wz-tmpl2${tmpl === t.id ? " on" : ""}`}>
                  <div className="wz-tmpl2__head">
                    <span className="wz-tmpl2__emoji">{t.emoji}</span>
                    <span className="wz-tmpl2__label">{t.label}</span>
                    {tmpl === t.id && <span className="wz-tmpl2__check">✓</span>}
                  </div>
                  <div className="wz-tmpl2__desc">{t.desc}</div>
                  <div className="wz-tmpl2__res"><span className="wz-tmpl2__reslabel">Результат:</span> {t.result}</div>
                  <div className="wz-tmpl2__actions">
                    <button className="btn btn-primary btn-sm" onClick={() => setTmpl(t.id)} type="button">
                      {tmpl === t.id ? "Выбрано ✓" : "Использовать"}
                    </button>
                    <button className="btn btn-sm" onClick={() => setPreview(t)} type="button">Посмотреть пример</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Шаг 5 — ассистент */}
        {step === 4 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Настройте ИИ-ассистента</h1>
            <p className="muted wz-sub">Пара простых полей — остальное соберётся автоматически.</p>

            <div className="wz-form" style={{ maxWidth: 680 }}>
              <div className="field">
                <label className="label">Как зовут ассистента?</label>
                <input className="input" style={{ maxWidth: 320 }} value={asstName} onChange={(e) => setAsstName(e.target.value)} placeholder="Например: Анна, Алекс, SmartBot" />
              </div>

              <div className="field">
                <label className="label">Как он должен общаться?</label>
                <div className="asst-know">
                  {(Object.keys(STYLE_LABELS) as AssistantStyle[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`asst-chip${asstStyle === s ? " on" : ""}`}
                      onClick={() => { setAsstStyle(s); setAsstKnows(false); }}
                    >
                      {asstStyle === s ? "✓ " : ""}{STYLE_LABELS[s]}
                    </button>
                  ))}
                </div>
                {asstStyle === "custom" && (
                  <input
                    className="input"
                    style={{ marginTop: 10, maxWidth: 420 }}
                    value={asstStyleCustom}
                    onChange={(e) => { setAsstStyleCustom(e.target.value); setAsstKnows(false); }}
                    placeholder="Опишите свой стиль: например «тепло, с юмором, на «ты»»"
                  />
                )}
              </div>

              <div className="field">
                <label className="label">Что ассистент должен знать?</label>
                <div className="asst-know">
                  {KNOWLEDGE_OPTIONS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`asst-chip${asstKnow.includes(k) ? " on" : ""}`}
                      onClick={() => toggleKnow(k)}
                    >
                      {asstKnow.includes(k) ? "✓ " : "+ "}{k}
                    </button>
                  ))}
                </div>
                <div className="hint">Отметьте источники — на сервере ассистент обучится на них.</div>
              </div>

              <button className="btn btn-ai" onClick={autoInstructions} type="button">
                <IconSpark className="ico" /> Создать инструкции автоматически
              </button>
              {asstKnows && (
                <div className="wz-asst-done">
                  ✓ Готово! Ассистент <b>{asstName}</b> будет общаться «{styleText()}»
                  {asstKnow.length > 0 && <> и опираться на: {asstKnow.join(", ")}</>}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Шаг 6 — проверка и запуск */}
        {step === 5 && !launched && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Проверьте и запустите</h1>
            <p className="muted wz-sub">Готовый бот — в окне предпросмотра. Напишите тестовое сообщение и посмотрите ответ.</p>

            <div className="wz-summary">
              <div className="wz-sum"><span>Задача</span><b>{goalObj?.label || "—"}</b></div>
              <div className="wz-sum"><span>Площадка</span><b>{platObj?.label || "—"}</b></div>
              <div className="wz-sum"><span>Компания</span><b>{biz.name || "—"}</b></div>
              <div className="wz-sum"><span>Сценарий</span><b>{tmplObj?.label || "—"}</b></div>
              <div className="wz-sum"><span>Ассистент</span><b>{asstName} · {asstStyle === "custom" ? (asstStyleCustom.trim() || "свой стиль") : STYLE_LABELS[asstStyle]}</b></div>
            </div>

            <div className="wz-preview">
              <div className="wz-preview__head">🤖 Предпросмотр диалога · {asstName}</div>
              <div className="wz-preview__body">
                <div className="wz-msg">{greeting}</div>
                {testLog.map((m, i) => (
                  <div key={i} className={`wz-msg${m.me ? " me" : ""}`}>{m.text}</div>
                ))}
              </div>
              <div className="wz-preview__input">
                <input className="input" value={testInput} onChange={(e) => setTestInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTest()} placeholder="Тестовое сообщение…" />
                <button className="btn" onClick={sendTest} type="button">Отправить</button>
              </div>
            </div>

            <div className="wz-actions">
              <Link href="/dashboard/assistant" className="wz-act">✏️ Исправить ответы</Link>
              <Link href="/dashboard/billing" className="wz-act">🎨 Изменить оформление</Link>
              <Link href="/dashboard/scenarios" className="wz-act">➕ Добавить сценарий</Link>
              <Link href="/dashboard/team" className="wz-act">👤 Подключить менеджера</Link>
            </div>

            {error && <div className="hint" style={{ color: "#ef4444" }}>{error}</div>}
          </div>
        )}

        {/* Экран успеха после запуска */}
        {step === 5 && launched && (
          <div className="wz-panel wz-launched">
            <div className="wz-launched__ico">✅</div>
            <h1 className="h1" style={{ marginBottom: 8 }}>Бот готов и уже может принимать сообщения</h1>
            <p className="muted" style={{ maxWidth: 480, margin: "0 auto 24px" }}>
              Сценарий собран и сохранён. Подключите канал — и бот начнёт отвечать клиентам
              в мессенджере. Всё можно доработать в редакторе.
            </p>
            <div className="wz-launched__actions">
              <Link href={`/dashboard/scenarios/${builtId}`} className="btn btn-primary btn-lg">Открыть в редакторе</Link>
              <Link href="/dashboard/channels" className="btn btn-lg">Подключить канал</Link>
              <Link href="/dashboard" className="btn">На главную</Link>
            </div>
          </div>
        )}

        {/* Навигация */}
        {!launched && (
        <div className="wz-nav">
          {step > 0 ? (
            <button className="btn" onClick={() => setStep((s) => s - 1)} disabled={building}>← Назад</button>
          ) : (
            <Link href="/dashboard/create" className="btn">← Отмена</Link>
          )}
          <div style={{ flex: 1 }} />
          {step === 1 && platform === "tg" && !tg && !connectLater && (
            <button className="btn-link wz-later" onClick={() => setConnectLater(true)} type="button">Подключить позже</button>
          )}
          {step < 5 ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Далее →
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={launch} disabled={building}>
              {building ? "Собираем бота…" : "🚀 Запустить бота"}
            </button>
          )}
        </div>
        )}
      </div>

      {/* Пример сценария */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal__head">
              <b>{preview.emoji} {preview.label}</b>
              <button className="fn__x dark" onClick={() => setPreview(null)}>✕</button>
            </div>
            <p className="muted" style={{ margin: "10px 0 4px" }}>{preview.desc}</p>
            <div className="wz-exchat">
              {preview.example.map((m, i) => (
                <div key={i} className={`wz-msg${m.me ? " me" : ""}`}>{m.text}</div>
              ))}
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn" onClick={() => setPreview(null)}>Закрыть</button>
              <button
                className="btn btn-primary"
                onClick={() => { setTmpl(preview.id); setPreview(null); }}
              >
                Использовать этот сценарий
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
