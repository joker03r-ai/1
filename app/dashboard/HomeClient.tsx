"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import {
  IconSpark,
  IconBot,
  IconUsers,
  IconFlow,
  IconChat,
  IconSend,
  IconChart,
  IconStore,
  IconChannels,
  IconUserParse,
  IconPlug,
} from "@/components/icons";
import { loadUsers } from "@/lib/users";
import { loadScenarios } from "@/lib/scenarios";

const QUICK = [
  { href: "/dashboard/bots", label: "Мои боты", desc: "Список и настройка ботов", Icon: IconBot },
  { href: "/dashboard/scenarios", label: "Сценарии", desc: "Визуальные диалоги", Icon: IconFlow },
  { href: "/dashboard/assistant", label: "ИИ-ассистент", desc: "Роль и база знаний", Icon: IconSpark },
  { href: "/dashboard/users", label: "Клиенты", desc: "База и статусы", Icon: IconUsers },
  { href: "/dashboard/chats", label: "Диалоги", desc: "Переписки и операторы", Icon: IconChat },
  { href: "/dashboard/mailings", label: "Рассылки", desc: "Сообщения и цепочки", Icon: IconSend },
  { href: "/dashboard/user-parser", label: "Продвижение", desc: "Парсер и прогрев", Icon: IconUserParse },
  { href: "/dashboard/channels", label: "Каналы", desc: "Подключение площадок", Icon: IconChannels },
  { href: "/dashboard/shops", label: "Магазины", desc: "Товары и оплата", Icon: IconStore },
  { href: "/dashboard/stats", label: "Аналитика", desc: "Показатели и советы", Icon: IconChart },
  { href: "/dashboard/integrations", label: "Интеграции", desc: "CRM, оплата, вебхуки", Icon: IconPlug },
];

export default function HomeClient() {
  const [clients, setClients] = useState(0);
  const [scenarios, setScenarios] = useState(0);

  useEffect(() => {
    try {
      setClients(loadUsers().length);
      setScenarios(loadScenarios().length);
    } catch {}
  }, []);

  const stats = [
    { n: "1", l: "Активный бот", Icon: IconBot },
    { n: String(clients), l: "Клиентов в базе", Icon: IconUsers },
    { n: String(scenarios), l: "Сценариев", Icon: IconFlow },
    { n: "0", l: "Новых заявок", Icon: IconSend },
  ];

  const recs = [
    "Соберите первый сценарий: приветствие → вопрос → заявка менеджеру.",
    "Заполните базу знаний ИИ-ассистента — тогда он ответит на частые вопросы сам.",
    "Подключите канал (Telegram/ВКонтакте), чтобы бот начал принимать сообщения.",
    "Настройте оплату в «Интеграциях», если продаёте товары или услуги.",
  ];

  return (
    <>
      <Topbar crumbs={["Основной проект", "Главная"]} />
      <div className="content">
        {/* Приветствие + главная кнопка */}
        <div className="home-hero">
          <div>
            <h1 className="h1" style={{ marginBottom: 6 }}>С возвращением 👋</h1>
            <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
              Создайте бота за пару минут — ответьте на несколько вопросов, а система сама
              соберёт структуру, сценарий, тексты и ИИ-ассистента.
            </p>
          </div>
          <Link href="/dashboard/create" className="btn btn-primary btn-lg home-hero__cta">
            <IconSpark className="ico" /> Создать бота с помощью ИИ
          </Link>
        </div>

        {/* Статистика */}
        <div className="home-stats">
          {stats.map((s) => (
            <div key={s.l} className="home-stat">
              <span className="home-stat__ico"><s.Icon className="ico" /></span>
              <div>
                <div className="home-stat__n">{s.n}</div>
                <div className="home-stat__l">{s.l}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Быстрые действия */}
        <div className="home-section-title">Быстрые действия</div>
        <div className="home-quick">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="home-quick__card">
              <span className="home-quick__ico"><q.Icon className="ico" /></span>
              <div>
                <div className="home-quick__label">{q.label}</div>
                <div className="home-quick__desc">{q.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Рекомендации */}
        <div className="home-section-title">С чего начать</div>
        <div className="home-recs">
          {recs.map((r, i) => (
            <div key={i} className="home-rec">
              <span className="home-rec__n">{i + 1}</span>
              <span>{r}</span>
            </div>
          ))}
          <Link href="/dashboard/docs" className="home-rec__more">Открыть подробную инструкцию →</Link>
        </div>
      </div>
    </>
  );
}
