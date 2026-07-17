"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import FlowEditor from "@/components/FlowEditor";
import { Broadcast, getBroadcast, upsertBroadcast } from "@/lib/mailings";
import { NOTIFY_CHANNELS } from "@/lib/managers";
import { loadVariables, Variable } from "@/lib/variables";
import { useEsc } from "@/lib/useEsc";

export default function BroadcastEditorClient() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [b, setB] = useState<Broadcast | null | undefined>(undefined);
  const [showParams, setShowParams] = useState(false);
  const ref = useRef<Broadcast | null>(null);

  useEffect(() => {
    const found = getBroadcast(id) ?? null;
    setB(found);
    ref.current = found;
  }, [id]);

  if (b === undefined) {
    return (
      <>
        <Topbar crumbs={["Основной проект", "Рассылки", "…"]} />
        <div className="content muted">Загрузка…</div>
      </>
    );
  }
  if (b === null) {
    return (
      <>
        <Topbar crumbs={["Основной проект", "Рассылки", "Не найдена"]} />
        <div className="content">
          <p className="muted">Рассылка не найдена.</p>
          <Link className="btn btn-primary" href="/dashboard/mailings">← К рассылкам</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Рассылки", b.name]} />
      <FlowEditor
        initial={b as any}
        backHref="/dashboard/mailings"
        persist={({ nodes, edges, published }) => {
          const cur = ref.current!;
          const next = { ...cur, nodes, edges, published, updatedAt: Date.now() };
          ref.current = next;
          upsertBroadcast(next);
        }}
        headerActions={
          <button className="btn btn-primary" onClick={() => setShowParams(true)}>
            Настроить рассылку
          </button>
        }
      />
      {showParams && (
        <BroadcastParams
          broadcast={ref.current!}
          onClose={() => setShowParams(false)}
          onSend={(scheduledAt) => {
            const cur = ref.current!;
            const next: Broadcast = {
              ...cur,
              status: scheduledAt ? "scheduled" : "sent",
              scheduledAt,
              recipients: cur.audience === "all" ? 5 : 3,
              published: true,
              updatedAt: Date.now(),
            };
            upsertBroadcast(next);
            router.push("/dashboard/mailings");
          }}
        />
      )}
    </>
  );
}

function BroadcastParams({
  broadcast,
  onClose,
  onSend,
}: {
  broadcast: Broadcast;
  onClose: () => void;
  onSend: (scheduledAt?: string) => void;
}) {
  const [channel, setChannel] = useState(broadcast.channel || "");
  const [audience, setAudience] = useState<"all" | "list">(broadcast.audience || "all");
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState("");
  const [vars, setVars] = useState<Variable[]>([]);
  const [conditions, setConditions] = useState<{ varName: string; value: string }[]>([]);
  useEsc(true, () => { persistParams(); onClose(); });

  useEffect(() => setVars(loadVariables()), []);

  function persistParams() {
    upsertBroadcast({ ...broadcast, channel, audience });
  }

  return (
    <div className="modal-overlay" onClick={() => { persistParams(); onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <b>Параметры рассылки</b>
          <button className="fn__x dark" onClick={() => { persistParams(); onClose(); }}>✕</button>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">Канал</label>
          <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Поиск по каналам…</option>
            {NOTIFY_CHANNELS.filter((c) => c.id !== "all").map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.bot ? ` · ${c.bot}` : ""}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Список пользователей</label>
          <div className="seg" style={{ width: "100%" }}>
            <button className={audience === "all" ? "on" : ""} style={{ flex: 1 }} onClick={() => setAudience("all")}>
              Все пользователи
            </button>
            <button className={audience === "list" ? "on" : ""} style={{ flex: 1 }} onClick={() => setAudience("list")}>
              По списку
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label">Чёрный список</label>
          <input className="input" placeholder="Поиск по спискам… (0 пользователей)" disabled />
        </div>

        <div className="field">
          <label className="label">Условия</label>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} onClick={() => setConditions((c) => [...c, { varName: vars[0]?.name || "", value: "" }])}>
              + Условие на переменную
            </button>
            <button className="btn" style={{ flex: 1 }} disabled>+ Другие</button>
          </div>
          {conditions.map((c, i) => (
            <div className="row" key={i} style={{ marginTop: 8 }}>
              <select className="select" value={c.varName} onChange={(e) => setConditions((arr) => arr.map((x, idx) => idx === i ? { ...x, varName: e.target.value } : x))}>
                {vars.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
              <input className="input" placeholder="значение" value={c.value} onChange={(e) => setConditions((arr) => arr.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
              <button className="btn" onClick={() => setConditions((arr) => arr.filter((_, idx) => idx !== i))} style={{ padding: "8px 10px" }}>✕</button>
            </div>
          ))}
        </div>

        <label className="fn__check" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
          Запланировать на будущее
        </label>
        {schedule && (
          <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ marginBottom: 14 }} />
        )}

        <div className="row" style={{ gap: 10 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => alert("Демо: тестовая рассылка отправлена только вам")}>
            Тестовая рассылка (только себе)
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => onSend(schedule && when ? new Date(when).toISOString() : undefined)}
          >
            {schedule ? "Запланировать" : "Отправить рассылку"}
          </button>
        </div>
      </div>
    </div>
  );
}
