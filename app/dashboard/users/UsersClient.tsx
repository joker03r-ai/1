"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import { BotUser, loadUsers, saveUsers, avatarColor } from "@/lib/users";
import { loadTeam, currentMember, canManage } from "@/lib/team";
import BotFilter, { initialBotFilter } from "@/components/BotFilter";
import {
  Variable,
  loadVariables,
  saveVariables,
  addVariable,
  vid,
  VarType,
  VarScope,
  VAR_TYPE_LABELS,
  VAR_SCOPE_LABELS,
} from "@/lib/variables";

// Инициалы: до двух букв из имени.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function UsersClient() {
  const [users, setUsers] = useState<BotUser[]>([]);
  const [vars, setVars] = useState<Variable[]>([]);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("Все");
  const [creating, setCreating] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [confirm, setConfirm] = useState<BotUser | null>(null);
  const [botFilter, setBotFilter] = useState("all");

  useEffect(() => {
    setUsers(loadUsers());
    setVars(loadVariables());
    const team = loadTeam();
    setCanEdit(canManage(currentMember(team).role));
    setBotFilter(initialBotFilter());
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const okQ =
        !q ||
        u.name.toLowerCase().includes(q.toLowerCase()) ||
        u.username.toLowerCase().includes(q.toLowerCase());
      const okCh = channel === "Все" || u.channel === channel;
      const okBot = botFilter === "all" || (u.botId || "bot_default") === botFilter;
      return okQ && okCh && okBot;
    });
  }, [users, q, channel, botFilter]);

  // Показываем как колонки только пользовательские переменные.
  const cols = vars.filter((v) => v.scope === "user");
  const blockedCount = users.filter((u) => u.blocked).length;

  function toggleBlock(u: BotUser) {
    const next = users.map((x) => (x.id === u.id ? { ...x, blocked: !x.blocked } : x));
    setUsers(next);
    saveUsers(next);
  }
  function removeUser(u: BotUser) {
    const next = users.filter((x) => x.id !== u.id);
    setUsers(next);
    saveUsers(next);
    setConfirm(null);
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Клиенты"]} />
      <div className="content">
        <BotFilter value={botFilter} onChange={setBotFilter} />
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Клиенты</h1>
            <p className="muted" style={{ margin: 0 }}>
              Каждый написавший боту попадает сюда. Значения переменных собираются в
              сценариях и видны рядом с пользователем.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Добавить переменную
          </button>
        </div>

        <div className="row" style={{ margin: "18px 0", gap: 10 }}>
          <input
            className="input"
            style={{ maxWidth: 320 }}
            placeholder="Поиск по имени или нику…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="select" style={{ maxWidth: 200 }} value={channel} onChange={(e) => setChannel(e.target.value)}>
            {["Все", "Telegram", "ВКонтакте", "WhatsApp", "Сайт"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 13 }}>
            Всего: {filtered.length}
            {blockedCount > 0 && <> · заблокировано: {blockedCount}</>}
          </span>
        </div>

        {!canEdit && (
          <div className="hint" style={{ marginBottom: 12 }}>
            🔒 Блокировать и удалять пользователей может только владелец или администратор кабинета.
          </div>
        )}

        <div className="table-wrap">
          <table className="tariff">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Канал</th>
                <th>Первый контакт</th>
                {cols.map((v) => (
                  <th key={v.id}>{v.name}</th>
                ))}
                {canEdit && <th style={{ textAlign: "right" }}>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className={u.blocked ? "user-blocked" : ""}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="user-ava" style={{ background: avatarColor(u.username || u.name) }}>
                        {initials(u.name)}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                          {u.name}
                          {u.blocked && <span className="user-badge-block">заблокирован</span>}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.channel}</td>
                  <td className="muted">{u.firstSeen}</td>
                  {cols.map((v) => (
                    <td key={v.id}>
                      {u.values[v.name] ? (
                        <span style={{ fontWeight: 600 }}>{u.values[v.name]}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  ))}
                  {canEdit && (
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className={`user-act${u.blocked ? " unblock" : " block"}`}
                          onClick={() => toggleBlock(u)}
                          title={u.blocked ? "Разблокировать" : "Заблокировать"}
                        >
                          {u.blocked ? "Разблокировать" : "Заблокировать"}
                        </button>
                        <button
                          className="user-act del"
                          onClick={() => setConfirm(u)}
                          title="Удалить пользователя"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3 + cols.length + (canEdit ? 1 : 0)} className="muted" style={{ textAlign: "center", padding: 30 }}>
                    Ничего не найдено.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <CreateVariableModal
          onClose={() => setCreating(false)}
          onCreated={(v) => {
            setVars(addVariable(v));
            setCreating(false);
          }}
        />
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__head">
              <b>Удалить пользователя</b>
              <button className="fn__x dark" onClick={() => setConfirm(null)}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Пользователь <b>{confirm.name}</b> ({confirm.username}) будет удалён из базы вместе
              с собранными значениями переменных. Действие необратимо.
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={() => setConfirm(null)}>Отменить</button>
              <button className="btn btn-danger" onClick={() => removeUser(confirm)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CreateVariableModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (v: Variable) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<VarType>("string");
  const [scope, setScope] = useState<VarScope>("user");
  const [initial, setInitial] = useState("");
  useEsc(true, onClose);

  function submit() {
    if (!name.trim()) return;
    onCreated({ id: vid(), name: name.trim(), type, scope, initial });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <b>Создание переменной</b>
          <button className="fn__x dark" onClick={onClose}>✕</button>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">Название</label>
          <input className="input" placeholder="Телефон" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label className="label">Тип переменной</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as VarType)}>
            {(Object.keys(VAR_TYPE_LABELS) as VarType[]).map((t) => (
              <option key={t} value={t}>{VAR_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Начальное значение</label>
          <input className="input" placeholder="необязательно" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Уровень доступа</label>
          <div className="seg" style={{ width: "100%" }}>
            {(Object.keys(VAR_SCOPE_LABELS) as VarScope[]).map((s) => (
              <button key={s} className={scope === s ? "on" : ""} onClick={() => setScope(s)} style={{ flex: 1 }} type="button">
                {VAR_SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="hint">
            Пользовательская — своё значение у каждого клиента. Глобальная — одно на всех.
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
          <button className="btn" onClick={onClose}>Отменить</button>
          <button className="btn btn-primary" onClick={submit}>Создать</button>
        </div>
      </div>
    </div>
  );
}
