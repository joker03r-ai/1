"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark } from "@/components/icons";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";
import { loadUsers } from "@/lib/users";
import { loadLabels } from "@/lib/stats";

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
  { title: "Проект и цель", short: "Что и зачем продвигаем", hint: "Выберите проект и одну цель — от неё зависят рекомендации." },
  { title: "Аудитория", short: "Кому показываем", hint: "Выберите, где брать аудиторию: AI-поиск, импорт или своя база." },
  { title: "Контент", short: "Что публикуем", hint: "Отметьте, что подготовить. Можно сгенерировать с ИИ." },
  { title: "Каналы продвижения", short: "Как продвигаем", hint: "Выберите способы: автопостинг, рассылки, AI-ответы, воронки." },
  { title: "Рост и автоматизация", short: "Усиление (необязательно)", hint: "Подключите механики роста и автоматизацию — по желанию." },
  { title: "Проверка и запуск", short: "Лимиты и согласие", hint: "Задайте лимиты, подтвердите правила и запустите." },
];

export default function PromotionClient() {
  const [c, setC] = useState<Campaign>(DEFAULT);
  const [bots, setBots] = useState<Bot[]>([]);
  const [active, setActive] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [leads, setLeads] = useState(0);
  const [clients, setClients] = useState(0);

  useEffect(() => {
    try {
      const b = loadBots();
      setBots(b);
      setClients(loadUsers().length);
      setLeads(loadLabels().find((l) => l.id === "sl_lead")?.count || 0);
      const raw = localStorage.getItem(KEY);
      if (raw) setC({ ...DEFAULT, ...JSON.parse(raw) });
      else setC((p) => ({ ...p, projectRef: getCurrentBotId() || b[0]?.id || "" }));
    } catch {}
  }, []);

  function patch(p: Partial<Campaign>) {
    setC((prev) => {
      const next = { ...prev, ...p };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    setLaunched(false);
  }
  function toggleArr(field: "contentTypes" | "channels" | "growth" | "automation", v: string) {
    const cur = c[field] as string[];
    patch({ [field]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as any);
  }

  // Завершённость шагов.
  const isDone = (i: number): boolean => {
    switch (i) {
      case 0: return !!c.projectRef && !!c.goal;
      case 1: return c.saved.includes(1) || c.audienceMode !== "";
      case 2: return c.saved.includes(2) || c.contentTypes.length > 0;
      case 3: return c.channels.length > 0;
      case 4: return c.saved.includes(4) || c.growth.length > 0 || c.automation.length > 0;
      case 5: return c.consent;
      default: return false;
    }
  };
  const doneCount = STEPS.filter((_, i) => isDone(i)).length;
  const progress = Math.round((doneCount / STEPS.length) * 100);

  // Обязательные шаги для запуска: проект+цель, каналы, согласие.
  const missing: string[] = [];
  if (!isDone(0)) missing.push("выбрать проект и цель");
  if (!isDone(3)) missing.push("выбрать способ продвижения");
  if (!c.consent) missing.push("подтвердить правила в шаге 6");
  const canLaunch = missing.length === 0;

  function saveStep(i: number) {
    const saved = c.saved.includes(i) ? c.saved : [...c.saved, i];
    patch({ saved });
    setAdvanced(false);
    if (i < STEPS.length - 1) setActive(i + 1);
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

  return (
    <>
      <Topbar crumbs={["Основной проект", "Продвижение"]} />
      <div className="content" style={{ maxWidth: 1180 }}>
        {/* Верхняя панель */}
        <div className="pw-top">
          <div className="pw-top__l">
            <h1 className="h1" style={{ marginBottom: 4 }}>Продвижение</h1>
            <p className="muted" style={{ margin: 0 }}>Настройте кампанию за 6 шагов — от цели до запуска, всё в одном окне.</p>
          </div>
          <div className="pw-top__r">
            <button className="btn btn-ai pw-autobtn" onClick={autoSetup} type="button">
              <IconSpark className="ico" /> Настроить автоматически с ИИ
            </button>
            <div className="pw-launch">
              <button className="btn btn-primary btn-lg" onClick={launch} disabled={!canLaunch}>🚀 Запустить продвижение</button>
              {!canLaunch && <div className="pw-launch__hint">Осталось: {missing.join(", ")}.</div>}
            </div>
          </div>
        </div>
        <div className="pw-progress">
          <div className="pw-progress__row">
            <span>Заполнено {doneCount} из {STEPS.length} шагов</span>
            <b>{progress}%</b>
          </div>
          <div className="pw-progress__bar"><span style={{ width: `${progress}%` }} /></div>
        </div>

        {/* Результаты после запуска */}
        {launched && (
          <div className="pw-results">
            <div className="pw-results__head">
              <b>✅ Продвижение запущено — «{projectName}», цель: {goalName}</b>
              <button className="btn btn-danger" onClick={() => setLaunched(false)} type="button">⛔ Экстренная остановка</button>
            </div>
            <div className="pw-metrics">
              {[
                { l: "Подписчики", v: "0", cls: "" },
                { l: "Заявки", v: String(leads), cls: "" },
                { l: "Продажи", v: "0 ₽", cls: "" },
                { l: "Конверсия", v: "—", cls: "" },
                { l: "Расходы", v: "0 ₽", cls: "" },
                { l: "Рассылки", v: "—", cls: "" },
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

        {/* Рабочая область: шаги + сводка */}
        <div className="pw-grid">
          <div className="pw-steps">
            {STEPS.map((s, i) => {
              const done = isDone(i);
              const isActive = active === i;
              return (
                <div key={i} className={`pw-step${isActive ? " active" : ""}${done ? " done" : ""}`}>
                  <button className="pw-step__head" onClick={() => setActive(isActive ? -1 : i)} type="button">
                    <span className="pw-step__dot">{done ? "✓" : i + 1}</span>
                    <span className="pw-step__titles">
                      <span className="pw-step__title">{s.title}</span>
                      <span className="pw-step__short">{s.short}</span>
                    </span>
                    <span className="pw-step__chev">{isActive ? "▲" : "▼"}</span>
                  </button>
                  {isActive && (
                    <div className="pw-step__body">
                      <div className="pw-hint">👉 Что нужно сделать: {s.hint}</div>

                      {i === 0 && <Step1 c={c} bots={bots} patch={patch} />}
                      {i === 1 && <Step2 c={c} patch={patch} advanced={advanced} setAdvanced={setAdvanced} toggle={() => {}} />}
                      {i === 2 && <Step3 c={c} patch={patch} toggleArr={toggleArr} />}
                      {i === 3 && <Step4 c={c} patch={patch} toggleArr={toggleArr} advanced={advanced} setAdvanced={setAdvanced} />}
                      {i === 4 && <Step5 c={c} toggleArr={toggleArr} />}
                      {i === 5 && <Step6 c={c} patch={patch} advanced={advanced} setAdvanced={setAdvanced} missing={missing} canLaunch={canLaunch} onLaunch={launch} />}

                      {i < 5 && (
                        <div className="pw-step__foot">
                          <button className="btn btn-primary" onClick={() => saveStep(i)} type="button">Сохранить и продолжить →</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Сводка */}
          <aside className="pw-summary">
            <div className="pw-summary__card">
              <div className="pw-summary__t">Сводка кампании</div>
              <SumRow label="Проект" value={projectName} ok={isDone(0)} />
              <SumRow label="Цель" value={goalName} ok={!!c.goal} />
              <SumRow label="Аудитория" value={audienceName} ok={isDone(1)} />
              <SumRow label="Контент" value={c.contentTypes.length ? `${c.contentTypes.length} тип(а)` : "—"} ok={isDone(2)} />
              <SumRow label="Продвижение" value={channelNames} ok={isDone(3)} />
              <SumRow label="Расписание" value={c.scheduleStart} ok />
              <div className="pw-summary__ready">
                <span>Готовность</span>
                <b className={canLaunch ? "ok" : "warn"}>{canLaunch ? "Готово к запуску" : `${doneCount}/6 шагов`}</b>
              </div>
              {missing.length > 0 && (
                <div className="pw-summary__errs">
                  <div className="pw-summary__errs-t">⚠ Нужно настроить:</div>
                  <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              )}
              <button className="btn btn-primary pw-summary__launch" onClick={launch} disabled={!canLaunch}>🚀 Запустить</button>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function SumRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="pw-sumrow">
      <span className="pw-sumrow__l">{label}</span>
      <span className={`pw-sumrow__v${ok ? " ok" : ""}`}>{value}</span>
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
