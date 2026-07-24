"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark } from "@/components/icons";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";

type Campaign = {
  projectType: "bot" | "channel" | "product" | "service";
  projectRef: string; // id бота или название канала/товара/услуги
  goal: string;
  audience: string;
  content: string[];
  scheduleFreq: string;
  scheduleTime: string;
  mailSegment: string;
  mechanics: string[];
  limitHour: string;
  limitDay: string;
  consent: boolean;
};

const DEFAULT: Campaign = {
  projectType: "bot",
  projectRef: "",
  goal: "",
  audience: "",
  content: [],
  scheduleFreq: "Каждый день",
  scheduleTime: "12:00",
  mailSegment: "Все клиенты",
  mechanics: [],
  limitHour: "20",
  limitDay: "200",
  consent: false,
};

const KEY = "sb_promotion";

const PROJECT_TYPES = [
  { id: "bot", label: "Бот", emoji: "🤖" },
  { id: "channel", label: "Канал / группа", emoji: "📢" },
  { id: "product", label: "Товар", emoji: "🛒" },
  { id: "service", label: "Услуга", emoji: "🛠" },
] as const;

const GOALS = [
  { id: "subs", label: "Подписчики", emoji: "👥" },
  { id: "leads", label: "Заявки", emoji: "📥" },
  { id: "sales", label: "Продажи", emoji: "💰" },
  { id: "activity", label: "Активность", emoji: "🔥" },
];

const CONTENT_TYPES = ["Тексты постов", "Изображения", "Сценарии", "Контент-план"];
const MECHANICS = ["Реферальные ссылки", "Промокоды", "Квизы", "Конкурсы", "Лид-магниты"];

