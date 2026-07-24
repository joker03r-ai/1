"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark } from "@/components/icons";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";
import { loadLabels } from "@/lib/stats";
import { loadUsers } from "@/lib/users";
import { Draft, loadDrafts } from "@/lib/content";
import { ScheduledPost, PostStatus, loadPosts, savePosts } from "@/lib/schedule";

type Ch = "autopost" | "mailing" | "ai_reply" | "funnel";
type Period = "hour" | "day" | "month";
type LimitKey = "channels" | "posts" | "mailings" | "auto";
type LimitSet = Record<LimitKey, Record<Period, number>>;

type Campaign = {
  projectType: "bot" | "channel" | "product" | "service";
  projectRef: string;
  goal: string;
  audienceMode: "" | "ai" | "import" | "own";
  audienceKeywords: string;
  channels: Ch[];
  mailSegment: string;
  autopostFreq: string;
  autopostTime: string;
  selectedContent: string[];
  growth: string[];
  automation: string[];
  limits: LimitSet;
  scheduleStart: string;
  consent: boolean;
  saved: number[];
};

const LIMIT_GROUPS: { id: LimitKey; label: string; icon: string; desc: string; rec: Record<Period, number> }[] = [
  { id: "channels", label: "Каналы и подписки", icon: "📢", desc: "Сколько каналов и подписок можно добавить за период.", rec: { hour: 5, day: 20, month: 200 } },
  { id: "posts", label: "Посты и публикации", icon: "📝", desc: "Сколько постов публикуется. Частые публикации снижают охваты.", rec: { hour: 3, day: 10, month: 150 } },
  { id: "mailings", label: "Рассылки и сообщения", icon: "✉️", desc: "Сколько личных сообщений отправляется. Превышение — риск спам-блока.", rec: { hour: 20, day: 100, month: 1500 } },
  { id: "auto", label: "Автоматические действия", icon: "⚙️", desc: "Автоответы, вступления, реакции. Держите умеренными.", rec: { hour: 30, day: 150, month: 2000 } },
];
const RECOMMENDED: LimitSet = LIMIT_GROUPS.reduce((a, g) => ({ ...a, [g.id]: { ...g.rec } }), {} as LimitSet);

