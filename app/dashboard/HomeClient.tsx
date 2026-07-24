"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import {
  IconSpark, IconChat, IconUsers, IconSend, IconStore, IconBot, IconPlus,
  IconBook, IconCalendar, IconArrowRight, IconLayers, IconRocket, IconCheck,
  IconChart, IconGlobe,
} from "@/components/icons";
import { ILLUSTS, loadIllust } from "@/lib/appPrefs";

const ILL_ICONS: Record<string, any> = { bot: IconBot, send: IconSend, spark: IconSpark, users: IconUsers, chat: IconChat, chart: IconChart, store: IconStore, layers: IconLayers, globe: IconGlobe, rocket: IconRocket };
import { loadUsers, avatarColor } from "@/lib/users";
import { loadLabels } from "@/lib/stats";
import { TEMPLATES, buildTemplate, upsertScenario, uid, Scenario, loadScenarios, hasStartTrigger } from "@/lib/scenarios";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";
import { loadAssistant, kbFilled } from "@/lib/assistant";
import { loadPosts } from "@/lib/schedule";
import { trialDaysLeft, daysWord } from "@/lib/trial";

function botInitials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "B";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}
function botWord(n: number): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return "бот";
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return "бота";
  return "ботов";
}

const FEATURED = ["sales-ai", "faq", "booking"];
const LESSONS = [
  { t: "Создайте бота", d: "Мастер соберёт структуру за вас." },
  { t: "Настройте ассистента", d: "Имя, стиль и база знаний." },
  { t: "Возьмите шаблон", d: "Готовый сценарий под задачу." },
  { t: "Подключите канал", d: "Telegram — токен у @BotFather." },
  { t: "Запустите", d: "Бот принимает сообщения." },
];

