"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/dashboard/bots", label: "Smartbot AI", Icon: IconBot },
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
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="brand-logo">🤖</span>
        <span>Smartbot AI</span>
      </div>

      <nav className="sidebar__nav">
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href} className={`nav-item${active ? " active" : ""}`}>
              <Icon className="ico" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar__promo">
        <div className="title">Подписка активна</div>
        <div className="sub">Осталось 12 дней</div>
        <button className="promo-btn">Настроить</button>
      </div>

      <div className="sidebar__foot">
        <div className="chip">Заказать бота</div>
        <div className="chip">Партнёры</div>
      </div>
    </aside>
  );
}
