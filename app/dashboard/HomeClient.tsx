"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { IconSpark, IconChat, IconUsers, IconSend, IconStore } from "@/components/icons";
import { loadUsers } from "@/lib/users";
import { loadLabels } from "@/lib/stats";
import { TEMPLATES, buildTemplate, upsertScenario, uid, Scenario } from "@/lib/scenarios";

// Подборка популярных шаблонов для главной.
const FEATURED = ["sales-ai", "faq", "booking", "shop-order"];

// Шаги мини-обучения.
const LESSONS = [
  { t: "Создайте бота", d: "Ответьте на вопросы мастера — структура соберётся сама." },
  { t: "Настройте ассистента", d: "Имя, стиль общения и база знаний." },
  { t: "Возьмите шаблон", d: "Готовый сценарий под задачу — и доработайте." },
  { t: "Подключите канал", d: "Telegram за пару минут — токен у @BotFather." },
  { t: "Запустите", d: "Бот принимает сообщения и собирает заявки." },
];

export default function HomeClient() {
  const router = useRouter();
  const [users, setUsers] = useState(0);
  const [leads, setLeads] = useState(0);

  useEffect(() => {
    try {
      setUsers(loadUsers().length);
      const lead = loadLabels().find((l) => l.id === "sl_lead");
      setLeads(lead?.count || 0);
    } catch {}
  }, []);

  const stats = [
    { n: "0", l: "Сообщений", sub: "за 7 дней", Icon: IconChat, cls: "s-msg" },
    { n: String(users), l: "Пользователей", sub: "в базе", Icon: IconUsers, cls: "s-usr" },
    { n: String(leads), l: "Заявок", sub: "за 7 дней", Icon: IconSend, cls: "s-lead" },
    { n: "0 ₽", l: "Продажи", sub: "за 7 дней", Icon: IconStore, cls: "s-sale" },
  ];

  const featured = FEATURED.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean) as typeof TEMPLATES;

  function useTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const { nodes, edges } = buildTemplate(id);
    const s: Scenario = {
      id: uid("s"),
      name: t.name,
      allChannels: true,
      published: false,
      nodes,
      edges,
      updatedAt: Date.now(),
    };
    upsertScenario(s);
    router.push(`/dashboard/scenarios/${s.id}`);
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Главная"]} />
      <div className="content">
        {/* Приветствие + главная кнопка */}
        <div className="home-hero">
          <div>
            <h1 className="h1" style={{ marginBottom: 6 }}>С возвращением 👋</h1>
            <p className="muted" style={{ margin: 0, maxWidth: 520 }}>
              Создайте бота за пару минут — ответьте на несколько вопросов, а система сама
              соберёт структуру, сценарий и ИИ-ассистента.
            </p>
          </div>
          <Link href="/dashboard/create" className="btn btn-primary btn-lg home-hero__cta">
            <IconSpark className="ico" /> Создать бота с помощью ИИ
          </Link>
        </div>

        {/* Статистика */}
        <div className="home-stats">
          {stats.map((s) => (
            <div key={s.l} className={`home-stat ${s.cls}`}>
              <span className="home-stat__ico"><s.Icon className="ico" /></span>
              <div className="home-stat__body">
                <div className="home-stat__n">{s.n}</div>
                <div className="home-stat__l">{s.l}</div>
                <div className="home-stat__sub">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Готовые шаблоны */}
        <div className="home-row-head">
          <div className="home-section-title">Готовые шаблоны</div>
          <Link href="/dashboard/scenarios" className="home-row-head__more">Все шаблоны →</Link>
        </div>
        <div className="home-tpls">
          {featured.map((t) => (
            <button key={t.id} className="home-tpl" onClick={() => useTemplate(t.id)} type="button">
              <span className="home-tpl__emoji">{t.emoji}</span>
              <span className="home-tpl__name">{t.name}</span>
              <span className="home-tpl__desc">{t.description}</span>
              <span className="home-tpl__use">Использовать →</span>
            </button>
          ))}
        </div>

        {/* Обучение за 5 минут */}
        <div className="home-section-title">Обучение за 5 минут</div>
        <div className="home-learn">
          <div className="home-learn__side">
            <div className="home-learn__badge">🎓 5 минут</div>
            <div className="home-learn__title">Запустите первого бота</div>
            <p className="home-learn__text">Пять простых шагов от идеи до работающего бота, который принимает заявки.</p>
            <Link href="/dashboard/docs" className="btn btn-primary">Начать обучение</Link>
          </div>
          <ol className="home-learn__steps">
            {LESSONS.map((l, i) => (
              <li key={i} className="home-learn__step">
                <span className="home-learn__n">{i + 1}</span>
                <div>
                  <div className="home-learn__st">{l.t}</div>
                  <div className="home-learn__sd">{l.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
