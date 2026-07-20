"use client";

import { useEffect, useState } from "react";
import { BotConfig, DEFAULT_BOT } from "@/lib/types";
import Topbar from "@/components/Topbar";
import BotTraining from "@/components/BotTraining";
import ChannelsPanel from "@/components/ChannelsPanel";
import BalancePanel from "@/components/BalancePanel";
import ChatWidget from "@/components/ChatWidget";

type Tab = "instruction" | "training" | "channels" | "balance";

const TABS: { id: Tab; label: string }[] = [
  { id: "instruction", label: "Инструкция" },
  { id: "training", label: "Обучение AI" },
  { id: "channels", label: "Подключение каналов" },
  { id: "balance", label: "Баланс" },
];

const STORAGE_KEY = "sb_bot_config";

export default function BotDetail() {
  const [tab, setTab] = useState<Tab>("training");
  const [bot, setBot] = useState<BotConfig>(DEFAULT_BOT);
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Загрузка/сохранение конфигурации бота в localStorage (демо-персистентность).
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setBot({ ...DEFAULT_BOT, ...JSON.parse(raw) });
      } catch {}
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(bot));
  }, [bot, ready]);

  function saved() {
    setToast("Настройки сохранены");
    setTimeout(() => setToast(null), 2200);
  }

  const showChat = tab === "instruction" || tab === "training";

  return (
    <>
      <Topbar crumbs={["Основной проект", "BotPilot AI", bot.name]} />
      <div className="content">
        <div style={{ marginBottom: 4 }}>
          <a className="btn-ghost" href="/dashboard/bots" style={{ fontSize: 13 }}>
            ← Список AI ботов
          </a>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {showChat ? (
          <div className="grid-2">
            <BotTraining bot={bot} onChange={setBot} onSaved={saved} />
            <div>
              <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
                Тестируйте бота прямо здесь — он отвечает по заданной базе знаний.
              </div>
              <ChatWidget bot={bot} key={bot.name + bot.modelId + bot.goal} />
            </div>
          </div>
        ) : tab === "channels" ? (
          <ChannelsPanel bot={bot} />
        ) : (
          <BalancePanel bot={bot} />
        )}
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1f2330",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 50,
          }}
        >
          ✓ {toast}
        </div>
      )}
    </>
  );
}
