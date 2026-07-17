"use client";

import { BotConfig } from "@/lib/types";

const CHANNELS = [
  { name: "Telegram", short: "TG", color: "#2AABEE" },
  { name: "ВКонтакте", short: "VK", color: "#0077FF" },
  { name: "WhatsApp", short: "WA", color: "#25D366" },
  { name: "MAX", short: "MAX", color: "#6C5CE7" },
  { name: "Jivo", short: "J", color: "#00B956" },
  { name: "Виджет на сайт", short: "</>", color: "#334155" },
  { name: "Avito", short: "A", color: "#00AAFF" },
  { name: "Одноклассники", short: "OK", color: "#EE8208" },
];

export default function ChannelsPanel({ bot }: { bot: BotConfig }) {
  return (
    <div className="grid-2">
      <div className="card" style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Создать канал для «{bot.name}»</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>
          Выберите мессенджер — и подключите его к боту. Можно добавить один или
          несколько каналов, бот будет работать параллельно.
        </p>
        <div className="channel-grid">
          {CHANNELS.map((c) => (
            <button className="channel" key={c.name} type="button">
              <span className="ch-ico" style={{ background: c.color }}>
                {c.short}
              </span>
              <span className="ch-name">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Расширенные настройки</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Вы можете добавить в бота действия после срабатывания AI-модуля или изменить
          условия подключения бота к диалогу. Для включения изменения перейдите в
          сценарий.
        </p>
        <div className="field" style={{ marginTop: 18 }}>
          <label className="label">Сценарии с AI-ботом</label>
          <div className="row">
            <select className="select">
              <option>Шаблон «Консультация в режиме AI»</option>
              <option>Свой сценарий…</option>
            </select>
            <button className="btn">Перейти к сценарию →</button>
          </div>
        </div>

        <div className="info-note" style={{ marginTop: 18 }}>
          <span>ℹ️</span>
          <span>
            Стоп-слово для передачи оператору: <b>{bot.stopWord}</b>. Когда клиент
            напишет его, бот остановится и переведёт диалог на человека.
          </span>
        </div>
      </div>
    </div>
  );
}
