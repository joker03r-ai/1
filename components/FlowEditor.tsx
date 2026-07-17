"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Scenario,
  FlowNode,
  Edge,
  NodeKind,
  NODE_META,
  MatchMode,
  MATCH_LABELS,
  uid,
  upsertScenario,
} from "@/lib/scenarios";

const NODE_W = 250;

type PendingEdge = { from: string; x: number; y: number } | null;

export default function FlowEditor({ initial }: { initial: Scenario }) {
  const [nodes, setNodes] = useState<FlowNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [published, setPublished] = useState(initial.published);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<PendingEdge>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [savedTick, setSavedTick] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // Автосохранение в localStorage.
  useEffect(() => {
    const t = setTimeout(() => {
      upsertScenario({
        ...initial,
        nodes,
        edges,
        published,
        updatedAt: Date.now(),
      });
      setSavedTick((x) => x + 1);
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges, published]); // eslint-disable-line

  // Измерение высот нод для точных стрелок.
  useLayoutEffect(() => {
    const h: Record<string, number> = {};
    for (const n of nodes) {
      const el = nodeRefs.current[n.id];
      if (el) h[n.id] = el.offsetHeight;
    }
    setHeights(h);
  }, [nodes]);

  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // ---- Перетаскивание ноды ----
  function onNodePointerDown(e: React.PointerEvent, id: string) {
    if ((e.target as HTMLElement).closest(".fn__port,.fn__x,textarea,input,select,button"))
      return;
    const n = nodes.find((x) => x.id === id)!;
    const p = canvasPoint(e.clientX, e.clientY);
    drag.current = { id, dx: p.x - n.x, dy: p.y - n.y };
    setSelected(id);
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  }
  const onDragMove = useCallback((e: PointerEvent) => {
    if (!drag.current) return;
    const p = canvasPoint(e.clientX, e.clientY);
    setNodes((ns) =>
      ns.map((n) =>
        n.id === drag.current!.id
          ? { ...n, x: Math.max(0, p.x - drag.current!.dx), y: Math.max(0, p.y - drag.current!.dy) }
          : n
      )
    );
  }, [canvasPoint]);
  const onDragUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
  }, [onDragMove]);

  // ---- Создание связи ----
  function onPortPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const p = canvasPoint(e.clientX, e.clientY);
    setPending({ from: id, x: p.x, y: p.y });
    window.addEventListener("pointermove", onPortMove);
    window.addEventListener("pointerup", onPortUp);
  }
  const onPortMove = useCallback((e: PointerEvent) => {
    const p = canvasPoint(e.clientX, e.clientY);
    setPending((pd) => (pd ? { ...pd, x: p.x, y: p.y } : pd));
  }, [canvasPoint]);
  const onPortUp = useCallback((e: PointerEvent) => {
    window.removeEventListener("pointermove", onPortMove);
    window.removeEventListener("pointerup", onPortUp);
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const targetEl = el?.closest("[data-node-id]") as HTMLElement | null;
    const to = targetEl?.getAttribute("data-node-id");
    setPending((pd) => {
      if (pd && to && to !== pd.from) {
        setEdges((es) => {
          if (es.some((x) => x.from === pd.from && x.to === to)) return es;
          return [...es, { id: uid("e"), from: pd.from, to }];
        });
      }
      return null;
    });
  }, [onPortMove]);

  // ---- Палитра: добавить блок ----
  function addNode(kind: NodeKind) {
    const meta = NODE_META[kind];
    const n: FlowNode = {
      id: uid(),
      kind,
      x: 120 + Math.random() * 60,
      y: 120 + Math.random() * 60,
      title: meta.label,
      text: kind === "action_message" ? "Текст сообщения" : kind === "event_message" || kind === "condition" ? "" : undefined,
      match: kind === "event_message" || kind === "condition" ? "similar" : undefined,
    };
    setNodes((ns) => [...ns, n]);
    setSelected(n.id);
  }

  function removeNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
  }
  function patchNode(id: string, patch: Partial<FlowNode>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }
  function removeEdge(id: string) {
    setEdges((es) => es.filter((e) => e.id !== id));
  }

  function nodeH(id: string) {
    return heights[id] ?? 90;
  }

  // Bezier path между нижним портом from и верхним центром to.
  function edgePath(from: FlowNode, to: FlowNode) {
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + nodeH(from.id);
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y;
    const dy = Math.max(40, Math.abs(y2 - y1) / 2);
    return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
  }

  const PALETTE: { kind: NodeKind; label: string; icon: string }[] = [
    { kind: "event_start", label: "Старт", icon: "▶" },
    { kind: "event_message", label: "Сообщение", icon: "✉" },
    { kind: "action_message", label: "Ответ", icon: "✈" },
    { kind: "action_ai", label: "Smartbot AI", icon: "🤖" },
    { kind: "condition", label: "Условие", icon: "◈" },
  ];

  return (
    <div className="flow">
      {/* Тулбар */}
      <div className="flow__toolbar">
        <Link href="/dashboard/scenarios" className="btn" style={{ padding: "6px 11px" }}>
          ←
        </Link>
        <div className="flow__palette">
          {PALETTE.map((p) => (
            <button key={p.kind} className="flow__pbtn" onClick={() => addNode(p.kind)} title={NODE_META[p.kind].label}>
              <span className="fp-ico" style={{ background: NODE_META[p.kind].color }}>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span className="flow__saved">{savedTick > 0 ? "✓ Сохранено" : ""}</span>
        <button
          className={`btn ${published ? "" : "btn-primary"}`}
          onClick={() => setShowPublish(true)}
        >
          {published ? "✓ Опубликован" : "Опубликовать"}
        </button>
      </div>

      {/* Канвас */}
      <div className="flow__scroll">
        <div className="flow__canvas" ref={canvasRef} onPointerDown={() => setSelected(null)}>
          <svg className="flow__edges">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#9aa0b2" />
              </marker>
            </defs>
            {edges.map((e) => {
              const from = nodes.find((n) => n.id === e.from);
              const to = nodes.find((n) => n.id === e.to);
              if (!from || !to) return null;
              return (
                <g key={e.id} className="flow__edge">
                  <path d={edgePath(from, to)} className="flow__edge-hit" onClick={() => removeEdge(e.id)} />
                  <path d={edgePath(from, to)} className="flow__edge-line" markerEnd="url(#arrow)" />
                </g>
              );
            })}
            {pending && (() => {
              const from = nodes.find((n) => n.id === pending.from)!;
              const x1 = from.x + NODE_W / 2;
              const y1 = from.y + nodeH(from.id);
              return (
                <path
                  d={`M ${x1} ${y1} C ${x1} ${y1 + 50}, ${pending.x} ${pending.y - 50}, ${pending.x} ${pending.y}`}
                  className="flow__edge-line pending"
                />
              );
            })()}
          </svg>

          {nodes.map((n) => {
            const meta = NODE_META[n.kind];
            return (
              <div
                key={n.id}
                data-node-id={n.id}
                ref={(el) => { nodeRefs.current[n.id] = el; }}
                className={`fn${selected === n.id ? " sel" : ""}`}
                style={{ left: n.x, top: n.y, width: NODE_W }}
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
              >
                <div className="fn__head" style={{ background: meta.color }}>
                  <span className="fn__ico">{meta.icon}</span>
                  <span className="fn__group">{meta.group}</span>
                  <button className="fn__x" onClick={() => removeNode(n.id)} aria-label="Удалить">✕</button>
                </div>
                <div className="fn__body">
                  {n.kind === "event_start" && (
                    <div className="fn__hint">Бот стартует по команде /start или первому сообщению.</div>
                  )}
                  {(n.kind === "event_message" || n.kind === "condition") && (
                    <>
                      <div className="fn__row">
                        <span className="fn__if">ЕСЛИ сообщение</span>
                        <select
                          className="fn__select"
                          value={n.match}
                          onChange={(e) => patchNode(n.id, { match: e.target.value as MatchMode })}
                        >
                          {(Object.keys(MATCH_LABELS) as MatchMode[]).map((m) => (
                            <option key={m} value={m}>{MATCH_LABELS[m]}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        className="fn__input"
                        placeholder="текст для сравнения"
                        value={n.text || ""}
                        onChange={(e) => patchNode(n.id, { text: e.target.value })}
                      />
                    </>
                  )}
                  {n.kind === "action_message" && (
                    <textarea
                      className="fn__textarea"
                      placeholder="Текст сообщения от бота"
                      value={n.text || ""}
                      onChange={(e) => patchNode(n.id, { text: e.target.value })}
                    />
                  )}
                  {n.kind === "action_ai" && (
                    <div className="fn__hint">Передаёт диалог AI-боту: отвечает по базе знаний.</div>
                  )}
                </div>
                {/* Порт-выход (низ) */}
                <button
                  className="fn__port"
                  title="Потяните, чтобы связать со следующим блоком"
                  onPointerDown={(e) => onPortPointerDown(e, n.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {showPublish && (
        <div className="modal-overlay" onClick={() => setShowPublish(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <b>Публикация</b>
              <button className="fn__x dark" onClick={() => setShowPublish(false)}>✕</button>
            </div>
            <p className="muted" style={{ margin: "6px 0 18px" }}>
              Добавьте канал в сценарий, чтобы пользователи попадали в сценарий и он заработал.
              {initial.allChannels ? " Сейчас подключены все каналы кабинета." : ""}
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button className="btn" onClick={() => setShowPublish(false)}>Подключить</button>
              <button
                className="btn btn-primary"
                onClick={() => { setPublished(true); setShowPublish(false); }}
              >
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