const DEFAULT: Campaign = {
  projectType: "bot", projectRef: "", goal: "",
  audienceMode: "", audienceKeywords: "",
  channels: [], mailSegment: "Все клиенты",
  autopostFreq: "Каждый день", autopostTime: "12:00",
  selectedContent: [], growth: [], automation: [],
  limits: RECOMMENDED, scheduleStart: "Сразу", consent: false, saved: [],
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

const CHANNELS: { id: Ch; label: string; desc: string }[] = [
  { id: "autopost", label: "Автопостинг", desc: "Публикации по расписанию" },
  { id: "mailing", label: "Рассылки", desc: "Сообщения по своей базе" },
  { id: "ai_reply", label: "AI-ответы", desc: "Бот отвечает и собирает заявки" },
  { id: "funnel", label: "Автоворонки", desc: "Цепочки прогрева" },
];
const GROWTH = ["Реферальные ссылки", "Промокоды", "Конкурсы", "Лид-магниты"];
const AUTOMATION = ["CRM", "API", "Webhooks", "Триггеры"];

const STEPS = [
  { simple: "Что продвигаем?", pro: "Проект и цель", card: "Выберите бота, Telegram-канал, товар или услугу и одну цель. От этого зависят рекомендации.", ai: "Начните с одного бота и цели «Подписчики» — так проще оценить результат.", optional: false },
  { simple: "Кому показываем?", pro: "Аудитория", card: "Укажите, где брать аудиторию. Сбор чатов и материалов делается в отдельном разделе «Парсинг».", ai: "Для старта включите AI-поиск и задайте 2–3 ключевых слова ниши.", optional: true },
  { simple: "Где продвигаем?", pro: "Каналы продвижения", card: "Выберите способы продвижения: автопостинг, рассылки, AI-ответы, автоворонки.", ai: "Новичку хватит автопостинга и AI-ответов.", optional: false },
  { simple: "Готовый контент", pro: "Выбор контента", card: "Отметьте посты, которые будете продвигать. Создать и распланировать их можно в разделе «Контент».", ai: "Достаточно 3–5 постов. Нет готового? Создайте его в разделе «Контент».", optional: false },
  { simple: "Настройки", pro: "Настройки продвижения", card: "Механики роста, автоматизация и безопасные лимиты, чтобы аккаунт не заблокировали.", ai: "Оставьте рекомендуемые лимиты — они безопасны для нового аккаунта.", optional: true },
  { simple: "Проверка и запуск", pro: "Запуск", card: "Подтвердите правила площадок и запустите продвижение.", ai: "Перед запуском ещё раз проверьте выбранный контент и каналы.", optional: false },
];

export default function PromotionClient() {
  const [c, setC] = useState<Campaign>(DEFAULT);
  const [bots, setBots] = useState<Bot[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [active, setActive] = useState(0);
  const [launched, setLaunched] = useState(false);
  const [leads, setLeads] = useState(0);
  const [lockMsg, setLockMsg] = useState("");
  const [stepErr, setStepErr] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  useEffect(() => {
    try {
      const b = loadBots();
      setBots(b);
      setDrafts(loadDrafts());
      setPosts(loadPosts());
      setLeads(loadLabels().find((l) => l.id === "sl_lead")?.count || 0);
      loadUsers();
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
  function toggleArr(field: "channels" | "growth" | "automation" | "selectedContent", v: string) {
    const cur = c[field] as string[];
    patch({ [field]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as any);
  }

  const isDone = (i: number): boolean => {
    switch (i) {
      case 0: return !!c.projectRef && !!c.goal;
      case 1: return c.saved.includes(1) || c.audienceMode !== "";
      case 2: return c.channels.length > 0;
      case 3: return c.selectedContent.length > 0;
      case 4: return c.saved.includes(4);
      case 5: return c.consent;
      default: return false;
    }
  };
  const doneCount = STEPS.filter((_, i) => isDone(i)).length;
  const progress = Math.round((doneCount / STEPS.length) * 100);

  const missing: string[] = [];
  if (!c.projectRef) missing.push("выбрать проект");
  if (!c.goal) missing.push("выбрать цель");
  if (c.channels.length === 0) missing.push("выбрать способ продвижения");
  if (c.selectedContent.length === 0) missing.push("выбрать контент");
  if (!c.consent) missing.push("подтвердить правила");
  const canLaunch = missing.length === 0;

  function stepState(i: number): "done" | "current" | "error" | "empty" {
    if (i === active) return "current";
    if (isDone(i)) return "done";
    if (!STEPS[i].optional && STEPS.some((_, k) => k > i && isDone(k))) return "error";
    return "empty";
  }
  function goStep(i: number) {
    if (i > 0 && !isDone(0)) {
      setLockMsg("Сначала выберите проект и цель.");
      window.clearTimeout((goStep as any)._t);
      (goStep as any)._t = window.setTimeout(() => setLockMsg(""), 2600);
      return;
    }
    setLockMsg(""); setStepErr(""); setStepsOpen(false); setActive(i);
  }
  function stepBlocker(i: number): string {
    if (STEPS[i].optional) return "";
    switch (i) {
      case 0: return !c.projectRef ? "Выберите проект." : !c.goal ? "Выберите цель продвижения." : "";
      case 2: return c.channels.length === 0 ? "Выберите хотя бы один способ продвижения." : "";
      case 3: return c.selectedContent.length === 0 ? "Выберите хотя бы один пост для продвижения." : "";
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
    if (i < STEPS.length - 1) setActive(i + 1);
  }
  function saveDraft() {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {}
    flashSaved();
  }

  function autoSetup() {
    patch({
      audienceMode: c.audienceMode || "ai",
      channels: c.channels.length ? c.channels : ["autopost", "ai_reply"],
      growth: c.growth.length ? c.growth : ["Реферальные ссылки"],
      saved: Array.from(new Set([...c.saved, 1, 4])),
    });
    setActive(5);
  }
  function launch() {
    if (!canLaunch) return;
    if (c.projectType === "bot" && c.projectRef) setCurrentBotId(c.projectRef);
    setLaunched(true);
  }

  function setLimit(key: LimitKey, period: Period, value: string) {
    const n = Math.max(0, Math.min(100000, parseInt(value.replace(/\D/g, "") || "0", 10)));
    patch({ limits: { ...c.limits, [key]: { ...c.limits[key], [period]: n } } });
  }
  function setRecommendedLimits() { patch({ limits: JSON.parse(JSON.stringify(RECOMMENDED)) }); }
  function emergencyStop() {
    const list = loadPosts().map((p) => (p.status === "published" ? p : { ...p, status: "paused" as PostStatus }));
    savePosts(list); setPosts(list); setLaunched(false);
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const usage: Record<LimitKey, Record<Period, number>> = {
    channels: { hour: 0, day: 0, month: c.channels.length },
    posts: { hour: 0, day: posts.filter((p) => p.date === todayISO).length, month: c.selectedContent.length },
    mailings: { hour: 0, day: 0, month: 0 },
    auto: { hour: 0, day: 0, month: c.automation.length },
  };

  const projectName = c.projectType === "bot" ? (bots.find((b) => b.id === c.projectRef)?.name || "—") : (c.projectRef || "—");
  const goalName = GOALS.find((g) => g.id === c.goal)?.label || "—";
  const audienceName = c.audienceMode === "ai" ? "AI-поиск" : c.audienceMode === "import" ? "Импорт базы" : c.audienceMode === "own" ? "Своя база" : "—";
  const channelNames = c.channels.map((id) => CHANNELS.find((x) => x.id === id)?.label).filter(Boolean).join(", ") || "—";

  const todos: { t: string; step: number }[] = [];
  if (!isDone(0)) todos.push({ t: "Выбрать проект и цель", step: 0 });
  if (c.channels.length === 0) todos.push({ t: "Выбрать каналы продвижения", step: 2 });
  if (c.selectedContent.length === 0) todos.push({ t: "Выбрать готовый контент", step: 3 });
  if (!c.consent) todos.push({ t: "Подтвердить правила и запустить", step: 5 });

  const cur = STEPS[active];

  return (
    <>
      <Topbar crumbs={["Основной проект", "Продвижение"]} />
      <div className="content" style={{ maxWidth: 1240 }}>
        <div className="st-head">
          <div>
            <h1 className="h1 st-h1">Продвижение</h1>
            <div className="st-head__sub">Шаг {active + 1} из {STEPS.length} — {cur.pro}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={autoSetup} type="button"><IconSpark className="ico" /> Настроить с ИИ</button>
        </div>

        <div className="pr-flow">Парсинг → Черновики → Создание контента → Календарь → <b>Продвижение</b></div>

        <div className="st-mob">
          <div className="st-mob__top">
            <span className="st-mob__step">Шаг {active + 1} из {STEPS.length}</span>
            <button className="st-mob__toggle" onClick={() => setStepsOpen((v) => !v)} type="button">{stepsOpen ? "Скрыть шаги" : "Все шаги"}</button>
          </div>
          <div className="st-mob__name">{cur.simple}</div>
          <div className="pw-progress__bar"><span style={{ width: `${progress}%` }} /></div>
        </div>

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

        {launched && (
          <div className="pw-results">
            <div className="pw-results__head">
              <b>✅ Продвижение запущено — «{projectName}», цель: {goalName}</b>
              <button className="btn btn-danger" onClick={() => setLaunched(false)} type="button">⛔ Экстренная остановка</button>
            </div>
            <div className="pw-metrics">
              {[{ l: "Подписчики", v: "0" }, { l: "Заявки", v: String(leads) }, { l: "Продажи", v: "0 ₽" }, { l: "Конверсия", v: "—" }, { l: "Посты", v: String(c.selectedContent.length) }, { l: "Каналы", v: String(c.channels.length) }].map((m) => (
                <div key={m.l} className="pw-metric"><div className="pw-metric__v">{m.v}</div><div className="pw-metric__l">{m.l}</div></div>
              ))}
            </div>
            <div className="pw-recs">
              <div className="pw-recs__t">💡 Рекомендации ИИ</div>
              <ul>
                <li>Публикуйте контент 1 раз в день в активное время аудитории.</li>
                <li>Добавьте лид-магнит — он повышает конверсию в заявки.</li>
                <li>Следите за лимитами, чтобы не получить блокировку аккаунта.</li>
              </ul>
            </div>
          </div>
        )}

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
              {active === 1 && <StepAudience c={c} patch={patch} />}
              {active === 2 && <StepChannels c={c} patch={patch} toggleArr={toggleArr} />}
              {active === 3 && <StepContent c={c} drafts={drafts} posts={posts} toggleArr={toggleArr} />}
              {active === 4 && <StepSettings c={c} patch={patch} toggleArr={toggleArr} usage={usage} setLimit={setLimit} setRecommended={setRecommendedLimits} />}
              {active === 5 && <StepLaunch c={c} patch={patch} emergencyStop={emergencyStop} missing={missing} canLaunch={canLaunch} onLaunch={launch} />}
            </div>

            {stepErr && <div className="st-err">⚠ {stepErr}</div>}

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

          <aside className="st-panel">
            <div className="st-panel__card">
              <div className="st-panel__t">Ваше продвижение</div>
              <PanelRow label="Проект" value={c.projectRef ? projectName : "Проект не выбран"} ok={!!c.projectRef} />
              <PanelRow label="Цель" value={c.goal ? goalName : "Цель не указана"} ok={!!c.goal} />
              <PanelRow label="Аудитория" value={c.audienceMode ? audienceName : "Аудитория не задана"} ok={!!c.audienceMode} />
              <PanelRow label="Каналы" value={c.channels.length ? channelNames : "Каналы не выбраны"} ok={c.channels.length > 0} />
              <PanelRow label="Контент" value={c.selectedContent.length ? `${c.selectedContent.length} пост(ов)` : "Контент не выбран"} ok={c.selectedContent.length > 0} />
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

function StepAudience({ c, patch }: any) {
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
        </div>
      )}
      <div className="cw-basis" style={{ marginTop: 14 }}>
        🔍 Сбор чатов, постов и аккаунтов делается в разделе «Парсинг». <Link href="/dashboard/parsing" style={{ color: "var(--violet-700)", fontWeight: 700 }}>Открыть Парсинг →</Link>
      </div>
    </>
  );
}

function StepChannels({ c, toggleArr }: any) {
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
      <div className="pw-inline-link"><Link href="/dashboard/mailings">Открыть рассылки →</Link> · <Link href="/dashboard/assistant">Настроить AI-ответы →</Link></div>
    </>
  );
}

function StepContent({ c, drafts, posts, toggleArr }: any) {
  const items: { id: string; text: string; tag: string }[] = [
    ...drafts.map((d: Draft) => ({ id: "d:" + d.id, text: d.text, tag: `Черновик · ${d.type}` })),
    ...posts.map((p: ScheduledPost) => ({ id: "p:" + p.id, text: p.text || "Без текста", tag: `Календарь · ${p.date}` })),
  ];
  return (
    <>
      <div className="cw-basis">📎 Выберите готовые посты для продвижения. Создать и распланировать контент можно в разделе «Контент».</div>
      {items.length === 0 ? (
        <div className="ct-empty" style={{ marginTop: 12 }}>
          <div>Готового контента пока нет.</div>
          <div className="ct-empty__acts">
            <Link className="btn btn-primary" href="/dashboard/content?tab=create">✍️ Создать контент</Link>
            <Link className="btn" href="/dashboard/parsing">🔍 Собрать в парсинге</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="pc-list">
            {items.map((it) => {
              const on = c.selectedContent.includes(it.id);
              return (
                <label key={it.id} className={`pc-item${on ? " on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleArr("selectedContent", it.id)} />
                  <div className="pc-item__body">
                    <span className="pc-item__tag">{it.tag}</span>
                    <span className="pc-item__text">{it.text.slice(0, 90)}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="pw-inline-link" style={{ marginTop: 12 }}>
            Нужен ещё контент? <Link href="/dashboard/content?tab=create">Создать в разделе «Контент» →</Link>
          </div>
        </>
      )}
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
  const risky = limit > rec;
  return (
    <div className="lm-row">
      <div className="lm-row__top">
        <span className="lm-row__label">{period.label}</span>
        <input className={`input lm-input${risky ? " risky" : ""}`} value={String(limit)} onChange={(e) => onChange(e.target.value)} inputMode="numeric" />
      </div>
      <div className={`lm-bar${over ? " over" : near ? " near" : ""}`}><span style={{ width: `${pct}%` }} /></div>
      <div className="lm-row__meta"><span>Использовано {used} из {limit}</span><b>Осталось {remaining}</b></div>
      {over && <div className="lm-warn">⚠ Превышен лимит — публикации сверх нормы будут отложены.</div>}
      {risky && !over && <div className="lm-warn soft">Выше рекомендованного ({rec}) — возможен риск блокировки.</div>}
    </div>
  );
}

function StepSettings({ c, patch, toggleArr, usage, setLimit, setRecommended }: any) {
  return (
    <>
      <label className="pw-label">Механики роста <span className="pw-opt">необязательно</span></label>
      <Chips items={GROWTH.map((g) => ({ id: g, label: g }))} sel={c.growth} onPick={(id) => toggleArr("growth", id)} multi />
      <label className="pw-label" style={{ marginTop: 14 }}>Автоматизация</label>
      <Chips items={AUTOMATION.map((a) => ({ id: a, label: a }))} sel={c.automation} onPick={(id) => toggleArr("automation", id)} multi />

      <div className="lm-head" style={{ marginTop: 20 }}>
        <div className="lm-head__t">Безопасные лимиты защищают аккаунт от блокировки. Рекомендуемые значения уже подставлены.</div>
        <button className="btn btn-sm" onClick={setRecommended} type="button">✓ Рекомендуемые лимиты</button>
      </div>
      <div className="lm-grid">
        {LIMIT_GROUPS.map((g) => (
          <div key={g.id} className="lm-card">
            <div className="lm-card__head">
              <span className="lm-card__ico">{g.icon}</span>
              <div><b>{g.label}</b><div className="lm-card__desc">{g.desc}</div></div>
            </div>
            {PERIODS.map((p) => (
              <LimitRow key={p.id} period={p} used={usage[g.id][p.id]} limit={c.limits[g.id][p.id]} rec={g.rec[p.id]} onChange={(v: string) => setLimit(g.id, p.id, v)} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function StepLaunch({ c, patch, emergencyStop, missing, canLaunch, onLaunch }: any) {
  return (
    <>
      <div className="field"><label className="pw-label">Когда запустить</label>
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