export default function HomeClient() {
  const router = useRouter();
  const [users, setUsers] = useState(0);
  const [dialogs, setDialogs] = useState(0);
  const [leads, setLeads] = useState(0);
  const [bots, setBots] = useState<Bot[]>([]);
  const [curBot, setCurBot] = useState("");
  const [scns, setScns] = useState<Scenario[]>([]);
  const [postsCount, setPostsCount] = useState(0);
  const [trial, setTrial] = useState(7);
  const [period, setPeriod] = useState<"today" | "7" | "30">("7");
  const [learnOpen, setLearnOpen] = useState(false);
  const [homeTab, setHomeTab] = useState<"bots" | "templates">("bots");
  const [illust, setIllust] = useState(0);
  const [kb, setKb] = useState(false);

  useEffect(() => {
    try {
      setUsers(loadUsers().length);
      const labels = loadLabels();
      setLeads(labels.find((l) => l.id === "sl_lead")?.count || 0);
      setDialogs(labels.find((l) => l.id === "sl_dialog")?.count || 0);
      const b = loadBots(); setBots(b);
      const cur = getCurrentBotId() || b[0]?.id || ""; setCurBot(cur);
      setScns(loadScenarios());
      setPostsCount(loadPosts().length);
      setTrial(trialDaysLeft());
      setKb(kbFilled(loadAssistant(cur)));
      setIllust(loadIllust());
    } catch {}
  }, []);

  // Живое обновление иллюстрации при смене в настройках.
  useEffect(() => {
    const h = () => setIllust(loadIllust());
    window.addEventListener("sb-illust", h);
    return () => window.removeEventListener("sb-illust", h);
  }, []);

  function pickBot(id: string) { setCurBot(id); setCurrentBotId(id); setKb(kbFilled(loadAssistant(id))); }

  function botStart(b: Bot): boolean {
    return scns.some((s) => (s.botId === b.id || s.id === b.scenarioId) && s.published && hasStartTrigger(s));
  }
  function botPct(b: Bot): number {
    const steps = [true, kbFilled(loadAssistant(b.id)), botStart(b), !!b.tgConnected];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  }
  function botState(b: Bot): "work" | "warn" | "off" {
    if (b.status === "off") return "off";
    if (!botStart(b) || botPct(b) < 75) return "warn";
    return "work";
  }
  const STATE_LABEL = { work: "Работает", warn: "Требует настройки", off: "Остановлен" };

  const activeBots = bots.filter((b) => b.status === "active").length;
  const sel = bots.find((b) => b.id === curBot) || bots[0];
  const setupPct = sel ? botPct(sel) : 0;

  // Рекомендации «Что сделать сейчас» — зависят от готовности выбранного бота.
  const recs = useMemo(() => {
    const list = [
      { id: "kb", Icon: IconBook, title: "Заполните базу знаний", desc: "ИИ отвечает клиентам по вашим услугам, ценам и графику.", done: kb, pct: kb ? 100 : 0, step: "Открыть ИИ-ассистента", href: "/dashboard/assistant" },
      { id: "test", Icon: IconChat, title: "Проведите тестовый диалог", desc: "Проверьте ответы бота до запуска в Telegram.", done: dialogs > 0, pct: dialogs > 0 ? 100 : 0, step: "Открыть тест ассистента", href: "/dashboard/assistant" },
      { id: "post", Icon: IconCalendar, title: "Запланируйте первый пост", desc: "Составьте контент-план и поставьте публикации в календарь.", done: postsCount > 0, pct: postsCount > 0 ? 100 : 0, step: "Открыть календарь", href: "/dashboard/content?tab=calendar" },
    ];
    return list.sort((a, b) => Number(a.done) - Number(b.done));
  }, [kb, dialogs, postsCount]);
  const nextHref = recs.find((r) => !r.done)?.href || "/dashboard/bots";

  // Показатели с полезными пустыми состояниями.
  const periodLabel = period === "today" ? "сегодня" : period === "7" ? "за 7 дней" : "за 30 дней";
  const metrics = [
    { key: "msg", Icon: IconChat, label: "Сообщения", value: 0, empty: "Сообщений пока нет", action: "Протестировать бота", href: "/dashboard/assistant", cls: "m-msg" },
    { key: "usr", Icon: IconUsers, label: "Пользователи", value: users, empty: "Пользователей пока нет", action: "Собрать аудиторию", href: "/dashboard/parsing", cls: "m-usr" },
    { key: "lead", Icon: IconSend, label: "Заявки", value: leads, empty: "Заявок пока нет", action: "Настроить сбор контактов", href: "/dashboard/scenarios", cls: "m-lead" },
    { key: "sale", Icon: IconStore, label: "Продажи", value: 0, money: true, empty: "Продаж пока нет", action: "Подключить сценарий продаж", href: "/dashboard/scenarios", cls: "m-sale" },
  ];

  // Обучение — реальный прогресс.
  const lessonDone = [bots.length > 0, kb, scns.length > 0, !!sel?.tgConnected, activeBots > 0 && (sel ? botStart(sel) : false)];
  const doneCount = lessonDone.filter(Boolean).length;
  const curStage = LESSONS[Math.min(lessonDone.findIndex((x) => !x) === -1 ? 4 : lessonDone.findIndex((x) => !x), 4)];
  const learnTitle = bots.length === 0 ? "Запустите первого бота" : doneCount >= 5 ? "Всё готово — запустите продвижение" : `Следующий шаг: ${curStage.t}`;
  const learnHref = bots.length === 0 ? "/dashboard/create" : !kb ? "/dashboard/assistant" : scns.length === 0 ? "/dashboard/scenarios" : !sel?.tgConnected ? "/dashboard/bots" : "/dashboard/promotion";
  const featured = FEATURED.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean) as typeof TEMPLATES;

  function useTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const { nodes, edges } = buildTemplate(id);
    const s: Scenario = { id: uid("s"), name: t.name, allChannels: true, published: false, nodes, edges, updatedAt: Date.now(), botId: getCurrentBotId() || undefined };
    upsertScenario(s);
    router.push(`/dashboard/scenarios/${s.id}`);
  }

  // Выбранная иллюстрация героя.
  const ill = ILLUSTS[illust] || ILLUSTS[0];
  const IllCore = ILL_ICONS[ill.core] || IconBot;
  const IllN0 = ILL_ICONS[ill.nodes[0]] || IconSend;
  const IllN1 = ILL_ICONS[ill.nodes[1]] || IconSpark;
  const IllN2 = ILL_ICONS[ill.nodes[2]] || IconUsers;
  const illGlow = "rgba(125,120,245,.5)";

  return (
    <>
      <Topbar crumbs={["Основной проект", "Главная"]} />
      <div className="content hp">
        {/* HERO */}
        <section className="hero fade-up">
          <div className="hero__l">
            <h1 className="hero__title">
              С возвращением!{" "}
              {activeBots > 0 ? <>Ваши <b>{activeBots} {botWord(activeBots)}</b> {activeBots === 1 ? "работает" : "работают"}</> : <>Давайте настроим первого бота</>}
            </h1>
            <div className="hero__chips">
              <span className="hero__chip"><i className="dot dot--live" /> Активных ботов: <b>{activeBots}</b></span>
              <span className="hero__chip">Заявок {periodLabel}: <b>{leads}</b></span>
              <span className="hero__chip">Пробный период: <b>{trial} {daysWord(trial)}</b></span>
            </div>
            <div className="hero__prog">
              <div className="hero__prog-top"><span>Готовность настройки{sel ? ` · ${sel.name}` : ""}</span><b>{setupPct}%</b></div>
              <div className="hero__bar"><span style={{ width: `${setupPct}%` }} /></div>
            </div>
            <Link href={nextHref} className="btn btn-primary btn-lg hero__cta glow">Продолжить настройку <IconArrowRight className="ico" /></Link>
          </div>
          <div className="hero__r">
            <div className="orb" aria-hidden>
              <span className="orb__glow" style={{ background: `radial-gradient(circle, ${illGlow} , transparent 70%)` }} />
              <span className="orb__ring orb__ring--1" />
              <span className="orb__ring orb__ring--2" />
              <span className="orb__core" style={{ background: ill.grad }}><IllCore className="ico" /></span>
              <span className="orb__node n-tg"><IllN0 className="ico" /></span>
              <span className="orb__node n-ai"><IllN1 className="ico" /></span>
              <span className="orb__node n-cl"><IllN2 className="ico" /></span>
            </div>
          </div>
        </section>

        <div className="hp-cols">
          {/* ПОКАЗАТЕЛИ — справа, всегда на виду */}
          <aside className="hp-side">
            <div className="hp-side__head">
              <div className="home-section-title" style={{ margin: 0 }}>Основные показатели</div>
              <div className="seg seg--sm">
                <button className={period === "today" ? "on" : ""} onClick={() => setPeriod("today")} type="button">Сегодня</button>
                <button className={period === "7" ? "on" : ""} onClick={() => setPeriod("7")} type="button">7 дней</button>
                <button className={period === "30" ? "on" : ""} onClick={() => setPeriod("30")} type="button">30 дней</button>
              </div>
            </div>
            <section className="mets mets--side">
              {metrics.map((m) => (
                <div key={m.key} className={`met met--row fade-up ${m.cls}`}>
                  <span className="met__ico"><m.Icon className="ico" /></span>
                  <div className="met__mid">
                    <span className="met__label">{m.label}</span>
                    {m.value > 0
                      ? <span className="met__delta">{periodLabel}</span>
                      : <Link href={m.href} className="met__emptybtn">{m.action} →</Link>}
                  </div>
                  {m.value > 0
                    ? <span className="met__val">{m.money ? `${m.value} ₽` : m.value}</span>
                    : <span className="met__zero">—</span>}
                </div>
              ))}
            </section>

            {/* Обучение — компактно в правой колонке */}
            <div className="lrn hp-lrn">
              <div className="lrn__head">
                <span className="lrn__ico"><IconRocket className="ico" /></span>
                <div>
                  <div className="lrn__title">{learnTitle}</div>
                  <div className="lrn__sub">Шаг {Math.min(doneCount + (doneCount < 5 ? 1 : 0), 5)} из 5 · ~5 минут</div>
                </div>
              </div>
              <div className="lrn__bar"><span style={{ width: `${(doneCount / 5) * 100}%` }} /></div>
              <div className="lrn__row">
                <Link href={learnHref} className="btn btn-primary btn-sm">Продолжить обучение</Link>
                <button className="lrn__toggle" onClick={() => setLearnOpen((v) => !v)} type="button">{learnOpen ? "Скрыть шаги" : "Все шаги"}</button>
              </div>
              {learnOpen && (
                <ol className="lrn__steps">
                  {LESSONS.map((l, i) => (
                    <li key={i} className={`lrn__step${lessonDone[i] ? " done" : ""}`}>
                      <span className="lrn__n">{lessonDone[i] ? <IconCheck className="ico" /> : i + 1}</span>
                      <span>{l.t}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>

          <div className="hp-main">
            {/* ЧТО СДЕЛАТЬ СЕЙЧАС */}
            <div className="home-section-title">Что сделать сейчас</div>
            <section className="recs">
              {recs.map((r) => (
                <div key={r.id} className={`rec fade-up${r.done ? " rec--done" : ""}`}>
                  <div className="rec__ico"><r.Icon className="ico" /></div>
                  <div className="rec__title">{r.title}{r.done && <span className="rec__ok"><IconCheck className="ico" /></span>}</div>
                  <div className="rec__desc">{r.desc}</div>
                  <div className="rec__bar"><span style={{ width: `${r.pct}%` }} /></div>
                  <div className="rec__foot">
                    <span className="rec__pct">{r.done ? "Готово" : `${r.pct}%`}</span>
                    <Link href={r.href} className="rec__btn">{r.done ? "Открыть" : r.step} →</Link>
                  </div>
                </div>
              ))}
            </section>

        {/* БОТЫ + ШАБЛОНЫ — единая панель со вкладками */}
        <section className="home-panel">
          <div className="home-panel__tabs">
            <button className={`home-panel__tab${homeTab === "bots" ? " on" : ""}`} onClick={() => setHomeTab("bots")} type="button">
              <IconBot className="ico" /> Мои боты <em>{bots.length}</em>
            </button>
            <button className={`home-panel__tab${homeTab === "templates" ? " on" : ""}`} onClick={() => setHomeTab("templates")} type="button">
              <IconLayers className="ico" /> Готовые шаблоны
            </button>
            <Link href={homeTab === "bots" ? "/dashboard/bots" : "/dashboard/scenarios"} className="home-panel__more">
              {homeTab === "bots" ? "Все боты" : "Смотреть все"} →
            </Link>
          </div>

          {homeTab === "bots" ? (
            <div className="botcards">
              {bots.map((bt) => {
                const st = botState(bt); const pct = botPct(bt);
                return (
                  <div key={bt.id} className={`botcard fade-up${bt.id === curBot ? " on" : ""}`} onClick={() => pickBot(bt.id)}>
                    <div className="botcard__top">
                      <span className="botcard__ava" style={{ background: avatarColor(bt.id) }}>{botInitials(bt.name)}</span>
                      <div className="botcard__id">
                        <div className="botcard__name">{bt.name}</div>
                        <div className="botcard__ch">{bt.tgUsername ? "@" + bt.tgUsername : bt.platform || "Не подключён"}</div>
                      </div>
                      <span className={`botcard__st st-${st}`}>{st === "work" && <i className="dot dot--live" />}{st === "warn" && <i className="dot dot--warn" />}{STATE_LABEL[st]}</span>
                    </div>
                    <div className="botcard__meta">
                      <span>Диалогов: <b>{dialogs}</b></span>
                      <span>Последнее: <b>{st === "work" ? "онлайн" : "—"}</b></span>
                    </div>
                    <div className="botcard__prog"><div className="botcard__bar"><span style={{ width: `${pct}%` }} /></div><span className="botcard__pct">{pct}%</span></div>
                    <div className="botcard__acts" onClick={(e) => e.stopPropagation()}>
                      <Link href={bt.scenarioId ? `/dashboard/scenarios/${bt.scenarioId}` : "/dashboard/scenarios"} className="btn btn-sm btn-primary">Открыть</Link>
                      <Link href="/dashboard/bots" className="btn btn-sm">Проверить</Link>
                    </div>
                  </div>
                );
              })}
              <Link href="/dashboard/create" className="botcard botcard--add">
                <span className="botcard__addico"><IconPlus className="ico" /></span>
                <span>Создать бота</span>
              </Link>
            </div>
          ) : (
            <div className="tpl3">
              {featured.map((t) => (
                <button key={t.id} className="tpl3__c" onClick={() => useTemplate(t.id)} type="button">
                  <span className="tpl3__ico"><IconLayers className="ico" /></span>
                  <span className="tpl3__name">{t.name}</span>
                  <span className="tpl3__desc">{t.description}</span>
                  <span className="tpl3__cat">{t.category}</span>
                  <span className="tpl3__use">Использовать →</span>
                </button>
              ))}
            </div>
          )}
        </section>
          </div>{/* hp-main */}
        </div>{/* hp-cols */}
      </div>
    </>
  );
}

// Мини-спарклайн (лёгкая линия). Пустая активность — ровная базовая линия.
function Spark({ up }: { up: boolean }) {
  const pts = up ? "0,14 12,12 24,13 36,8 48,9 60,4" : "0,10 12,10 24,10 36,10 48,10 60,10";
  return (
    <svg className="spark" viewBox="0 0 60 18" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
