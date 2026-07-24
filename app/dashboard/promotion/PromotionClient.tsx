"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark } from "@/components/icons";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";
import { loadUsers } from "@/lib/users";
import { loadLabels } from "@/lib/stats";
import Scheduler from "./Scheduler";
import { ScheduledPost, PostStatus, loadPosts, savePosts, upsertPost, pid } from "@/lib/schedule";
import { cityById, wallToInstant, formatInTz, mskLabel } from "@/lib/tz";

type Ch = "autopost" | "mailing" | "ai_reply" | "funnel";

type Period = "hour" | "day" | "month";
type LimitKey = "channels" | "posts" | "mailings" | "auto";
type LimitSet = Record<LimitKey, Record<Period, number>>;

type Material = { kind: "chat" | "post" | "account"; title: string; meta: string };
type PlanItem = { day: string; theme: string; format: string };

type Campaign = {
  projectType: "bot" | "channel" | "product" | "service";
  projectRef: string;
  goal: string;
  audienceMode: "" | "ai" | "import" | "own";
  audienceKeywords: string;
  parseSource: string;
  excludeBots: boolean;
  dedup: boolean;
  materials: Material[];
  contentTypes: string[];
  drafts: string[];
  images: string[];
  plan: PlanItem[];
  channels: Ch[];
  mailSegment: string;
  autopostFreq: string;
  autopostTime: string;
  growth: string[];
  automation: string[];
  limits: LimitSet;
  scheduleStart: string;
  consent: boolean;
  saved: number[];
};

const LIMIT_GROUPS: { id: LimitKey; label: string; icon: string; desc: string; rec: Record<Period, number> }[] = [
  { id: "channels", label: "Каналы и подписки", icon: "📢", desc: "Сколько каналов и подписок можно добавить за период. Много подписок с нового аккаунта — риск блокировки.", rec: { hour: 5, day: 20, month: 200 } },
  { id: "posts", label: "Посты и публикации", icon: "📝", desc: "Сколько постов публикуется. Слишком частые публикации утомляют аудиторию и снижают охваты.", rec: { hour: 3, day: 10, month: 150 } },
  { id: "mailings", label: "Рассылки и сообщения", icon: "✉️", desc: "Сколько личных сообщений отправляется. Превышение ведёт к спам-блоку аккаунта.", rec: { hour: 20, day: 100, month: 1500 } },
  { id: "auto", label: "Автоматические действия", icon: "⚙️", desc: "Автоответы, вступления, реакции и другие действия бота. Держите умеренными для безопасности.", rec: { hour: 30, day: 150, month: 2000 } },
];
const RECOMMENDED: LimitSet = LIMIT_GROUPS.reduce((a, g) => ({ ...a, [g.id]: { ...g.rec } }), {} as LimitSet);

const DEFAULT: Campaign = {
  projectType: "bot", projectRef: "", goal: "",
  audienceMode: "", audienceKeywords: "", parseSource: "Чаты конкурентов", excludeBots: true, dedup: true,
  materials: [], contentTypes: [], drafts: [], images: [], plan: [], channels: [], mailSegment: "Все клиенты",
  autopostFreq: "Каждый день", autopostTime: "12:00",
  growth: [], automation: [],
  limits: RECOMMENDED, scheduleStart: "Сразу", consent: false,
  saved: [],
};

const KEY = "sb_promotion";

const PROJECT_TYPES = [
  { id: "bot", label: "Бот", emoji: "🤖" },
  { id: "channel", label: "Канал", emoji: "📢" },
  { id: "product", label: "Товар", emoji: "🛒" },
  { id: "service", label: "Услуга", emoji: "🛠" },
] as const;

const GOALS = [
  { id: "subs", label: "Подписчики", emoji: "👥" },
  { id: "leads", label: "Заявки", emoji: "📥" },
  { id: "sales", label: "Продажи", emoji: "💰" },
  { id: "activity", label: "Активность", emoji: "🔥" },
];

const CONTENT_TYPES = ["Тексты", "Изображения", "Контент-план"];
const CHANNELS: { id: Ch; label: string; desc: string }[] = [
  { id: "autopost", label: "Автопостинг", desc: "Публикации по расписанию" },
  { id: "mailing", label: "Рассылки", desc: "Сообщения по своей базе" },
  { id: "ai_reply", label: "AI-ответы", desc: "Бот отвечает и собирает заявки" },
  { id: "funnel", label: "Автоворонки", desc: "Цепочки прогрева" },
];
const GROWTH = ["Реферальные ссылки", "Промокоды", "Конкурсы", "Лид-магниты"];
const AUTOMATION = ["CRM", "API", "Webhooks", "Триггеры"];

