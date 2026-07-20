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
  DataFormat,
  FORMAT_LABELS,
  FlowButton,
  uid,
  upsertScenario,
} from "@/lib/scenarios";
import {
  Variable,
  loadVariables,
  addVariable,
  vid,
  VarType,
  VarScope,
  VAR_TYPE_LABELS,
  VAR_SCOPE_LABELS,
} from "@/lib/variables";
import { Manager, loadManagers, NOTIFY_CHANNELS } from "@/lib/managers";
import { StatLabel, loadLabels, addLabel } from "@/lib/stats";
import { PAYMENT_PROVIDERS } from "@/lib/integrations";
import { useEsc } from "@/lib/useEsc";

const NODE_W = 250;

type PendingEdge = {
  from: string;
  x: number;
  y: number;
  branch?: "error";
  fromButton?: string;
} | null;

export default function FlowEditor({
  initial,
  persist,
  headerActions,
  backHref = "/dashboard/scenarios",
}: {
  initial: Scenario;
  // Кастомное сохранение (для рассылок). По умолчанию — в сценарии.
  persist?: (data: { nodes: FlowNode[]; edges: Edge[]; published: boolean }) => void;
  // Заменяет кнопку «Опубликовать» (например, «Настроить рассылку»).
  headerActions?: React.ReactNode;
  backHref?: string;
}) {
  const [nodes, setNodes] = useState<FlowNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [published, setPublished] = useState(initial.published);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<PendingEdge>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [vars, setVars] = useState<Variable[]>([]);
  const [showVars, setShowVars] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [statLabels, setStatLabels] = useState<StatLabel[]>([]);
  const [threshold, setThreshold] = useState<number>(initial.similarityThreshold ?? 0.4);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setVars(loadVariables());
    setManagers(loadManagers());
    setStatLabels(loadLabels());
  }, []);

  useEsc(showPublish, () => setShowPublish(false));
  useEsc(showSettings, () => setShowSettings(false));
  useEsc(showVars, () => setShowVars(false));

  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const btnPortRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [portPos, setPortPos] = useState<Record<string, { x: number; y: number }>>({});
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // Автосохранение в localStorage.
  useEffect(() => {
    const t = setTimeout(() => {
      if (persist) {
        persist({ nodes, edges, published });
      } else {
        upsertScenario({ ...initial, nodes, edges, published, similarityThreshold: threshold, updatedAt: Date.now() });
      }
      setSavedTick((x) => x + 1);
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges, published, threshold]); // eslint-disable-line

  // Измерение высот нод и позиций портов-кнопок для точных стрелок.
  useLayoutEffect(() => {
    const h: Record<string, number> = {};
    for (const n of nodes) {
      const el = nodeRefs.current[n.id];
      if (el) h[n.id] = el.offsetHeight;
    }
    setHeights(h);

    const canvas = canvasRef.current;
    if (canvas) {
      const cr = canvas.getBoundingClientRect();
      const pos: Record<string, { x: number; y: number }> = {};
      for (const key of Object.keys(btnPortRefs.current)) {
        const el = btnPortRefs.current[key];
        if (el) {
          const r = el.getBoundingClientRect();
          pos[key] = { x: r.left + r.width / 2 - cr.left, y: r.top + r.height / 2 - cr.top };
        }
      }
      setPortPos(pos);
    }
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
  function onPortPointerDown(e: React.PointerEvent, id: string, branch?: "error", fromButton?: string) {
    e.stopPropagation();
    const p = canvasPoint(e.clientX, e.clientY);
    setPending({ from: id, x: p.x, y: p.y, branch, fromButton });
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
          if (es.some((x) => x.from === pd.from && x.to === to && x.branch === pd.branch && x.fromButton === pd.fromButton)) return es;
          return [...es, { id: uid("e"), from: pd.from, to, branch: pd.branch, fromButton: pd.fromButton }];
        });
      }
      return null;
    });
  }, [onPortMove]);

  // ---- Палитра: добавить блок ----
  function addNode(kind: NodeKind) {
    const meta = NODE_META[kind];
    // Новый блок ставим ниже всех существующих — без наложения.
    const baseY = nodes.length
      ? Math.max(...nodes.map((nn) => nn.y + (heights[nn.id] ?? 120))) + 40
      : 80;
    const n: FlowNode = {
      id: uid(),
      kind,
      x: 160,
      y: baseY,
      title: meta.label,
      match: kind === "event_message" || kind === "condition" ? "similar" : undefined,
      varName:
        kind === "action_process" || kind === "action_set_var"
          ? vars[0]?.name || ""
          : undefined,
      varValue: kind === "action_set_var" ? "" : undefined,
      text:
        kind === "action_manager"
          ? "Новая заявка с телефоном %Телефон%. Свяжись в течение 30 минут."
          : kind === "action_message"
          ? "Текст сообщения"
          : kind === "action_notify"
          ? "Новая заявка от пользователя"
          : kind === "event_message" || kind === "condition"
          ? ""
          : undefined,
      managers: kind === "action_manager" ? managers.filter((m) => m.admin).map((m) => m.id) : undefined,
      channelTarget: kind === "logic_subscribe" ? "botpilot_pro" : kind === "action_manager" ? "all" : undefined,
      forwardUser: kind === "action_manager" ? true : undefined,
      statLabel: kind === "action_stat" ? statLabels[0]?.name || "" : undefined,
      postId: kind === "event_comment" ? "" : undefined,
      variants:
        kind === "action_random"
          ? [
              { id: uid("v"), percent: 50 },
              { id: uid("v"), percent: 50 },
            ]
          : undefined,
    };
    if (kind === "event_comment") {
      n.text = "";
      n.match = "contains";
    }
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
  function addButton(nodeId: string) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, buttons: [...(n.buttons || []), { id: uid("btn"), label: "Вариант ответа" }] }
          : n
      )
    );
  }
  function patchButton(nodeId: string, btnId: string, patch: Partial<FlowButton>) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, buttons: (n.buttons || []).map((b) => (b.id === btnId ? { ...b, ...patch } : b)) }
          : n
      )
    );
  }
  function removeButton(nodeId: string, btnId: string) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, buttons: (n.buttons || []).filter((b) => b.id !== btnId) } : n
      )
    );
    setEdges((es) => es.filter((e) => !(e.from === nodeId && e.fromButton === btnId)));
  }
  function addVariant(nodeId: string) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, variants: [...(n.variants || []), { id: uid("v"), percent: 0 }] } : n
      )
    );
  }
  function patchVariant(nodeId: string, vId: string, percent: number) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, variants: (n.variants || []).map((v) => (v.id === vId ? { ...v, percent } : v)) }
          : n
      )
    );
  }
  function removeVariant(nodeId: string, vId: string) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, variants: (n.variants || []).filter((v) => v.id !== vId) } : n
      )
    );
    setEdges((es) => es.filter((e) => !(e.from === nodeId && e.fromButton === vId)));
  }
  function addAlt(nodeId: string) {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, alts: [...(n.alts || []), ""] } : n)));
  }
  function patchAlt(nodeId: string, i: number, val: string) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, alts: (n.alts || []).map((a, idx) => (idx === i ? val : a)) } : n
      )
    );
  }
  function removeAlt(nodeId: string, i: number) {
    setNodes((ns) =>
      ns.map((n) => (n.id === nodeId ? { ...n, alts: (n.alts || []).filter((_, idx) => idx !== i) } : n))
    );
  }
  function distributeEven(nodeId: string) {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== nodeId || !n.variants?.length) return n;
        const each = Math.round((100 / n.variants.length) * 10) / 10;
        return { ...n, variants: n.variants.map((v) => ({ ...v, percent: each })) };
      })
    );
  }
  function removeEdge(id: string) {
    setEdges((es) => es.filter((e) => e.id !== id));
  }

  function nodeH(id: string) {
    return heights[id] ?? 90;
  }

  // Авто-раскладка: уровни по связям (сверху вниз), внутри уровня — по горизонтали.
  function autoLayout() {
    if (nodes.length === 0) return;
    const level: Record<string, number> = {};
    nodes.forEach((n) => (level[n.id] = 0));
    // Длиннейший путь (для ацикличных); циклы ограничены числом итераций.
    for (let it = 0; it < nodes.length; it++) {
      let changed = false;
      for (const e of edges) {
        if (level[e.to] !== undefined && level[e.from] !== undefined) {
          if (level[e.to] < level[e.from] + 1) {
            level[e.to] = level[e.from] + 1;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    const byLevel: Record<number, FlowNode[]> = {};
    nodes.forEach((n) => {
      (byLevel[level[n.id]] ??= []).push(n);
    });
    const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
    const COL_GAP = 70, ROW_GAP = 80, START_X = 140;
    const pos: Record<string, { x: number; y: number }> = {};
    let y = 60;
    for (const lv of levels) {
      const arr = byLevel[lv].slice().sort((a, b) => a.x - b.x);
      let maxH = 0;
      // Центрируем ряд относительно общей ширины.
      const rowW = arr.length * NODE_W + (arr.length - 1) * COL_GAP;
      const offset = Math.max(0, (1000 - rowW) / 2);
      arr.forEach((n, i) => {
        pos[n.id] = { x: START_X + offset + i * (NODE_W + COL_GAP), y };
        maxH = Math.max(maxH, heights[n.id] ?? 120);
      });
      y += maxH + ROW_GAP;
    }
    setNodes((ns) => ns.map((n) => ({ ...n, ...pos[n.id] })));
  }

  // Bezier path между портом-выходом from и верхним центром to.
  // branch "error" — правый-нижний порт; fromButton — порт конкретной кнопки.
  function edgePath(from: FlowNode, to: FlowNode, branch?: "error", fromButton?: string) {
    let x1: number, y1: number;
    const bp = fromButton ? portPos[`${from.id}/${fromButton}`] : undefined;
    if (bp) {
      x1 = bp.x;
      y1 = bp.y;
    } else {
      x1 = branch === "error" ? from.x + NODE_W - 24 : from.x + NODE_W / 2;
      y1 = from.y + nodeH(from.id);
    }
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y;
    const dy = Math.max(40, Math.abs(y2 - y1) / 2);
    return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
  }

  const PALETTE: { kind: NodeKind; label: string }[] = [
    { kind: "event_start", label: "Старт" },
    { kind: "event_comment", label: "Комментарий" },
    { kind: "event_message", label: "Сообщение" },
    { kind: "action_message", label: "Ответ" },
    { kind: "action_process", label: "Обработать" },
    { kind: "action_set_var", label: "Переменная" },
    { kind: "action_notify", label: "Уведомление" },
    { kind: "action_manager", label: "Менеджеру" },
    { kind: "action_gsheet", label: "Google Табл." },
    { kind: "action_stat", label: "Статистика" },
    { kind: "action_random", label: "Рандом" },
    { kind: "logic_subscribe", label: "Подписка" },
    { kind: "action_ai", label: "BotPilot AI" },
    { kind: "condition", label: "Условие" },
  ];

  return (
    <div className="flow">
      {/* Тулбар */}
      <div className="flow__toolbar">
        <Link href={backHref} className="btn" style={{ padding: "6px 11px" }}>
          ←
        </Link>
        <div className="flow__palette">
          {PALETTE.map((p) => (
            <button key={p.kind} className="flow__pbtn" onClick={() => addNode(p.kind)} title={NODE_META[p.kind].label}>
              <span className="fp-ico" style={{ background: NODE_META[p.kind].color }}>{NODE_META[p.kind].icon}</span>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={autoLayout} style={{ padding: "6px 11px" }} title="Разложить блоки по уровням">
          ⤢ Упорядочить
        </button>
        <button className="btn" onClick={() => setShowSettings(true)} style={{ padding: "6px 11px" }}>
          ⚙ Настройки
        </button>
        <button className="btn" onClick={() => setShowVars(true)} style={{ padding: "6px 11px" }}>
          (x) Переменные
        </button>
        <span className="flow__saved">{savedTick > 0 ? "✓ Сохранено" : ""}</span>
        {headerActions ?? (
          <button
            className={`btn ${published ? "" : "btn-primary"}`}
            onClick={() => setShowPublish(true)}
          >
            {published ? "✓ Опубликован" : "Опубликовать"}
          </button>
        )}
      </div>

      {/* Канвас */}
      <div className="flow__scroll">
        <div className="flow__canvas" ref={canvasRef} onPointerDown={() => setSelected(null)}>
          <svg className="flow__edges">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#9aa0b2" />
              </marker>
              <marker id="arrow-err" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
              </marker>
            </defs>
            {edges.map((e) => {
              const from = nodes.find((n) => n.id === e.from);
              const to = nodes.find((n) => n.id === e.to);
              if (!from || !to) return null;
              return (
                <g key={e.id} className="flow__edge">
                  <path d={edgePath(from, to, e.branch, e.fromButton)} className="flow__edge-hit" onClick={() => removeEdge(e.id)} />
                  <path
                    d={edgePath(from, to, e.branch, e.fromButton)}
                    className={`flow__edge-line${e.branch === "error" ? " err" : ""}`}
                    markerEnd={e.branch === "error" ? "url(#arrow-err)" : "url(#arrow)"}
                  />
                </g>
              );
            })}
            {pending && (() => {
              const from = nodes.find((n) => n.id === pending.from)!;
              const bp = pending.fromButton ? portPos[`${from.id}/${pending.fromButton}`] : undefined;
              const x1 = bp ? bp.x : pending.branch === "error" ? from.x + NODE_W - 24 : from.x + NODE_W / 2;
              const y1 = bp ? bp.y : from.y + nodeH(from.id);
              return (
                <path
                  d={`M ${x1} ${y1} C ${x1} ${y1 + 50}, ${pending.x} ${pending.y - 50}, ${pending.x} ${pending.y}`}
                  className={`flow__edge-line pending${pending.branch === "error" ? " err" : ""}`}
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
                  {n.kind === "event_comment" && (
                    <>
                      <div className="fn__row">
                        <span className="fn__if">ЕСЛИ комментарий</span>
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
                        placeholder="текст комментария (необязательно)"
                        value={n.text || ""}
                        onChange={(e) => patchNode(n.id, { text: e.target.value })}
                      />
                      <div className="fn__sub">ID поста (необязательно)</div>
                      <input
                        className="fn__input"
                        placeholder="ссылка на пост или ID"
                        value={n.postId || ""}
                        onChange={(e) => patchNode(n.id, { postId: e.target.value })}
                      />
                    </>
                  )}
                  {n.kind === "action_random" && (
                    <>
                      <div className="fn__hint" style={{ marginBottom: 6 }}>
                        Случайно выбирает одну ветку по вероятностям.
                      </div>
                      {(n.variants || []).map((v, vi) => (
                        <div className="fn__btnrow" key={v.id}>
                          <span className="fn__varlabel">Вариант {vi + 1}</span>
                          <input
                            className="fn__input"
                            type="number"
                            min={0}
                            max={100}
                            value={v.percent}
                            onChange={(e) => patchVariant(n.id, v.id, Number(e.target.value))}
                            style={{ width: 64, flex: "none" }}
                          />
                          <span className="fn__pct">%</span>
                          <button className="fn__btn-del" onClick={() => removeVariant(n.id, v.id)}>✕</button>
                          <button
                            className="fn__port btn"
                            title="Связать вариант со следующим блоком"
                            ref={(el) => { btnPortRefs.current[`${n.id}/${v.id}`] = el; }}
                            onPointerDown={(e) => onPortPointerDown(e, n.id, undefined, v.id)}
                          />
                        </div>
                      ))}
                      <div className="fn__ops" style={{ marginTop: 8 }}>
                        <button className="fn__op" onClick={() => addVariant(n.id)}>+ Вариант</button>
                        <button className="fn__op" onClick={() => distributeEven(n.id)}>Поровну</button>
                      </div>
                    </>
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
                      {(n.alts || []).map((a, i) => (
                        <div className="fn__btnrow" key={i}>
                          <span className="fn__or">ИЛИ</span>
                          <input
                            className="fn__input"
                            placeholder="другая формулировка"
                            value={a}
                            onChange={(e) => patchAlt(n.id, i, e.target.value)}
                          />
                          <button className="fn__btn-del" onClick={() => removeAlt(n.id, i)}>✕</button>
                        </div>
                      ))}
                      <button className="fn__addbtn" onClick={() => addAlt(n.id)}>
                        + Условие «ИЛИ»
                      </button>
                    </>
                  )}
                  {n.kind === "action_message" && (
                    <>
                      <textarea
                        className="fn__textarea"
                        placeholder="Текст сообщения от бота"
                        value={n.text || ""}
                        onChange={(e) => patchNode(n.id, { text: e.target.value })}
                      />
                      <div className="fn__var-hint">
                        Подстановка: <code>%Переменная%</code>
                      </div>
                      <label className="fn__check">
                        <input
                          type="checkbox"
                          checked={!!n.requestContact}
                          onChange={(e) => patchNode(n.id, { requestContact: e.target.checked })}
                        />
                        Кнопка «Отправить номер» (запрос контакта)
                      </label>
                      {n.requestContact && (
                        <>
                          <div className="fn__contact-btn">📱 Отправить номер</div>
                          <div className="fn__sub">Сохранить телефон в переменную</div>
                          <VarSelect
                            vars={vars}
                            value={n.contactVar || ""}
                            onChange={(v) => patchNode(n.id, { contactVar: v })}
                            onCreate={() => setShowVars(true)}
                          />
                        </>
                      )}
                      <div className="fn__sub">Кнопки</div>
                      {(n.buttons || []).map((btn) => (
                        <div key={btn.id} className={btn.type === "payment" ? "fn__paybtn" : undefined}>
                          <div className="fn__btnrow">
                            <input
                              className="fn__input"
                              value={btn.label}
                              onChange={(e) => patchButton(n.id, btn.id, { label: e.target.value })}
                            />
                            <button className="fn__btn-del" onClick={() => removeButton(n.id, btn.id)} title="Удалить кнопку">✕</button>
                            <button
                              className="fn__port btn"
                              title="После нажатия / оплаты — следующий блок"
                              ref={(el) => { btnPortRefs.current[`${n.id}/${btn.id}`] = el; }}
                              onPointerDown={(e) => onPortPointerDown(e, n.id, undefined, btn.id)}
                            />
                          </div>
                          <select
                            className="fn__input"
                            style={{ marginTop: 4 }}
                            value={btn.type || "normal"}
                            onChange={(e) => patchButton(n.id, btn.id, { type: e.target.value as "normal" | "payment" })}
                          >
                            <option value="normal">Обычная кнопка</option>
                            <option value="payment">Создать платёж</option>
                          </select>
                          {btn.type === "payment" && (
                            <>
                              <select
                                className="fn__input"
                                style={{ marginTop: 4 }}
                                value={btn.provider || (PAYMENT_PROVIDERS[0]?.id || "")}
                                onChange={(e) => patchButton(n.id, btn.id, { provider: e.target.value })}
                              >
                                {PAYMENT_PROVIDERS.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                              <div className="fn__btnrow">
                                <input
                                  className="fn__input"
                                  placeholder="сумма (можно %Переменная%)"
                                  value={btn.amount || ""}
                                  onChange={(e) => patchButton(n.id, btn.id, { amount: e.target.value })}
                                />
                                <span className="fn__pct">₽</span>
                              </div>
                              <input
                                className="fn__input"
                                style={{ marginTop: 4 }}
                                placeholder="назначение платежа"
                                value={btn.purpose || ""}
                                onChange={(e) => patchButton(n.id, btn.id, { purpose: e.target.value })}
                              />
                            </>
                          )}
                        </div>
                      ))}
                      <button className="fn__addbtn" onClick={() => addButton(n.id)}>
                        + Добавить кнопку
                      </button>
                    </>
                  )}
                  {n.kind === "action_process" && (
                    <>
                      <label className="fn__check" style={{ marginTop: 0 }}>
                        <input
                          type="checkbox"
                          checked={n.waitAnswer !== false}
                          onChange={(e) => patchNode(n.id, { waitAnswer: e.target.checked })}
                        />
                        Ждать сообщение от пользователя
                      </label>
                      <div className="fn__sub">Записать в переменную</div>
                      <VarSelect
                        vars={vars}
                        value={n.varName || ""}
                        onChange={(v) => patchNode(n.id, { varName: v })}
                        onCreate={() => setShowVars(true)}
                      />
                      <label className="fn__check">
                        <input
                          type="checkbox"
                          checked={!!n.useTemplate}
                          onChange={(e) => patchNode(n.id, { useTemplate: e.target.checked })}
                        />
                        Проверить формат сообщения
                      </label>
                      {n.useTemplate && (
                        <>
                          <div className="fn__row" style={{ marginTop: 6, marginBottom: 6 }}>
                            <span className="fn__if">Фильтр</span>
                            <select
                              className="fn__select"
                              value={n.format || "any"}
                              onChange={(e) => patchNode(n.id, { format: e.target.value as DataFormat })}
                            >
                              {(Object.keys(FORMAT_LABELS) as DataFormat[]).map((f) => (
                                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                              ))}
                            </select>
                          </div>
                          <input
                            className="fn__input"
                            placeholder="шаблон, напр. Мой телефон «телефон»"
                            value={n.template || ""}
                            onChange={(e) => patchNode(n.id, { template: e.target.value })}
                          />
                          <div className="fn__err-label">! выход при ошибке →</div>
                        </>
                      )}
                    </>
                  )}
                  {n.kind === "action_set_var" && (
                    <>
                      <VarSelect
                        vars={vars}
                        value={n.varName || ""}
                        onChange={(v) => patchNode(n.id, { varName: v })}
                        onCreate={() => setShowVars(true)}
                      />
                      <input
                        className="fn__input"
                        style={{ marginTop: 6 }}
                        placeholder="значение или {{ %Переменная% + 1 }}"
                        value={n.varValue || ""}
                        onChange={(e) => patchNode(n.id, { varValue: e.target.value })}
                      />
                      <div className="fn__var-hint">
                        Арифметика: <code>{"{{ %Баллы% + 1 }}"}</code>
                      </div>
                      <div className="fn__ops">
                        <button
                          className="fn__op"
                          onClick={() => patchNode(n.id, { varValue: `{{ %${n.varName || "Переменная"}% + 1 }}` })}
                        >
                          + Операции с числами
                        </button>
                        <button
                          className="fn__op"
                          onClick={() => patchNode(n.id, { varValue: "{{ now + 1d }}" })}
                        >
                          + Операции с датами
                        </button>
                      </div>
                    </>
                  )}
                  {n.kind === "action_notify" && (
                    <textarea
                      className="fn__textarea"
                      placeholder="Текст уведомления менеджеру"
                      value={n.text || ""}
                      onChange={(e) => patchNode(n.id, { text: e.target.value })}
                    />
                  )}
                  {n.kind === "action_manager" && (
                    <>
                      <textarea
                        className="fn__textarea"
                        placeholder="Сообщение менеджеру (можно %Переменная%)"
                        value={n.text || ""}
                        onChange={(e) => patchNode(n.id, { text: e.target.value })}
                      />
                      <div className="fn__var-hint">Подстановка: <code>%Телефон%</code></div>
                      <label className="fn__check">
                        <input
                          type="checkbox"
                          checked={!!n.forwardUser}
                          onChange={(e) => patchNode(n.id, { forwardUser: e.target.checked })}
                        />
                        Переслать сообщение пользователя
                      </label>
                      <div className="fn__sub">Менеджеры</div>
                      <div className="fn__mgrs">
                        {managers.map((m) => {
                          const on = (n.managers || []).includes(m.id);
                          return (
                            <label key={m.id} className={`fn__mgr${on ? " on" : ""}`}>
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={(e) => {
                                  const cur = new Set(n.managers || []);
                                  if (e.target.checked) cur.add(m.id);
                                  else cur.delete(m.id);
                                  patchNode(n.id, { managers: Array.from(cur) });
                                }}
                              />
                              {m.name}
                            </label>
                          );
                        })}
                      </div>
                      <div className="fn__sub">Канал</div>
                      <select
                        className="fn__input"
                        value={n.channelTarget || "all"}
                        onChange={(e) => patchNode(n.id, { channelTarget: e.target.value })}
                      >
                        {NOTIFY_CHANNELS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.bot ? ` · ${c.bot}` : ""}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  {n.kind === "action_gsheet" && (
                    <>
                      <div className="fn__hint" style={{ marginBottom: 8 }}>
                        Заносит данные пользователя строкой в Google Таблицу.
                      </div>
                      <input
                        className="fn__input"
                        placeholder="Ссылка на Google Таблицу"
                        value={n.sheetUrl || ""}
                        onChange={(e) => patchNode(n.id, { sheetUrl: e.target.value })}
                      />
                      <div className="fn__err-label">! выход при ошибке →</div>
                    </>
                  )}
                  {n.kind === "action_stat" && (
                    <>
                      <div className="fn__hint" style={{ marginBottom: 8 }}>
                        Отмечает пользователя меткой в статистике.
                      </div>
                      <select
                        className="fn__input"
                        value={n.statLabel || ""}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            const name = prompt("Название метки");
                            if (name && name.trim()) {
                              const list = addLabel(name.trim());
                              setStatLabels(list);
                              patchNode(n.id, { statLabel: name.trim() });
                            }
                          } else patchNode(n.id, { statLabel: e.target.value });
                        }}
                      >
                        {n.statLabel && !statLabels.some((l) => l.name === n.statLabel) && (
                          <option value={n.statLabel}>{n.statLabel}</option>
                        )}
                        {statLabels.map((l) => (
                          <option key={l.id} value={l.name}>{l.name}</option>
                        ))}
                        <option value="__new__">+ Создать метку…</option>
                      </select>
                    </>
                  )}
                  {n.kind === "logic_subscribe" && (
                    <>
                      <div className="fn__hint" style={{ marginBottom: 8 }}>
                        Проверяет подписку на канал/сообщество.
                      </div>
                      <div className="fn__sub">Канал</div>
                      <select
                        className="fn__input"
                        value={n.channelTarget || ""}
                        onChange={(e) => patchNode(n.id, { channelTarget: e.target.value })}
                      >
                        {NOTIFY_CHANNELS.filter((c) => c.id !== "all").map((c) => (
                          <option key={c.id} value={c.id}>{c.name}{c.bot ? ` · ${c.bot}` : ""}</option>
                        ))}
                      </select>
                      <div className="fn__branch-row">
                        <span className="fn__branch ok">✓ подписан ↓</span>
                        <span className="fn__branch no">✗ не подписан →</span>
                      </div>
                    </>
                  )}
                  {n.kind === "action_ai" && (
                    <div className="fn__hint">Передаёт диалог AI-боту: отвечает по базе знаний.</div>
                  )}
                </div>
                {/* Порт-выход (низ по центру) — кроме «Рандома» (ветвление через варианты) */}
                {n.kind !== "action_random" && (
                  <button
                    className="fn__port"
                    title="Потяните, чтобы связать со следующим блоком"
                    onPointerDown={(e) => onPortPointerDown(e, n.id)}
                  />
                )}
                {/* Порт-ошибка / второй выход (проверка данных, интеграция, подписка) */}
                {((n.kind === "action_process" && n.useTemplate) ||
                  n.kind === "action_gsheet" ||
                  n.kind === "logic_subscribe") && (
                  <button
                    className={`fn__port err${n.kind === "logic_subscribe" ? " sub" : ""}`}
                    title={n.kind === "logic_subscribe" ? "Если не подписан" : "Выход при ошибке"}
                    onPointerDown={(e) => onPortPointerDown(e, n.id, "error")}
                  >
                    {n.kind === "logic_subscribe" ? "✗" : "!"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showVars && (
        <VariablesModal
          vars={vars}
          onClose={() => setShowVars(false)}
          onCreated={(v) => setVars(addVariable(v))}
        />
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <b>Настройки сценария</b>
              <button className="fn__x dark" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label className="label">Порог совпадения для режима «Похоже на»</label>
              <div className="row">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 800, width: 44, textAlign: "right" }}>{threshold.toFixed(2)}</span>
              </div>
              <div className="hint">
                Насколько сообщение должно быть похоже на заданную фразу, чтобы
                сработало условие. Рекомендуем 0.4 — бот распознаёт смысл, опечатки и
                синонимы.
              </div>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button className="btn" onClick={() => setThreshold(0.4)}>Сбросить (0.4)</button>
              <button className="btn btn-primary" onClick={() => setShowSettings(false)}>Готово</button>
            </div>
          </div>
        </div>
      )}

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

// --- Выбор переменной внутри ноды ---
function VarSelect({
  vars,
  value,
  onChange,
  onCreate,
}: {
  vars: Variable[];
  value: string;
  onChange: (v: string) => void;
  onCreate: () => void;
}) {
  const missing = value && !vars.some((v) => v.name === value);
  return (
    <select
      className="fn__input"
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new__") onCreate();
        else onChange(e.target.value);
      }}
    >
      {vars.length === 0 && !value && <option value="">нет переменных</option>}
      {missing && <option value={value}>{value}</option>}
      {vars.map((v) => (
        <option key={v.id} value={v.name}>
          {v.name} · {VAR_SCOPE_LABELS[v.scope]}
        </option>
      ))}
      <option value="__new__">+ Создать переменную…</option>
    </select>
  );
}

// --- Модалка «Создание переменной» ---
function VariablesModal({
  vars,
  onClose,
  onCreated,
}: {
  vars: Variable[];
  onClose: () => void;
  onCreated: (v: Variable) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<VarType>("string");
  const [scope, setScope] = useState<VarScope>("user");
  const [initial, setInitial] = useState("");

  function submit() {
    if (!name.trim()) return;
    onCreated({ id: vid(), name: name.trim(), type, scope, initial });
    setName("");
    setInitial("");
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <b>Переменные</b>
          <button className="fn__x dark" onClick={onClose}>✕</button>
        </div>

        {vars.length > 0 && (
          <div className="var-list">
            {vars.map((v) => (
              <div className="var-row" key={v.id}>
                <span className="var-name">%{v.name}%</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {VAR_TYPE_LABELS[v.type]} · {VAR_SCOPE_LABELS[v.scope]}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="var-create-title">Создание переменной</div>
        <div className="field">
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
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn" onClick={onClose}>Закрыть</button>
          <button className="btn btn-primary" onClick={submit}>Создать</button>
        </div>
      </div>
    </div>
  );
}
