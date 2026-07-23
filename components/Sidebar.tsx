"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconHome,
  IconBot,
  IconFlow,
  IconSpark,
  IconUsers,
  IconSend,
  IconChart,
  IconPlug,
  IconTeam,
  IconGear,
  IconHelp,
  IconPlus,
} from "./icons";
import { t } from "@/lib/i18n";
import { Lang, loadLang } from "@/lib/appPrefs";
import { trialDaysLeft, daysWord, TRIAL_DAYS } from "@/lib/trial";
import SidebarFoot from "./SidebarFoot";

// Основные разделы (максимум семь) — по принципу простого меню.
const MAIN = [
  { href: "/dashboard", key: "nav.home", Icon: IconHome, exact: true },
  { href: "/dashboard/bots", key: "nav.bots", Icon: IconBot },
  { href: "/dashboard/scenarios", key: "nav.scenarios", Icon: IconFlow },
  { href: "/dashboard/assistant", key: "nav.assistant", Icon: IconSpark },
  { href: "/dashboard/users", key: "nav.clients", Icon: IconUsers },
  { href: "/dashboard/mailings", key: "nav.promo", Icon: IconSend },
  { href: "/dashboard/stats", key: "nav.analytics", Icon: IconChart },
];

// Дополнительные разделы — внизу меню.
const SECONDARY = [
  { href: "/dashboard/integrations", key: "nav.integrations", Icon: IconPlug },
  { href: "/dashboard/team", key: "nav.team", Icon: IconTeam },
  { href: "/dashboard/billing", key: "nav.settings", Icon: IconGear },
  { href: "/dashboard/docs", key: "nav.help", Icon: IconHelp },
];

export default function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [lang, setLang] = useState<Lang>("ru");
  const [days, setDays] = useState(TRIAL_DAYS);

  useEffect(() => {
    const v = localStorage.getItem("sb_sidebar_collapsed");
    if (v !== null) setCollapsed(v === "1");
    setLang(loadLang());
    setDays(trialDaysLeft());
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sb_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  function renderItem({ href, key, Icon, exact }: { href: string; key: string; Icon: any; exact?: boolean }) {
    const active = exact ? path === href : path === href || path.startsWith(href + "/");
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

      <Link
        href="/dashboard/create"
        className={`sidebar__cta${collapsed ? " collapsed" : ""}`}
        title={collapsed ? t("brand.createAi", lang) : undefined}
      >
        <IconPlus className="ico" />
        {!collapsed && <span>{t("brand.createAi", lang)}</span>}
      </Link>

      <nav className="sidebar__nav">
        {MAIN.map(renderItem)}
        <div className="sidebar__divider" />
        {SECONDARY.map(renderItem)}
      </nav>

      {!collapsed && (
        <>
          <div className="sidebar__promo">
            <div className="promo-top">
              <span className="promo-gift">🎁</span>
              <div>
                <div className="title">{t("brand.trial", lang)}</div>
                <div className="sub">
                  {days > 0
                    ? `${lang === "en" ? "Left" : "Осталось"} ${days} ${lang === "en" ? "day(s)" : daysWord(days)} · ${lang === "en" ? "all features" : "все функции"}`
                    : lang === "en" ? "Trial ended" : "Пробный период завершён"}
                </div>
              </div>
            </div>
            <div className="promo-bar"><span style={{ width: `${(days / TRIAL_DAYS) * 100}%` }} /></div>
            <Link href="/dashboard/billing" className="promo-btn">{t("brand.choosePlan", lang)}</Link>
          </div>
          <SidebarFoot />
        </>
      )}
    </aside>
  );
}
