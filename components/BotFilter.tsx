"use client";

import { useEffect, useState } from "react";
import { Bot, loadBots, getCurrentBotId } from "@/lib/bots";

// Панель фильтра по боту. value — id бота или "all".
export default function BotFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [bots, setBots] = useState<Bot[]>([]);

  useEffect(() => {
    setBots(loadBots());
  }, []);

  if (bots.length <= 1) return null; // фильтр не нужен, если бот один

  return (
    <div className="botfilter">
      <span className="botfilter__label">Бот:</span>
      <button className={`botfilter__chip${value === "all" ? " on" : ""}`} onClick={() => onChange("all")} type="button">
        Все боты
      </button>
      {bots.map((b) => (
        <button
          key={b.id}
          className={`botfilter__chip${value === b.id ? " on" : ""}`}
          onClick={() => onChange(b.id)}
          type="button"
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}

// Начальное значение фильтра — активный бот (или "all", если он не задан).
export function initialBotFilter(): string {
  return getCurrentBotId() || "all";
}
