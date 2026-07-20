"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import {
  INTEGRATIONS,
  CATEGORY_LABELS,
  IntegrationCategory,
  Integration,
  getConfig,
  saveConfig,
  disconnectIntegration,
  isConnected,
} from "@/lib/integrations";

export default function IntegrationsClient() {
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [active, setActive] = useState<Integration | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  function refresh() {
    setConnectedIds(INTEGRATIONS.filter((i) => isConnected(i.id)).map((i) => i.id));
  }
  useEffect(refresh, []);
  useEsc(!!active, () => setActive(null));

  const cats: IntegrationCategory[] = ["payment", "crm", "other"];

  function openSetup(it: Integration) {
    setActive(it);
    setValues(getConfig(it.id));
    setErr("");
  }

  function save() {
    if (!active) return;
    const missing = active.fields.filter((f) => !f.optional && !(values[f.key] || "").trim());
    if (missing.length) {
      setErr(`Заполните: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    saveConfig(active.id, values);
    refresh();
    setToast(`${active.name} подключён`);
    setTimeout(() => setToast(""), 2600);
    setActive(null);
  }

  function disconnect(it: Integration) {
    if (!confirm(`Отключить ${it.name}? Сохранённые ключи будут удалены.`)) return;
    disconnectIntegration(it.id);
    refresh();
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Интеграции"]} />
      <div className="content">
        <h1 className="h1" style={{ marginBottom: 2 }}>Интеграции</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Подключите платёжные системы и сервисы, чтобы принимать оплату и передавать
          данные из бота. Нажмите «Подключить» и введите ключи из личного кабинета сервиса.
        </p>

        {cats.map((cat) => {
          const items = INTEGRATIONS.filter((i) => i.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <div className="section-title">{CATEGORY_LABELS[cat]}</div>
              <div className="intg-grid">
                {items.map((it) => {
                  const on = connectedIds.includes(it.id);
                  return (
                    <div className={`intg-card${on ? " on" : ""}`} key={it.id}>
                      <div className="intg-card__top">
                        <span className="intg-ico" style={{ background: it.color }}>{it.emoji}</span>
                        <div>
                          <div className="intg-name">{it.name}</div>
                          {on && <span className="intg-badge">✓ подключено</span>}
                        </div>
                      </div>
                      <p className="intg-desc">{it.desc}</p>
                      <div className="row" style={{ gap: 8 }}>
                        <button
                          className={`btn ${on ? "" : "btn-primary"}`}
                          style={{ flex: 1 }}
                          onClick={() => openSetup(it)}
                        >
                          {on ? "Настроить" : "Подключить"}
                        </button>
                        {on && (
                          <button className="btn" onClick={() => disconnect(it)} title="Отключить">✕</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Модалка настройки интеграции */}
      {active && (
        <div className="modal-overlay" onClick={() => setActive(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal__head">
              <b><span style={{ marginRight: 8 }}>{active.emoji}</span>{active.name}</b>
              <button className="fn__x dark" onClick={() => setActive(null)}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>{active.desc}</p>

            {active.guide && (
              <ol className="intg-guide">
                {active.guide.map((g, i) => <li key={i}>{g}</li>)}
              </ol>
            )}

            {active.fields.map((f) => (
              <div className="field" key={f.key}>
                <label className="label">
                  {f.label}
                  {f.optional && <span className="intg-opt"> — необязательно</span>}
                </label>
                <input
                  className="input"
                  type={f.secret ? "password" : "text"}
                  placeholder={f.placeholder}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  autoComplete="off"
                />
                {f.hint && <div className="fn__var-hint">{f.hint}</div>}
              </div>
            ))}

            {active.docsUrl && (
              <a className="intg-docs" href={active.docsUrl} target="_blank" rel="noreferrer">
                Документация {active.name} ↗
              </a>
            )}
            {err && <div className="ai-error">⚠ {err}</div>}

            <div className="row" style={{ justifyContent: "space-between", gap: 10, marginTop: 16 }}>
              {isConnected(active.id) ? (
                <button className="btn" onClick={() => disconnect(active)} style={{ color: "#ef4444" }}>Отключить</button>
              ) : <span />}
              <div className="row" style={{ gap: 10 }}>
                <button className="btn" onClick={() => setActive(null)}>Отменить</button>
                <button className="btn btn-primary" onClick={save}>Сохранить и подключить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="bill-toast">✓ {toast}</div>}
    </>
  );
}
