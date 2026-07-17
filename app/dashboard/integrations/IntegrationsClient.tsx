"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import {
  INTEGRATIONS,
  CATEGORY_LABELS,
  IntegrationCategory,
  loadConnected,
  toggleConnected,
} from "@/lib/integrations";

export default function IntegrationsClient() {
  const [connected, setConnected] = useState<string[]>([]);
  useEffect(() => setConnected(loadConnected()), []);

  const cats: IntegrationCategory[] = ["payment", "crm", "other"];

  return (
    <>
      <Topbar crumbs={["Основной проект", "Интеграции"]} />
      <div className="content">
        <h1 className="h1" style={{ marginBottom: 2 }}>Интеграции</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Подключите платёжные системы и сервисы, чтобы принимать оплату и передавать
          данные из бота.
        </p>

        {cats.map((cat) => {
          const items = INTEGRATIONS.filter((i) => i.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <div className="section-title">{CATEGORY_LABELS[cat]}</div>
              <div className="intg-grid">
                {items.map((it) => {
                  const on = connected.includes(it.id);
                  return (
                    <div className="intg-card" key={it.id}>
                      <div className="intg-card__top">
                        <span className="intg-ico" style={{ background: it.color }}>{it.emoji}</span>
                        <div>
                          <div className="intg-name">{it.name}</div>
                          {on && <span className="intg-badge">✓ подключено</span>}
                        </div>
                      </div>
                      <p className="intg-desc">{it.desc}</p>
                      <button
                        className={`btn ${on ? "" : "btn-primary"}`}
                        style={{ width: "100%" }}
                        onClick={() => setConnected(toggleConnected(it.id))}
                      >
                        {on ? "Отключить" : "Подключить"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