const STEPS = [
  {
    simple: "Что продвигаем?",
    pro: "Проект и цель",
    card: "Выберите бота, Telegram-канал, товар или услугу и одну цель. Это поможет настроить подходящий сценарий продвижения.",
    ai: "Начните с одного бота и цели «Подписчики» — так проще оценить первый результат.",
    optional: false,
  },
  {
    simple: "Кому показываем?",
    pro: "Аудитория",
    card: "Укажите, где брать аудиторию: AI-поиск по нише, импорт своей базы или подписчики бота.",
    ai: "Для старта включите AI-поиск и задайте 2–3 ключевых слова вашей ниши.",
    optional: true,
  },
  {
    simple: "Что публикуем?",
    pro: "Контент",
    card: "Отметьте, что подготовить: тексты, изображения, контент-план. Можно сгенерировать с помощью ИИ.",
    ai: "Достаточно 3–5 текстов и одного изображения — остальное добавите позже.",
    optional: true,
  },
  {
    simple: "Где продвигаем?",
    pro: "Каналы продвижения",
    card: "Выберите способы продвижения: автопостинг, рассылки, AI-ответы, автоворонки.",
    ai: "Новичку хватит автопостинга и AI-ответов — это самый простой старт.",
    optional: false,
  },
  {
    simple: "Когда публикуем?",
    pro: "Расписание",
    card: "Спланируйте публикации в календаре, задайте время и часовые пояса. ИИ может составить расписание за вас.",
    ai: "Публикуйте 1 раз в день в активное время аудитории. Нажмите «Умное расписание».",
    optional: false,
  },
  {
    simple: "Проверка и запуск",
    pro: "Запуск",
    card: "Задайте лимиты, подтвердите правила площадок и запустите продвижение.",
    ai: "Оставьте лимиты по умолчанию — они безопасны для нового аккаунта.",
    optional: false,
  },
];

