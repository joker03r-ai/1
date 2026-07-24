"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark } from "@/components/icons";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";
import { loadUsers } from "@/lib/users";
import { loadLabels } from "@/lib/stats";
import Scheduler from "./Scheduler";
import { ScheduledPost, loadPosts } from "@/lib/schedule";
import { cityById, wallToInstant, formatInTz, mskLabel } from "@/lib/tz";

type Ch = "autopost" | "mailing" | "ai_reply" | "funnel";

type Campaign = {
  projectType: "bot" | "channel" | "product" | "service";
  projectRef: string;
  goal: string;
  audienceMode: "" | "ai" | "import" | "own";
  audienceKeywords: string;
  excludeBots: boolean;
  dedup: boolean;
  contentTypes: string[];
  channels: Ch[];
  mailSegment: string;
  autopostFreq: string;
  autopostTime: string;
  growth: string[];
  automation: string[];
  limitHour: string;
  limitDay: string;
  scheduleStart: string;
  consent: boolean;
  saved: number[];
};

const DEFAULT: Campaign = {
  projectType: "bot", projectRef: "", goal: "",
  audienceMode: "", audienceKeywords: "", excludeBots: true, dedup: true,
  contentTypes: [], channels: [], mailSegment: "Все клиенты",
  autopostFreq: "Каждый день", autopostTime: "12:00",
  growth: [], automation: [],
  limitHour: "20", limitDay: "200", scheduleStart: "Сразу", consent: false,
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
              {active === 1 && <Step2 c={c} patch={patch} />}
              {active === 2 && <Step3 c={c} patch={patch} toggleArr={toggleArr} />}
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
              {active === 5 && <Step6 c={c} patch={patch} advanced={advanced} setAdvanced={setAdvanced} missing={missing} canLaunch={canLaunch} onLaunch={launch} />}
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

function Step2({ c, patch }: any) {
  const modes = [
    { id: "ai", label: "AI-поиск аудитории", emoji: "✨" },
    { id: "import", label: "Импорт своей базы", emoji: "📥" },
    { id: "own", label: "Подписчики бота", emoji: "👥" },
  ];
  return (
    <>
      <label className="pw-label">Откуда брать аудиторию</label>
      <Chips items={modes} sel={c.audienceMode} onPick={(id) => patch({ audienceMode: id })} />
      {c.audienceMode === "ai" && (
        <div style={{ marginTop: 12 }}>
          <label className="pw-label">Ключевые слова ниши</label>
          <input className="input" value={c.audienceKeywords} onChange={(e) => patch({ audienceKeywords: e.target.value })} placeholder="крипто, трейдинг, инвестиции…" />
          <div className="pw-inline-link"><Link href="/dashboard/user-parser">Открыть парсер аудитории →</Link></div>
        </div>
      )}
      <details className="pw-adv">
        <summary>Расширенные настройки</summary>
        <label className="pw-check"><input type="checkbox" checked={c.excludeBots} onChange={(e) => patch({ excludeBots: e.target.checked })} /> Исключить ботов и удалённые аккаунты</label>
        <label className="pw-check"><input type="checkbox" checked={c.dedup} onChange={(e) => patch({ dedup: e.target.checked })} /> Убирать дубликаты</label>
      </details>
    </>
  );
}

function Step3({ c, toggleArr }: any) {
  return (
    <>
      <label className="pw-label">Что подготовить</label>
      <Chips items={CONTENT_TYPES.map((t) => ({ id: t, label: t }))} sel={c.contentTypes} onPick={(id) => toggleArr("contentTypes", id)} multi />
      <div className="pw-row" style={{ marginTop: 14 }}>
        <Link href="/dashboard/scenarios?ai=1" className="btn btn-ai"><IconSpark className="ico" /> Сгенерировать с ИИ</Link>
      </div>
      <div className="pw-tip">Совет для новичка: начните с 3–5 текстов и 1 изображения. Остальное добавите позже.</div>
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

function Step6({ c, patch, missing, canLaunch, onLaunch }: any) {
  return (
    <>
      <div className="pw-grid2">
        <div className="field"><label className="pw-label">Лимит действий в час</label>
          <input className="input" value={c.limitHour} onChange={(e) => patch({ limitHour: e.target.value.replace(/\D/g, "") })} inputMode="numeric" /></div>
        <div className="field"><label className="pw-label">Лимит в день</label>
          <input className="input" value={c.limitDay} onChange={(e) => patch({ limitDay: e.target.value.replace(/\D/g, "") })} inputMode="numeric" /></div>
      </div>
      <div className="field" style={{ marginTop: 8 }}><label className="pw-label">Когда запустить</label>
        <select className="select" style={{ maxWidth: 260 }} value={c.scheduleStart} onChange={(e) => patch({ scheduleStart: e.target.value })}>
          {["Сразу", "Сегодня вечером", "Завтра утром", "Выбрать дату"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <label className="pw-check" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={c.consent} onChange={(e) => patch({ consent: e.target.checked })} />
        <span>Подтверждаю: продвижение идёт по правилам площадок и с согласия пользователей.</span>
      </label>
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
