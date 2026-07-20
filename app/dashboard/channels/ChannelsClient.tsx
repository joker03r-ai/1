"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import {
  PLATFORMS,
  GROUP_LABELS,
  ChannelGroup,
  Platform,
  Channel,
  loadChannels,
  addChannel,
  updateChannel,
  removeChannel,
  platformById,
} from "@/lib/channels";
import { Scenario, loadScenarios } from "@/lib/scenarios";

export default function ChannelsClient() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [setup, setSetup] = useState<Platform | null>(null);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setChannels(loadChannels());
    setScenarios(loadScenarios());
  }, []);
  useEsc(!!setup, () => setSetup(null));

  const groups: ChannelGroup[] = ["direct", "jivochat", "wazzup24"];

  function openSetup(p: Platform) {
    setSetup(p);
    setName(p.label);
    setToken("");
    setErr("");
  }

  function createChannel() {
    if (!setup) return;
    if (!name.trim()) { setErr("Введите название канала"); return; }
    if (!token.trim()) { setErr(`Заполните «${setup.connectLabel || "данные подключения"}»`); return; }
    addChannel({ platformId: setup.id, name: name.trim(), token: token.trim() });
    setChannels(loadChannels());
    setSetup(null);
  }

  function del(id: string) {
    if (!confirm("Удалить канал?")) return;
    removeChannel(id);
    setChannels(loadChannels());
  }

  function attachScenario(id: string, scenarioId: string) {
    updateChannel(id, { scenarioId: scenarioId || undefined });
    setChannels(loadChannels());
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Каналы"]} />
      <div className="content" style={{ maxWidth: 1280 }}>
        <div className="ch-grid">
          {/* Левая колонка — создать канал */}
          <div className="ch-panel">
            <div className="ch-panel__title">Создать канал</div>
            {groups.map((g) => {
              const items = PLATFORMS.filter((p) => p.group === g);
              return (
                <div key={g} className="ch-group">
                  <div className="ch-group__label">{GROUP_LABELS[g]}</div>
                  <div className="ch-tiles">
                    {items.map((p) => (
                      <button key={p.id} className="ch-tile" onClick={() => openSetup(p)} title={p.label}>
                        <span className="ch-tile__ico" style={{ background: p.color }}>{p.emoji}</span>
                        <span className="ch-tile__label">{p.label}</span>
                        {p.isNew && <span className="ch-tile__new">new</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Правая колонка — список каналов */}
          <div className="ch-panel">
            <div className="ch-panel__title">Список каналов</div>
            {channels.length === 0 ? (
              <div className="ch-empty">
                <div className="ch-empty__ico">📡</div>
                <div className="ch-empty__title">Список каналов пуст</div>
                <p>Создайте в окне слева канал, чтобы подключить к нему сценарий.</p>
              </div>
            ) : (
              <div className="ch-list">
                {channels.map((c) => {
                  const p = platformById(c.platformId);
                  return (
                    <div className="ch-item" key={c.id}>
                      <span className="ch-tile__ico" style={{ background: p?.color || "#6c5ce7" }}>{p?.emoji || "💬"}</span>
                      <div className="ch-item__body">
                        <div className="ch-item__name">{c.name}</div>
                        <div className="ch-item__sub">
                          {p?.label} · {p?.group === "direct" ? "напрямую" : p?.group === "jivochat" ? "через JivoChat" : "через Wazzup24"}
                          <span className="ch-status">● подключён</span>
                        </div>
                        <div className="ch-item__scn">
                          <span>Сценарий:</span>
                          <select value={c.scenarioId || ""} onChange={(e) => attachScenario(c.id, e.target.value)}>
                            <option value="">— не выбран —</option>
                            {scenarios.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          {c.scenarioId && (
                            <button className="ch-open" onClick={() => router.push(`/dashboard/scenarios/${c.scenarioId}`)}>открыть ↗</button>
                          )}
                        </div>
                      </div>
                      <button className="scn-kebab" title="Удалить" onClick={() => del(c.id)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модалка подключения канала */}
      {setup && (
        <div className="modal-overlay" onClick={() => setSetup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal__head">
              <b><span className="ch-tile__ico sm" style={{ background: setup.color }}>{setup.emoji}</span> {setup.label}</b>
              <button className="fn__x dark" onClick={() => setSetup(null)}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Подключение канала «{setup.label}»
              {setup.group !== "direct" && ` через ${setup.group === "jivochat" ? "JivoChat" : "Wazzup24"}`}.
            </p>
            {setup.guide && <div className="tg-help">{setup.guide}</div>}
            <div className="field" style={{ marginTop: 12 }}>
              <label className="label">Название канала</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="label">{setup.connectLabel || "Данные подключения"}</label>
              <input
                className="input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={setup.connectPlaceholder}
                onKeyDown={(e) => e.key === "Enter" && createChannel()}
              />
            </div>
            {err && <div className="ai-error">⚠ {err}</div>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button className="btn" onClick={() => setSetup(null)}>Отменить</button>
              <button className="btn btn-primary" onClick={createChannel}>Создать канал</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