export default function PromotionClient() {
  const [c, setC] = useState<Campaign>(DEFAULT);
  const [bots, setBots] = useState<Bot[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({ project: true, goal: true });
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const b = loadBots();
      setBots(b);
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
  function toggleArr(field: "content" | "mechanics", v: string) {
    const cur = c[field];
    patch({ [field]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as any);
  }
  function toggleBlock(id: string) {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  }

  const projectName =
    c.projectType === "bot" ? (bots.find((b) => b.id === c.projectRef)?.name || "—") : (c.projectRef || "—");
  const goalName = GOALS.find((g) => g.id === c.goal)?.label || "—";
  const ready = !!c.projectRef && !!c.goal && c.consent;

  function launch() {
    if (!ready) return;
    if (c.projectType === "bot" && c.projectRef) setCurrentBotId(c.projectRef);
    setLaunched(true);
  }

  function Block({ id, n, emoji, title, desc, children }: { id: string; n: number; emoji: string; title: string; desc: string; children: ReactNode }) {
    const isOpen = !!open[id];
    return (
      <div className={`promo-block${isOpen ? " open" : ""}`}>
        <button className="promo-block__head" onClick={() => toggleBlock(id)} type="button">
          <span className="promo-block__n">{n}</span>
          <span className="promo-block__emoji">{emoji}</span>
          <span className="promo-block__titles">
            <span className="promo-block__title">{title}</span>
            <span className="promo-block__desc">{desc}</span>
          </span>
          <span className="promo-block__chev">{isOpen ? "▲" : "▼"}</span>
        </button>
        {isOpen && <div className="promo-block__body">{children}</div>}
      </div>
    );
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Продвижение"]} />
      <div className="content" style={{ maxWidth: 900 }}>
        {/* Шапка рабочего пространства */}
        <div className="promo-hero">
          <div>
            <h1 className="h1" style={{ marginBottom: 4 }}>Продвижение</h1>
            <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
              Всё в одном окне: выберите цель → настройте аудиторию → создайте материалы →
              запустите продвижение → смотрите результат. Разделы ниже раскрываются по шагам.
            </p>
          </div>
          <div className="promo-hero__summary">
            <div><span>Проект</span><b>{projectName}</b></div>
            <div><span>Цель</span><b>{goalName}</b></div>
            <button className="btn btn-primary btn-lg" onClick={launch} disabled={!ready} title={!ready ? "Выберите проект, цель и подтвердите правила" : undefined}>
              🚀 Запустить продвижение
            </button>
          </div>
        </div>

        {launched && (
          <div className="promo-launched">
            ✅ Продвижение запущено для «{projectName}» · цель: {goalName}. Отслеживайте результат в блоке «Аналитика».
          </div>
        )}

        {/* 1. Выбор проекта */}
        <Block id="project" n={1} emoji="🎯" title="Выбор проекта" desc="Что продвигаем: бот, канал, товар или услугу">
          <div className="promo-chips">
            {PROJECT_TYPES.map((t) => (
              <button key={t.id} className={`promo-chip${c.projectType === t.id ? " on" : ""}`} onClick={() => patch({ projectType: t.id, projectRef: t.id === "bot" ? (bots[0]?.id || "") : "" })} type="button">
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            {c.projectType === "bot" ? (
              <select className="select" style={{ maxWidth: 340 }} value={c.projectRef} onChange={(e) => patch({ projectRef: e.target.value })}>
                <option value="">Выберите бота…</option>
                {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : (
              <input className="input" style={{ maxWidth: 340 }} value={c.projectRef} onChange={(e) => patch({ projectRef: e.target.value })} placeholder={c.projectType === "channel" ? "@канал или ссылка" : "Название товара/услуги"} />
            )}
          </div>
        </Block>

        {/* 2. Цель продвижения */}
        <Block id="goal" n={2} emoji="🏁" title="Цель продвижения" desc="Подписчики, заявки, продажи или активность">
          <div className="promo-chips">
            {GOALS.map((g) => (
              <button key={g.id} className={`promo-chip${c.goal === g.id ? " on" : ""}`} onClick={() => patch({ goal: g.id })} type="button">
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
        </Block>

        {/* 3. Поиск аудитории */}
        <Block id="audience" n={3} emoji="🔎" title="Поиск аудитории" desc="AI-поиск каналов, анализ и сегментация">
          <label className="label">Ключевые слова ниши</label>
          <input className="input" value={c.audience} onChange={(e) => patch({ audience: e.target.value })} placeholder="крипто, трейдинг, инвестиции…" />
          <div className="hint" style={{ marginTop: 8 }}>Найдём целевые чаты и соберём аудиторию в разделе парсера.</div>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <Link href="/dashboard/user-parser" className="btn btn-ai"><IconSpark className="ico" /> Открыть парсер аудитории</Link>
          </div>
        </Block>

        {/* 4. Создание контента */}
        <Block id="content" n={4} emoji="✍️" title="Создание контента" desc="Тексты, изображения, сценарии и контент-план">
          <div className="promo-chips">
            {CONTENT_TYPES.map((t) => (
              <button key={t} className={`promo-chip${c.content.includes(t) ? " on" : ""}`} onClick={() => toggleArr("content", t)} type="button">
                {c.content.includes(t) ? "✓ " : "+ "}{t}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <Link href="/dashboard/scenarios?ai=1" className="btn btn-ai"><IconSpark className="ico" /> Сгенерировать с ИИ</Link>
          </div>
        </Block>

        {/* 5. Автопостинг */}
        <Block id="autopost" n={5} emoji="🗓" title="Автопостинг" desc="Календарь и публикации по расписанию">
          <div className="promo-grid2">
            <div className="field">
              <label className="label">Частота</label>
              <select className="select" value={c.scheduleFreq} onChange={(e) => patch({ scheduleFreq: e.target.value })}>
                {["Каждый день", "Через день", "2 раза в день", "По будням", "Раз в неделю"].map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Время публикации</label>
              <input className="input" type="time" value={c.scheduleTime} onChange={(e) => patch({ scheduleTime: e.target.value })} />
            </div>
          </div>
          <div className="hint">Посты уйдут в канал по расписанию. Календарь публикаций — на сервере.</div>
        </Block>

        {/* 6. Рассылки */}
        <Block id="mail" n={6} emoji="📨" title="Рассылки" desc="Сегменты, персонализация и A/B-тесты">
          <div className="field">
            <label className="label">Сегмент аудитории</label>
            <select className="select" style={{ maxWidth: 340 }} value={c.mailSegment} onChange={(e) => patch({ mailSegment: e.target.value })}>
              {["Все клиенты", "Оставившие заявку", "С телефоном", "Активные за 7 дней", "Новые подписчики"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="hint">Рассылайте только по своей базе и с согласия — так безопасно.</div>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <Link href="/dashboard/mailings" className="btn btn-primary">Открыть рассылки</Link>
          </div>
        </Block>

        {/* 7. AI-общение */}
        <Block id="ai" n={7} emoji="💬" title="AI-общение" desc="Ответы, обработка заявок и передача менеджеру">
          <p className="muted" style={{ marginTop: 0 }}>Бот отвечает клиентам нейросетью, собирает заявки и передаёт горячие менеджеру.</p>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/dashboard/assistant" className="btn btn-ai"><IconSpark className="ico" /> Настроить ИИ-ассистента</Link>
            <Link href="/dashboard/team" className="btn">Подключить менеджера</Link>
          </div>
        </Block>

        {/* 8. Автоворонки */}
        <Block id="funnel" n={8} emoji="🔗" title="Автоворонки" desc="Цепочки сообщений, условия, таймеры и напоминания">
          <p className="muted" style={{ marginTop: 0 }}>Соберите цепочку: приветствие → прогрев → предложение → напоминание.</p>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/dashboard/scenarios" className="btn btn-primary">Открыть конструктор сценариев</Link>
          </div>
        </Block>

        {/* 9. Механики роста */}
        <Block id="growth" n={9} emoji="📈" title="Механики роста" desc="Рефералки, промокоды, квизы, конкурсы и лид-магниты">
          <div className="promo-chips">
            {MECHANICS.map((m) => (
              <button key={m} className={`promo-chip${c.mechanics.includes(m) ? " on" : ""}`} onClick={() => toggleArr("mechanics", m)} type="button">
                {c.mechanics.includes(m) ? "✓ " : "+ "}{m}
              </button>
            ))}
          </div>
          <div className="hint" style={{ marginTop: 10 }}>Реферальную программу и лид-магнит можно собрать из готовых шаблонов сценариев.</div>
        </Block>

        {/* 10. Автоматизация */}
        <Block id="automation" n={10} emoji="⚙️" title="Автоматизация" desc="Триггеры, сценарии, CRM, API и webhooks">
          <p className="muted" style={{ marginTop: 0 }}>Передавайте заявки в CRM, дёргайте webhooks и запускайте сценарии по событиям.</p>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/dashboard/integrations" className="btn btn-primary">Открыть интеграции</Link>
          </div>
        </Block>

        {/* 11. Аналитика */}
        <Block id="analytics" n={11} emoji="📊" title="Аналитика" desc="Подписчики, заявки, продажи, конверсия и советы ИИ">
          <p className="muted" style={{ marginTop: 0 }}>Смотрите воронку и конверсию по выбранному боту, получайте рекомендации.</p>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/dashboard/stats" className="btn btn-primary">Открыть аналитику</Link>
          </div>
        </Block>

        {/* 12. Безопасность */}
        <Block id="safety" n={12} emoji="🛡" title="Безопасность" desc="Лимиты, согласия, проверка перед запуском и стоп">
          <div className="promo-grid2">
            <div className="field">
              <label className="label">Лимит действий в час</label>
              <input className="input" value={c.limitHour} onChange={(e) => patch({ limitHour: e.target.value.replace(/\D/g, "") })} inputMode="numeric" />
            </div>
            <div className="field">
              <label className="label">Лимит действий в день</label>
              <input className="input" value={c.limitDay} onChange={(e) => patch({ limitDay: e.target.value.replace(/\D/g, "") })} inputMode="numeric" />
            </div>
          </div>
          <label className="promo-consent">
            <input type="checkbox" checked={c.consent} onChange={(e) => patch({ consent: e.target.checked })} />
            <span>Подтверждаю: рассылки и продвижение идут по правилам площадок и с согласия пользователей.</span>
          </label>
          <div className="promo-check">
            <div className={c.projectRef ? "ok" : ""}>{c.projectRef ? "✓" : "—"} Проект выбран</div>
            <div className={c.goal ? "ok" : ""}>{c.goal ? "✓" : "—"} Цель задана</div>
            <div className={c.consent ? "ok" : ""}>{c.consent ? "✓" : "—"} Правила приняты</div>
          </div>
          <button className="btn btn-danger" onClick={() => { setLaunched(false); }} type="button" style={{ marginTop: 8 }}>
            ⛔ Экстренная остановка
          </button>
        </Block>
      </div>
    </>
  );
}
