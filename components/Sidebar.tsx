"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconBot,
  IconFlow,
  IconCloud,
  IconSend,
  IconChat,
  IconUsers,
  IconStore,
  IconChart,
  IconPlug,
  IconDoc,
} from "./icons";

const NAV = [
  { href: "/dashboard/bots", label: "BotPilot AI", Icon: IconBot },
  { href: "/dashboard/scenarios", label: "Сценарии", Icon: IconFlow },
  { href: "/dashboard/nocode", label: "Nocode Cloud", Icon: IconCloud },
  { href: "/dashboard/mailings", label: "Рассылки", Icon: IconSend },
  { href: "/dashboard/chats", label: "Чаты", Icon: IconChat },
  { href: "/dashboard/users", label: "Пользователи", Icon: IconUsers },
  { href: "/dashboard/shops", label: "Магазины", Icon: IconStore },
  { href: "/dashboard/stats", label: "Статистика", Icon: IconChart },
  { href: "/dashboard/integrations", label: "Интеграции", Icon: IconPlug },
  { href: "/dashboard/docs", label: "Документация", Icon: IconDoc },
];

export default function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const v = localStorage.getItem("sb_sidebar_collapsed");
    if (v !== null) setCollapsed(v === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sb_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar__top">
        <button className="sidebar__burger" onClick={toggle} aria-label="Свернуть меню">
          ☰
        </button>
        {!collapsed && (
          <div className="sidebar__brand">
            <span className="brand-logo">🤖</span>
            <span>BotPilot</span>
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item${active ? " active" : ""}`}
              title={collapsed ? label : undefined}
            >
              <Icon className="ico" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <>
          <div className="sidebar__promo">
            <div className="title">🎁 Пробный период</div>
            <div className="sub">Осталось 7 дней · все функции</div>
            <Link href="/dashboard/billing" className="promo-btn">Выбрать тариф</Link>
          </div>
          <div className="sidebar__foot">
            <div className="chip">Заказать бота</div>
            <div className="chip">Партнёры</div>
          </div>
        </>
      )}
    </aside>
  );
}
