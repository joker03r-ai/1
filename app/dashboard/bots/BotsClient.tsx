"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { IconPlus } from "@/components/icons";
import { avatarColor } from "@/lib/users";
import {
  Bot,
  BotStatus,
  STATUS_LABELS,
  loadBots,
  getCurrentBotId,
  setCurrentBotId,
  updateBot,
  removeBot,
} from "@/lib/bots";

const FILTERS: { id: "all" | BotStatus; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "draft", label: "Черновики" },
  { id: "off", label: "Отключённые" },
];

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "🤖";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}

export default function BotsClient() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [cur, setCur] = useState("");
  const [filter, setFilter] = useState<"all" | BotStatus>("all");
  const [confirm, setConfirm] = useState<Bot | null>(null);

  useEffect(() => {
    setBots(loadBots());
    setCur(getCurrentBotId());
  }, []);

  function refresh() {
    setBots(loadBots());
    setCur(getCurrentBotId());
  }
  function pick(id: string) {
    setCurrentBotId(id);
    setCur(id);
  }
  function cycleStatus(bt: Bot) {
    const order: BotStatus[] = ["active", "draft", "off"];
    const next = order[(order.indexOf(bt.status) + 1) % order.length];
    updateBot(bt.id, { status: next });
    refresh();
  }
  function remove(bt: Bot) {
    removeBot(bt.id);
    setConfirm(null);
    refresh();
  }

  const shown = bots.filter((b) => filter === "all" || b.status === filter);

  return (
    <>
      <Topbar crumbs={["Основной проект", "Мои боты"]} />
      <div className="content">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Мои боты · {bots.length}</h1>
            <p className="muted" style={{ margin: 0 }}>
              Обучите бота на данных компании, подключите каналы и отвечайте клиентам 24/7.
              У каждого бота — свой сценарий и ИИ-ассистент.
            </p>
          </div>
          <Link href="/dashboard/create" className="btn btn-primary">
            <IconPlus className="ico" /> Создать бота
          </Link>
        </div>

        <div className="seg" style={{ margin: "16px 0" }}>
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? "on" : ""} onClick={() => setFilter(f.id)} type="button">
              {f.label}
            </button>
          ))}
        </div>

        <div className="bots-list">
          {shown.map((bt) => (
            <div key={bt.id} className={`bots-row card${bt.id === cur ? " cur" : ""}`}>
              <span className="user-ava" style={{ width: 44, height: 44, fontSize: 15, background: avatarColor(bt.id) }}>
                {initials(bt.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{bt.name}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {[bt.platform, bt.goal].filter(Boolean).join(" · ") || "Бот"}
                </div>
              </div>
              <button className={`bots-badge st-${bt.status}`} onClick={() => cycleStatus(bt)} title="Сменить статус">
                {STATUS_LABELS[bt.status]}
              </button>
              {bt.id === cur ? (
                <span className="bots-cur">Выбран ✓</span>
              ) : (
                <button className="btn btn-sm" onClick={() => pick(bt.id)}>Выбрать</button>
              )}
              {bt.scenarioId && (
                <Link href={`/dashboard/scenarios/${bt.scenarioId}`} className="btn btn-sm">Открыть</Link>
              )}
              <Link href="/dashboard/assistant" className="btn btn-sm">Ассистент</Link>
              <button className="user-act del" onClick={() => setConfirm(bt)}>Удалить</button>
            </div>
          ))}
          {shown.length === 0 && (
            <div className="muted" style={{ textAlign: "center", padding: 40 }}>
              Ботов в этой категории нет. <Link href="/dashboard/create" style={{ color: "var(--violet-700)", fontWeight: 700 }}>Создать бота →</Link>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__head">
              <b>Удалить бота</b>
              <button className="fn__x dark" onClick={() => setConfirm(null)}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Бот <b>{confirm.name}</b> будет удалён. Его сценарий останется в разделе «Сценарии».
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={() => setConfirm(null)}>Отменить</button>
              <button className="btn btn-danger" onClick={() => remove(confirm)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