export default function PromotionClient() {
  const [c, setC] = useState<Campaign>(DEFAULT);
  const [bots, setBots] = useState<Bot[]>([]);
  const [active, setActive] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [leads, setLeads] = useState(0);
  const [clients, setClients] = useState(0);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [lockMsg, setLockMsg] = useState("");
  const [stepErr, setStepErr] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  useEffect(() => {
    try {
      const b = loadBots();
      setBots(b);
      setClients(loadUsers().length);
      setLeads(loadLabels().find((l) => l.id === "sl_lead")?.count || 0);
      setPosts(loadPosts());
      const raw = localStorage.getItem(KEY);
      if (raw) setC({ ...DEFAULT, ...JSON.parse(raw) });
      else setC((p) => ({ ...p, projectRef: getCurrentBotId() || b[0]?.id || "" }));
    } catch {}
  }, []);

  function flashSaved() {
    setSavedFlash(true);
    window.clearTimeout((flashSaved as any)._t);
    (flashSaved as any)._t = window.setTimeout(() => setSavedFlash(false), 1800);
  }

  function patch(p: Partial<Campaign>) {
    setC((prev) => {
      const next = { ...prev, ...p };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    setLaunched(false);
    setStepErr("");
    flashSaved();
  }
  function toggleArr(field: "contentTypes" | "channels" | "growth" | "automation", v: string) {
    const cur = c[field] as string[];
    patch({ [field]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as any);
  }

  // Завершённость шагов.
  // Ближайшая публикация и счётчик для сводки.
  const sortedPosts = [...posts].filter((p) => p.status !== "published").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const nextPost = sortedPosts[0];
  const plannedCount = posts.length;

  function schedTime(p: ScheduledPost, cityId: string): string {
    if (p.regionMode === "local") return p.time;
    const instant = wallToInstant(p.date, p.time, cityById(p.cityId)?.tz || "Europe/Moscow");
    return formatInTz(instant, cityById(cityId)?.tz || "Europe/Moscow");
  }

  const isDone = (i: number): boolean => {
    switch (i) {
      case 0: return !!c.projectRef && !!c.goal;
      case 1: return c.saved.includes(1) || c.audienceMode !== "";
      case 2: return c.saved.includes(2) || c.contentTypes.length > 0;
      case 3: return c.channels.length > 0;
      case 4: return posts.length > 0;
      case 5: return c.consent;
      default: return false;
    }
  };
  const doneCount = STEPS.filter((_, i) => isDone(i)).length;
  const progress = Math.round((doneCount / STEPS.length) * 100);

  // Проверка перед запуском.
  const missing: string[] = [];
  if (!c.projectRef) missing.push("выбрать проект");
  if (!c.goal) missing.push("выбрать цель");
  if (!isDone(3)) missing.push("выбрать способ продвижения");
  if (c.contentTypes.length === 0) missing.push("добавить контент");
  if (posts.length === 0) missing.push("запланировать публикацию");
  if (!c.consent) missing.push("подтвердить правила");
  const canLaunch = missing.length === 0;

  // Визуальное состояние шага в шкале.
  function stepState(i: number): "done" | "current" | "error" | "empty" {
    if (i === active) return "current";
    if (isDone(i)) return "done";
    // Ошибка: обязательный шаг пропущен, а следующий уже заполнен.
    if (!STEPS[i].optional && STEPS.some((_, k) => k > i && isDone(k))) return "error";
    return "empty";
  }

  // Переход к шагу. Пока не выбран проект и цель — остальные шаги заблокированы.
  function goStep(i: number) {
    if (i > 0 && !isDone(0)) {
      setLockMsg("Сначала выберите проект и цель.");
      window.clearTimeout((goStep as any)._t);
      (goStep as any)._t = window.setTimeout(() => setLockMsg(""), 2600);
      return;
    }
    setLockMsg("");
    setStepErr("");
    setAdvanced(false);
    setStepsOpen(false);
    setActive(i);
  }

  // Что нужно заполнить, чтобы уйти с обязательного шага.
  function stepBlocker(i: number): string {
    if (STEPS[i].optional) return "";
    switch (i) {
      case 0: return !c.projectRef ? "Выберите проект." : !c.goal ? "Выберите цель продвижения." : "";
      case 3: return c.channels.length === 0 ? "Выберите хотя бы один способ продвижения." : "";
      case 4: return posts.length === 0 ? "Запланируйте хотя бы одну публикацию." : "";
      case 5: return !c.consent ? "Подтвердите правила площадок." : "";
      default: return "";
    }
  }

  function saveAndContinue(i: number) {
    const blocker = stepBlocker(i);
    if (blocker) { setStepErr(blocker); return; }
    const saved = c.saved.includes(i) ? c.saved : [...c.saved, i];
    patch({ saved });
    flashSaved();
    setAdvanced(false);
    if (i < STEPS.length - 1) setActive(i + 1);
  }

  function saveDraft() {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {}
    flashSaved();
  }

  // --- Парсинг и контент (весь процесс внутри вкладки «Продвижение») ---
  function keywords(): string[] {
    return (c.audienceKeywords || "").split(/[,\s]+/).filter(Boolean);
  }
  function topicOf(): string {
    const kw = keywords();
    if (kw[0]) return kw[0];
    const m = c.materials[0]?.title.replace(/[«»]/g, "").replace(/^Чат\s*/, "").replace(/^Популярный пост о\s*/, "");
    return m || "вашей теме";
  }

  function runParse() {
    const base = keywords().slice(0, 3);
    const list = base.length ? base : ["ваша ниша"];
    const found: Material[] = [];
    // Несколько чатов на каждое ключевое слово — «поиск чатов».
    list.forEach((k, i) => {
      found.push({ kind: "chat", title: `Чат «${k}»`, meta: `${420 + i * 137} участников · ${c.parseSource}` });
      found.push({ kind: "chat", title: `${k.charAt(0).toUpperCase() + k.slice(1)} — обсуждения`, meta: `${1200 + i * 210} участников · активный` });
      found.push({ kind: "post", title: `Популярный пост о «${k}»`, meta: `${20 + i * 9} реакций · высокий отклик` });
      found.push({ kind: "account", title: `@${(k.replace(/[^a-zа-я0-9_]/gi, "") || "expert")}_expert`, meta: `лидер мнений · ${1200 + i * 300} подписчиков` });
    });
    patch({ materials: found, audienceMode: c.audienceMode || "ai" });
  }

  function genImage(topic: string, i: number): string {
    const pairs = [["#7c5cff", "#b892ff"], ["#2b6ef6", "#5aa2ff"], ["#16a34a", "#4ade80"], ["#f59e0b", "#fbbf24"]];
    const [a, b] = pairs[i % pairs.length];
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 22);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='640' height='400' fill='url(#g)'/><circle cx='540' cy='90' r='120' fill='rgba(255,255,255,.12)'/><text x='44' y='215' font-family='Arial,sans-serif' font-size='40' font-weight='700' fill='#ffffff'>${esc(topic)}</text><text x='44' y='268' font-family='Arial,sans-serif' font-size='22' fill='rgba(255,255,255,.85)'>Изображение ${i + 1}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function generateContent() {
    const types = c.contentTypes.length ? c.contentTypes : ["Тексты"];
    const topic = topicOf();
    const upd: Partial<Campaign> = { contentTypes: types };
    if (types.includes("Тексты")) {
      upd.drafts = [
        `🔥 Разбираем «${topic}»: 3 ошибки новичков и как их избежать. Сохраняйте, чтобы не потерять.`,
        `Полезное по теме «${topic}». Отвечаем на частые вопросы подписчиков — пишите в комментариях 👇`,
        `Кейс: как получить результат в нише «${topic}» за 2 недели. Рассказываем по шагам внутри поста.`,
      ];
    }
    if (types.includes("Изображения")) {
      upd.images = [genImage(topic, 0), genImage(topic, 1), genImage(topic, 2)];
    }
    if (types.includes("Контент-план")) {
      const days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
      const themes = ["Полезный совет", "Разбор ошибки", "Кейс / результат", "Ответы на вопросы", "Оффер / акция", "Развлекательный пост", "Итоги недели"];
      const formats = ["Текст", "Текст + фото", "Опрос", "Текст", "Текст + фото", "Видео", "Текст"];
      upd.plan = days.map((d, i) => ({ day: d, theme: `${themes[i]} — «${topic}»`, format: formats[i] }));
    }
    patch(upd);
  }

  function createContentFromMaterials() {
    generateContent();
    setStepErr("");
    setActive(2);
  }

  function addImageToCalendar(topic: string, i: number) {
    addDraftToCalendarTyped(`🖼 Изображение к теме «${topic}» (${i + 1})`, "Изображение");
  }
  function addPlanToCalendar() {
    const existing = loadPosts();
    const startLen = existing.length;
    const list = c.plan.map((it, i) => {
      const d = new Date(); d.setDate(d.getDate() + startLen + i + 1);
      const p: ScheduledPost = {
        id: pid(), text: it.theme, channel: c.projectType === "channel" ? c.projectRef : "@my_channel",
        date: d.toISOString().slice(0, 10), time: "12:00", cityId: "moscow",
        regionMode: "sim", repeat: "Каждую неделю", type: it.format, status: "draft",
      };
      return p;
    });
    const all = [...existing, ...list];
    savePosts(all); setPosts(all); flashSaved();
  }

  function updateDraft(i: number, text: string) {
    patch({ drafts: c.drafts.map((d, k) => (k === i ? text : d)) });
  }
  function removeDraft(i: number) {
    patch({ drafts: c.drafts.filter((_, k) => k !== i) });
  }

  function addDraftToCalendarTyped(text: string, type: string) {
    const existing = loadPosts();
    const d = new Date(); d.setDate(d.getDate() + existing.length + 1);
    const p: ScheduledPost = {
      id: pid(), text, channel: c.projectType === "channel" ? c.projectRef : "@my_channel",
      date: d.toISOString().slice(0, 10), time: "12:00", cityId: "moscow",
      regionMode: "sim", repeat: "Один раз", type, status: "draft",
    };
    const list = upsertPost(p);
    setPosts(list);
    flashSaved();
  }
  function addDraftToCalendar(text: string) { addDraftToCalendarTyped(text, "Текст"); }
  function addAllDraftsToCalendar() {
    c.drafts.forEach((d) => d.trim() && addDraftToCalendar(d));
  }

  // --- Лимиты ---
  function setLimit(key: LimitKey, period: Period, value: string) {
    const n = Math.max(0, Math.min(100000, parseInt(value.replace(/\D/g, "") || "0", 10)));
    patch({ limits: { ...c.limits, [key]: { ...c.limits[key], [period]: n } } });
  }
  function setRecommendedLimits() { patch({ limits: JSON.parse(JSON.stringify(RECOMMENDED)) }); }
  function emergencyStop() {
    const list = loadPosts().map((p) => (p.status === "published" ? p : { ...p, status: "paused" as PostStatus }));
    savePosts(list); setPosts(list);
    setLaunched(false);
  }

  // Использование лимитов (что уже запланировано/настроено).
  const todayISO = new Date().toISOString().slice(0, 10);
  const usage: Record<LimitKey, Record<Period, number>> = {
    channels: { hour: 0, day: 0, month: c.channels.length },
    posts: { hour: 0, day: posts.filter((p) => p.date === todayISO).length, month: posts.length },
    mailings: { hour: 0, day: 0, month: 0 },
    auto: { hour: 0, day: 0, month: c.automation.length },
  };

  function autoSetup() {
    patch({
      audienceMode: c.audienceMode || "ai",
      contentTypes: c.contentTypes.length ? c.contentTypes : ["Тексты", "Изображения", "Контент-план"],
      channels: c.channels.length ? c.channels : ["autopost", "ai_reply"],
      growth: c.growth.length ? c.growth : ["Реферальные ссылки"],
      saved: Array.from(new Set([...c.saved, 1, 2, 3, 4])),
    });
    setActive(5);
  }

  function launch() {
    if (!canLaunch) return;
    if (c.projectType === "bot" && c.projectRef) setCurrentBotId(c.projectRef);
    setLaunched(true);
  }

  const projectName = c.projectType === "bot" ? (bots.find((b) => b.id === c.projectRef)?.name || "—") : (c.projectRef || "—");
  const goalName = GOALS.find((g) => g.id === c.goal)?.label || "—";
  const audienceName = c.audienceMode === "ai" ? "AI-поиск" : c.audienceMode === "import" ? "Импорт базы" : c.audienceMode === "own" ? "Своя база" : "—";
  const channelNames = c.channels.map((id) => CHANNELS.find((x) => x.id === id)?.label).filter(Boolean).join(", ") || "—";

  const nextPostLabel = nextPost
    ? `${new Date(nextPost.date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}, ${schedTime(nextPost, "moscow")} МСК`
    : "";
  const tzLabel = nextPost ? `${cityById(nextPost.cityId)?.name || "Москва"} · ${mskLabel(cityById(nextPost.cityId)?.tz || "Europe/Moscow")}` : "—";

  // Осталось сделать — конкретные действия с переходом к нужному шагу.
  const todos: { t: string; step: number }[] = [];
  if (!isDone(0)) todos.push({ t: "Выбрать проект и цель", step: 0 });
  if (c.channels.length === 0) todos.push({ t: "Выбрать каналы продвижения", step: 3 });
  if (c.contentTypes.length === 0) todos.push({ t: "Добавить контент", step: 2 });
  if (posts.length === 0) todos.push({ t: "Запланировать публикацию", step: 4 });
  if (!c.consent) todos.push({ t: "Подтвердить правила и запустить", step: 5 });

  const cur = STEPS[active];

  return (
    <>
      <Topbar crumbs={["Основной проект", "Продвижение"]} />
      <div className="content" style={{ maxWidth: 1240 }}>
        {/* Шапка: заголовок + номер активного шага */}
        <div className="st-head">
          <div>
            <h1 className="h1 st-h1">Продвижение</h1>
            <div className="st-head__sub">Шаг {active + 1} из {STEPS.length} — {cur.pro}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={autoSetup} type="button"><IconSpark className="ico" /> Настроить с ИИ</button>
        </div>

        {/* Мобильная шапка шага */}
        <div className="st-mob">
          <div className="st-mob__top">
            <span className="st-mob__step">Шаг {active + 1} из {STEPS.length}</span>
            <button className="st-mob__toggle" onClick={() => setStepsOpen((v) => !v)} type="button">{stepsOpen ? "Скрыть шаги" : "Все шаги"}</button>
          </div>
          <div className="st-mob__name">{cur.simple}</div>
          <div className="pw-progress__bar"><span style={{ width: `${progress}%` }} /></div>
        </div>

        {/* Горизонтальная шкала из шести шагов */}
        <div className={`st-bar${stepsOpen ? " st-bar--open" : ""}`}>
          {STEPS.map((s, i) => {
            const state = stepState(i);
            const locked = i > 0 && !isDone(0);
            return (
              <button key={i} className={`st-step st-step--${state}${locked ? " st-step--locked" : ""}`} onClick={() => goStep(i)} type="button">
                <span className="st-step__line" />
                <span className="st-step__dot">{state === "done" ? "✓" : i + 1}</span>
                <span className="st-step__labels">
                  <span className="st-step__simple">{s.simple}</span>
                  <span className="st-step__pro">{s.pro}</span>
                  {s.optional && <span className="st-step__opt">Можно пропустить</span>}
                </span>
              </button>
            );
          })}
        </div>
        {lockMsg && <div className="st-lock">🔒 {lockMsg}</div>}

        {/* Результаты после запуска */}
        {launched && (
          <div className="pw-results">
            <div className="pw-results__head">
              <b>✅ Продвижение запущено — «{projectName}», цель: {goalName}</b>
              <button className="btn btn-danger" onClick={() => setLaunched(false)} type="button">⛔ Экстренная остановка</button>
            </div>
            <div className="pw-metrics">
              {[
                { l: "Подписчики", v: "0" },
                { l: "Заявки", v: String(leads) },
                { l: "Продажи", v: "0 ₽" },
                { l: "Конверсия", v: "—" },
                { l: "Расходы", v: "0 ₽" },
                { l: "Рассылки", v: "—" },
              ].map((m) => (
                <div key={m.l} className="pw-metric"><div className="pw-metric__v">{m.v}</div><div className="pw-metric__l">{m.l}</div></div>
              ))}
            </div>
            <div className="pw-recs">
              <div className="pw-recs__t">💡 Рекомендации ИИ</div>
              <ul>
                <li>Соберите аудиторию в парсере и запустите первую рассылку по сегменту.</li>
                <li>Добавьте лид-магнит — он повышает конверсию в заявки.</li>
                <li>Публикуйте контент 1 раз в день в активное время вашей аудитории.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Рабочая карточка активного шага + панель */}
        <div className="st-grid">
          <div className="st-card">
            <div className="st-card__head">
              <span className="st-card__num">{active + 1}</span>
              <div className="st-card__headtext">
                <h2 className="st-card__title">Шаг {active + 1}. {cur.simple}</h2>
                <p className="st-card__desc">{cur.card}</p>
              </div>
              {cur.optional && <span className="st-card__opt">Можно пропустить</span>}
            </div>

            <div className="st-ai"><IconSpark className="ico" /><span><b>Подсказка ИИ.</b> {cur.ai}</span></div>

            <div className="st-card__body">
              {active === 0 && <Step1 c={c} bots={bots} patch={patch} />}
              {active === 1 && <Step2 c={c} patch={patch} runParse={runParse} createContent={createContentFromMaterials} />}
              {active === 2 && <Step3 c={c} patch={patch} toggleArr={toggleArr} generateContent={generateContent} updateDraft={updateDraft} removeDraft={removeDraft} addToCalendar={addDraftToCalendar} addAll={addAllDraftsToCalendar} addImage={addImageToCalendar} addPlan={addPlanToCalendar} topic={topicOf()} goSchedule={() => setActive(4)} />}
              {active === 3 && <Step4 c={c} patch={patch} toggleArr={toggleArr} advanced={advanced} setAdvanced={setAdvanced} />}
              {active === 4 && (
                <>
                  <Scheduler channel={c.projectType === "channel" ? c.projectRef : "@my_channel"} onChange={setPosts} />
                  <details className="pw-adv" style={{ marginTop: 16 }}>
                    <summary>Расширенные настройки — механики роста и автоматизация</summary>
                    <div style={{ marginTop: 10 }}><Step5 c={c} toggleArr={toggleArr} /></div>
                  </details>
                </>
              )}
              {active === 5 && <Step6 c={c} patch={patch} usage={usage} setLimit={setLimit} setRecommended={setRecommendedLimits} emergencyStop={emergencyStop} missing={missing} canLaunch={canLaunch} onLaunch={launch} />}
            </div>

            {stepErr && <div className="st-err">⚠ {stepErr}</div>}

            {/* Нижняя панель действий */}
            <div className="st-actions">
              <button className="btn btn-ghost" onClick={() => goStep(Math.max(0, active - 1))} disabled={active === 0} type="button">← Назад</button>
              <span className={`st-saved${savedFlash ? " show" : ""}`}>✓ Изменения сохранены</span>
              <div className="st-actions__right">
                <button className="btn" onClick={saveDraft} type="button">Сохранить черновик</button>
                {active < STEPS.length - 1 ? (
                  <button className="btn btn-primary" onClick={() => saveAndContinue(active)} type="button">Сохранить и продолжить →</button>
                ) : (
                  <button className="btn btn-primary" onClick={launch} disabled={!canLaunch} type="button">🚀 Запустить продвижение</button>
                )}
              </div>
            </div>
          </div>

          {/* Панель «Ваше продвижение» */}
          <aside className="st-panel">
            <div className="st-panel__card">
              <div className="st-panel__t">Ваше продвижение</div>
              <PanelRow label="Проект" value={c.projectRef ? projectName : "Проект не выбран"} ok={!!c.projectRef} />
              <PanelRow label="Цель" value={c.goal ? goalName : "Цель не указана"} ok={!!c.goal} />
              <PanelRow label="Аудитория" value={c.audienceMode ? audienceName : "Аудитория не задана"} ok={!!c.audienceMode} />
              <PanelRow label="Постов" value={plannedCount ? `${plannedCount} публ.` : "Публикаций нет"} ok={plannedCount > 0} />
              <PanelRow label="Каналы" value={c.channels.length ? channelNames : "Каналы не выбраны"} ok={c.channels.length > 0} />
              <PanelRow label="Ближайшая" value={nextPost ? nextPostLabel : "Расписание не настроено"} ok={!!nextPost} />
              <PanelRow label="Часовой пояс" value={tzLabel} ok={!!nextPost} />

              <div className="st-panel__ready">
                <span>Готовность</span>
                <b className={canLaunch ? "ok" : "warn"}>{canLaunch ? "Готово к запуску" : `${doneCount}/6 шагов`}</b>
              </div>

              {todos.length > 0 && (
                <div className="st-todo">
                  <div className="st-todo__t">Осталось сделать</div>
                  {todos.map((t) => (
                    <button key={t.step + t.t} className="st-todo__item" onClick={() => goStep(t.step)} type="button">
                      <span className="st-todo__mark">○</span> {t.t}
                    </button>
                  ))}
                </div>
              )}

              <button className="btn btn-primary st-panel__launch" onClick={launch} disabled={!canLaunch}>🚀 Запустить</button>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function PanelRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="st-prow">
      <span className="st-prow__l">{label}</span>
      <span className={`st-prow__v${ok ? " ok" : " muted"}`}>{value}</span>
    </div>
  );
}

/* ------- Шаги ------- */

function Chips({ items, sel, onPick, multi }: { items: { id: string; label: string; emoji?: string }[]; sel: string | string[]; onPick: (id: string) => void; multi?: boolean }) {
  const isOn = (id: string) => (multi ? (sel as string[]).includes(id) : sel === id);
  return (
    <div className="pw-chips">
      {items.map((it) => (
        <button key={it.id} className={`pw-chip${isOn(it.id) ? " on" : ""}`} onClick={() => onPick(it.id)} type="button">
          {multi ? (isOn(it.id) ? "✓ " : "+ ") : it.emoji ? it.emoji + " " : ""}{it.label}
        </button>
      ))}
    </div>
  );
}

function Step1({ c, bots, patch }: any) {
  return (
    <>
      <label className="pw-label">Что продвигаем</label>
      <Chips items={PROJECT_TYPES as any} sel={c.projectType} onPick={(id) => patch({ projectType: id, projectRef: id === "bot" ? (bots[0]?.id || "") : "" })} />
      <div style={{ marginTop: 10, marginBottom: 16 }}>
        {c.projectType === "bot" ? (
          <select className="select" style={{ maxWidth: 340 }} value={c.projectRef} onChange={(e) => patch({ projectRef: e.target.value })}>
            <option value="">Выберите бота…</option>
            {bots.map((b: Bot) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        ) : (
          <input className="input" style={{ maxWidth: 340 }} value={c.projectRef} onChange={(e) => patch({ projectRef: e.target.value })} placeholder={c.projectType === "channel" ? "@канал или ссылка" : "Название"} />
        )}
      </div>
      <label className="pw-label">Цель продвижения</label>
      <Chips items={GOALS} sel={c.goal} onPick={(id) => patch({ goal: id })} />
    </>
  );
}

const PARSE_SOURCES = ["Чаты конкурентов", "Тематические каналы", "Комментарии под постами", "Похожие аккаунты"];
const MAT_ICON: Record<Material["kind"], string> = { chat: "💬", post: "📄", account: "👤" };
const MAT_LABEL: Record<Material["kind"], string> = { chat: "Чат", post: "Пост", account: "Аккаунт" };

function Step2({ c, patch, runParse, createContent }: any) {
  const modes = [
    { id: "ai", label: "AI-поиск аудитории", emoji: "✨" },
    { id: "import", label: "Импорт своей базы", emoji: "📥" },
    { id: "own", label: "Подписчики бота", emoji: "👥" },
  ];
  const mats: Material[] = c.materials || [];
  return (
    <>
      <label className="pw-label">Откуда брать аудиторию</label>
      <Chips items={modes} sel={c.audienceMode} onPick={(id) => patch({ audienceMode: id })} />

      {/* Настройка парсинга — прямо здесь, без ухода на другую страницу */}
      <div className="cw-parse">
        <div className="cw-parse__t">🔍 Настройка парсинга</div>
        <div className="pw-grid2">
          <div className="field">
            <label className="pw-label">Ключевые слова ниши</label>
            <input className="input" value={c.audienceKeywords} onChange={(e) => patch({ audienceKeywords: e.target.value })} placeholder="крипто, трейдинг, инвестиции…" />
          </div>
          <div className="field">
            <label className="pw-label">Где искать</label>
            <select className="select" value={c.parseSource} onChange={(e) => patch({ parseSource: e.target.value })}>
              {PARSE_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <label className="pw-check"><input type="checkbox" checked={c.excludeBots} onChange={(e) => patch({ excludeBots: e.target.checked })} /> Исключить ботов и удалённые аккаунты</label>
        <label className="pw-check"><input type="checkbox" checked={c.dedup} onChange={(e) => patch({ dedup: e.target.checked })} /> Убирать дубликаты</label>
        <div className="pw-row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={runParse} type="button">🔍 Запустить парсинг</button>
          <Link href="/dashboard/user-parser" className="btn btn-ghost">Открыть большой парсер →</Link>
        </div>
      </div>

      {/* Найденные материалы — на этой же странице */}
      {mats.length > 0 && (
        <div className="cw-found">
          <div className="cw-found__head">
            <b>Найдено материалов: {mats.length}</b>
            <span className="muted">чаты, посты и аккаунты по вашей нише</span>
          </div>
          <div className="cw-found__list">
            {mats.map((m, i) => (
              <div key={i} className="cw-mat">
                <span className="cw-mat__ico">{MAT_ICON[m.kind]}</span>
                <div className="cw-mat__body">
                  <b>{m.title}</b>
                  <span className="muted">{MAT_LABEL[m.kind]} · {m.meta}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-ai cw-found__cta" onClick={createContent} type="button">
            <IconSpark className="ico" /> Создать контент на основе найденных материалов
          </button>
        </div>
      )}
    </>
  );
}

function Step3({ c, toggleArr, generateContent, updateDraft, removeDraft, addToCalendar, addAll, addImage, addPlan, topic, goSchedule }: any) {
  const drafts: string[] = c.drafts || [];
  const images: string[] = c.images || [];
  const plan: PlanItem[] = c.plan || [];
  const mats: Material[] = c.materials || [];
  const types: string[] = c.contentTypes || [];
  const wantText = types.includes("Тексты") || types.length === 0;
  const wantImg = types.includes("Изображения");
  const wantPlan = types.includes("Контент-план");
  const hasAny = drafts.length > 0 || images.length > 0 || plan.length > 0;

  return (
    <>
      <label className="pw-label">Что подготовить</label>
      <Chips items={CONTENT_TYPES.map((t) => ({ id: t, label: t }))} sel={c.contentTypes} onPick={(id) => toggleArr("contentTypes", id)} multi />

      {mats.length > 0 && (
        <div className="cw-basis">📎 Контент создаётся на основе {mats.length} найденных материалов из шага «Аудитория».</div>
      )}

      <div className="pw-row" style={{ marginTop: 14 }}>
        <button className="btn btn-ai" onClick={generateContent} type="button">
          <IconSpark className="ico" /> {hasAny ? "Сгенерировать заново" : "Сгенерировать контент с ИИ"}
        </button>
      </div>

      {!hasAny && (
        <div className="pw-tip">Выберите, что подготовить (тексты, изображения, контент-план), и нажмите «Сгенерировать контент с ИИ». Всё можно отредактировать здесь же.</div>
      )}

      {/* Тексты */}
      {wantText && drafts.length > 0 && (
        <div className="cw-drafts">
          {drafts.map((d, i) => (
            <div key={i} className="cw-draft">
              <div className="cw-draft__edit">
                <label className="pw-label">Пост {i + 1}</label>
                <textarea className="textarea" value={d} onChange={(e) => updateDraft(i, e.target.value)} style={{ minHeight: 92 }} />
                <div className="cw-draft__acts">
                  <button className="btn btn-sm btn-primary" onClick={() => addToCalendar(d)} type="button">📅 В календарь</button>
                  <button className="user-act del" onClick={() => removeDraft(i)} type="button">Удалить</button>
                </div>
              </div>
              <div className="cw-preview">
                <div className="cw-preview__t">Предпросмотр</div>
                <div className="cw-preview__bubble">{d || "Пустой пост"}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Изображения */}
      {wantImg && images.length > 0 && (
        <div className="cw-imgs">
          <div className="cw-sec__t">🖼 Изображения</div>
          <div className="cw-imgs__grid">
            {images.map((src, i) => (
              <div key={i} className="cw-img">
                <img src={src} alt={`Изображение ${i + 1}`} />
                <button className="btn btn-sm btn-primary" onClick={() => addImage(topic, i)} type="button">📅 В календарь</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Контент-план */}
      {wantPlan && plan.length > 0 && (
        <div className="cw-plan">
          <div className="cw-sec__t">📅 Контент-план на неделю</div>
          <table className="cw-plan__table">
            <thead><tr><th>День</th><th>Тема</th><th>Формат</th></tr></thead>
            <tbody>
              {plan.map((it, i) => (
                <tr key={i}><td>{it.day}</td><td>{it.theme}</td><td>{it.format}</td></tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-sm btn-primary" onClick={addPlan} type="button" style={{ marginTop: 10 }}>📅 Добавить весь план в календарь</button>
        </div>
      )}

      {hasAny && (
        <div className="pw-row" style={{ marginTop: 16 }}>
          {drafts.length > 0 && <button className="btn btn-primary" onClick={addAll} type="button">📅 Добавить все тексты в календарь</button>}
          <button className="btn btn-ghost" onClick={goSchedule} type="button">Перейти к расписанию →</button>
        </div>
      )}

      <div className="pw-inline-link" style={{ marginTop: 14 }}>
        Нужна сложная автоматизация (цепочки, ветвления)? <Link href="/dashboard/scenarios">Открыть раздел «Сценарии» →</Link>
      </div>
    </>
  );
}

function Step4({ c, patch, toggleArr, advanced, setAdvanced }: any) {
  return (
    <>
      <label className="pw-label">Способы продвижения</label>
      <div className="pw-cards">
        {CHANNELS.map((ch) => {
          const on = c.channels.includes(ch.id);
          return (
            <button key={ch.id} className={`pw-card${on ? " on" : ""}`} onClick={() => toggleArr("channels", ch.id)} type="button">
              <span className="pw-card__check">{on ? "✓" : ""}</span>
              <span className="pw-card__title">{ch.label}</span>
              <span className="pw-card__desc">{ch.desc}</span>
            </button>
          );
        })}
      </div>
      <details className="pw-adv" open={advanced} onToggle={(e: any) => setAdvanced(e.target.open)}>
        <summary>Расширенные настройки</summary>
        {c.channels.includes("autopost") && (
          <div className="pw-grid2" style={{ marginTop: 8 }}>
            <div className="field"><label className="pw-label">Частота постинга</label>
              <select className="select" value={c.autopostFreq} onChange={(e) => patch({ autopostFreq: e.target.value })}>
                {["Каждый день", "Через день", "По будням", "Раз в неделю"].map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="field"><label className="pw-label">Время</label>
              <input className="input" type="time" value={c.autopostTime} onChange={(e) => patch({ autopostTime: e.target.value })} /></div>
          </div>
        )}
        {c.channels.includes("mailing") && (
          <div className="field" style={{ marginTop: 8 }}><label className="pw-label">Сегмент рассылки</label>
            <select className="select" style={{ maxWidth: 320 }} value={c.mailSegment} onChange={(e) => patch({ mailSegment: e.target.value })}>
              {["Все клиенты", "Оставившие заявку", "С телефоном", "Активные за 7 дней"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div className="pw-inline-link"><Link href="/dashboard/mailings">Открыть рассылки →</Link> · <Link href="/dashboard/assistant">Настроить AI-ответы →</Link></div>
      </details>
    </>
  );
}

function Step5({ c, toggleArr }: any) {
  return (
    <>
      <label className="pw-label">Механики роста <span className="pw-opt">необязательно</span></label>
      <Chips items={GROWTH.map((g) => ({ id: g, label: g }))} sel={c.growth} onPick={(id) => toggleArr("growth", id)} multi />
      <label className="pw-label" style={{ marginTop: 14 }}>Автоматизация</label>
      <Chips items={AUTOMATION.map((a) => ({ id: a, label: a }))} sel={c.automation} onPick={(id) => toggleArr("automation", id)} multi />
      <div className="pw-inline-link"><Link href="/dashboard/integrations">Открыть интеграции →</Link></div>
    </>
  );
}

const PERIODS: { id: Period; label: string; full: string }[] = [
  { id: "hour", label: "В час", full: "в час" },
  { id: "day", label: "В день", full: "в день" },
  { id: "month", label: "В месяц", full: "в месяц" },
];

function LimitRow({ used, limit, rec, period, onChange }: { used: number; limit: number; rec: number; period: { id: Period; label: string; full: string }; onChange: (v: string) => void }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const remaining = Math.max(0, limit - used);
  const over = used > limit;
  const near = !over && pct >= 80;
  const risky = limit > rec; // выше рекомендованного — потенциально опасно
  return (
    <div className="lm-row">
      <div className="lm-row__top">
        <span className="lm-row__label">{period.label}</span>
        <input
          className={`input lm-input${risky ? " risky" : ""}`}
          value={String(limit)}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
          aria-label={`Лимит ${period.full}`}
        />
      </div>
      <div className={`lm-bar${over ? " over" : near ? " near" : ""}`}><span style={{ width: `${pct}%` }} /></div>
      <div className="lm-row__meta">
        <span>Использовано {used} из {limit}</span>
        <b>Осталось {remaining}</b>
      </div>
      {over && <div className="lm-warn">⚠ Превышен лимит — публикации сверх нормы будут отложены.</div>}
      {near && <div className="lm-warn soft">Почти достигнут лимит {period.full}.</div>}
      {risky && !over && <div className="lm-warn soft">Выше рекомендованного ({rec}) — возможен риск блокировки.</div>}
    </div>
  );
}

function Step6({ c, usage, setLimit, setRecommended, emergencyStop, patch, missing, canLaunch, onLaunch }: any) {
  return (
    <>
      <div className="lm-head">
        <div className="lm-head__t">Безопасные лимиты защищают аккаунт от блокировки. Мы уже подставили рекомендуемые значения.</div>
        <button className="btn btn-sm" onClick={setRecommended} type="button">✓ Установить рекомендуемые лимиты</button>
      </div>

      <div className="lm-grid">
        {LIMIT_GROUPS.map((g) => (
          <div key={g.id} className="lm-card">
            <div className="lm-card__head">
              <span className="lm-card__ico">{g.icon}</span>
              <div>
                <b>{g.label}</b>
                <div className="lm-card__desc">{g.desc}</div>
              </div>
            </div>
            {PERIODS.map((p) => (
              <LimitRow
                key={p.id}
                period={p}
                used={usage[g.id][p.id]}
                limit={c.limits[g.id][p.id]}
                rec={g.rec[p.id]}
                onChange={(v: string) => setLimit(g.id, p.id, v)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="field" style={{ marginTop: 16 }}><label className="pw-label">Когда запустить</label>
        <select className="select" style={{ maxWidth: 260 }} value={c.scheduleStart} onChange={(e) => patch({ scheduleStart: e.target.value })}>
          {["Сразу", "Сегодня вечером", "Завтра утром", "Выбрать дату"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <label className="pw-check" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={c.consent} onChange={(e) => patch({ consent: e.target.checked })} />
        <span>Подтверждаю: продвижение идёт по правилам площадок и с согласия пользователей.</span>
      </label>

      <div className="lm-stop">
        <div>
          <b>Экстренная остановка</b>
          <div className="muted">Мгновенно ставит на паузу все публикации и автоматические действия.</div>
        </div>
        <button className="btn btn-danger" onClick={emergencyStop} type="button">⛔ Остановить всё</button>
      </div>

      <div className="pw-final">
        {canLaunch ? (
          <button className="btn btn-primary btn-lg" onClick={onLaunch} type="button">🚀 Запустить продвижение</button>
        ) : (
          <div className="pw-final__warn">⚠ Перед запуском: {missing.join(", ")}.</div>
        )}
      </div>
    </>
  );
}
