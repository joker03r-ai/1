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
  IconChannels,
  IconUserParse,
} from "./icons";
import { t } from "@/lib/i18n";
import { Lang, loadLang } from "@/lib/appPrefs";
import SidebarFoot from "./SidebarFoot";

const NAV = [
  { href: "/dashboard/bots", key: "nav.bots", Icon: IconBot },
  { href: "/dashboard/scenarios", key: "nav.scenarios", Icon: IconFlow },
  { href: "/dashboard/nocode", key: "nav.nocode", Icon: IconCloud },
  { href: "/dashboard/mailings", key: "nav.mailings", Icon: IconSend },
  { href: "/dashboard/chats", key: "nav.chats", Icon: IconChat },
  { href: "/dashboard/user-parser", key: "nav.parser", Icon: IconUserParse },
  { href: "/dashboard/users", key: "nav.users", Icon: IconUsers },
  { href: "/dashboard/shops", key: "nav.shops", Icon: IconStore },
  { href: "/dashboard/stats", key: "nav.stats", Icon: IconChart },
  { href: "/dashboard/integrations", key: "nav.integrations", Icon: IconPlug },
  { href: "/dashboard/channels", key: "nav.channels", Icon: IconChannels },
  { href: "/dashboard/docs", key: "nav.docs", Icon: IconDoc },
];

export default function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [lang, setLang] = useState<Lang>("ru");

  useEffect(() => {
    const v = localStorage.getItem("sb_sidebar_collapsed");
    if (v !== null) setCollapsed(v === "1");
    setLang(loadLang());
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
        {NAV.map(({ href, key, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          const label = t(key, lang);
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
            <div className="title">{t("brand.trial", lang)}</div>
            <div className="sub">{t("brand.trialLeft", lang)}</div>
            <Link href="/dashboard/billing" className="promo-btn">{t("brand.choosePlan", lang)}</Link>
          </div>
          <SidebarFoot />
          {/* стили и модалки чипов «Заказать бота» / «Партнёры» — в SidebarFoot */}
        </>
      )}
    </aside>
  );
}
