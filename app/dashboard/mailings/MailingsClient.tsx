"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import {
  Broadcast,
  BroadcastStatus,
  STATUS_LABELS,
  loadBroadcasts,
  upsertBroadcast,
  deleteBroadcast,
  starterBroadcast,
} from "@/lib/mailings";

type Tab = "sent" | "scheduled" | "draft";
const TABS: { id: Tab; label: string; statuses: BroadcastStatus[] }[] = [
  { id: "sent", label: "Отправленные", statuses: ["sent"] },
  { id: "scheduled", label: "Запланированные", statuses: ["scheduled"] },
  { id: "draft", label: "Черновики", statuses: ["draft"] },
];

export default function MailingsClient() {
  const router = useRouter();
  const [list, setList] = useState<Broadcast[]>([]);
  const [tab, setTab] = useState<Tab>("sent");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Новая рассылка");

  useEffect(() => setList(loadBroadcasts()), []);
  useEsc(creating, () => setCreating(false));

  function create() {
    const b = starterBroadcast(name.trim() || "Новая рассылка");
    upsertBroadcast(b);
    router.push(`/dashboard/mailings/${b.id}`);
  }

  function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Удалить рассылку?")) return;
    deleteBroadcast(id);
    setList(loadBroadcasts());
  }

  const active = TABS.find((t) => t.id === tab)!;
  const filtered = list.filter((b) => active.statuses.includes(b.status));

  return (
    <>
      <Topbar crumbs={["Основной проект", "Рассылки"]} />
      <div className="content">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Рассылки</h1>
            <p className="muted" style={{ margin: 0 }}>
              Отправляйте сообщения пользователям сразу или по расписанию.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Создать рассылку
          </button>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card scn-empty">
            <div className="scn-empty__ico">📨</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              Список {tab === "sent" ? "отправленных" : tab === "scheduled" ? "запланированных" : "черновиков"} рассылок пуст
            </div>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Создать рассылку
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="tariff">
              <thead>
                <tr>
                  <th>Рассылка</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Получатели</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/mailings/${b.id}`)}>
                    <td style={{ fontWeight: 700 }}>{b.name}</td>
                    <td>
                      <span className={`scn-badge ${b.status === "sent" ? "pub" : "draft"}`}>
                        {STATUS_LABELS[b.status]}
                      </span>
                    </td>
                    <td className="muted">
                      {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td>{b.recipients || "—"}</td>
                    <td>
                      <button className="btn" style={{ padding: "6px 10px" }} onClick={(e) => remove(b.id, e)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <b>Создание рассылки</b>
              <button className="fn__x dark" onClick={() => setCreating(false)}>✕</button>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label className="label">Название</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button className="btn" onClick={() => setCreating(false)}>Отменить</button>
              <button className="btn btn-primary" onClick={create}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
