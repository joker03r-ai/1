"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "@/components/Topbar";
import { StatLabel, loadLabels, generateSeries, Point } from "@/lib/stats";
import { loadUsers } from "@/lib/users";
import { loadScenarios } from "@/lib/scenarios";
import { loadChats } from "@/lib/tgchats";

const CHANNEL_COLORS: Record<string, string> = {
  Telegram: "#229ED9",
  ВКонтакте: "#0077FF",
  WhatsApp: "#25D366",
  Сайт: "#8b5cf6",
};

export default function StatsClient() {
  const [labels, setLabels] = useState<StatLabel[]>([]);
  const [series, setSeries] = useState<Point[]>([]);
  const [event, setEvent] = useState("all");
  const [channel, setChannel] = useState("Все каналы");
  const [days, setDays] = useState(30);
  const [users, setUsers] = useState<ReturnType<typeof loadUsers>>([]);
  const [scenCount, setScenCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  useEffect(() => {
    setLabels(loadLabels());
    setUsers(loadUsers());
    setScenCount(loadScenarios().length);
    setMsgCount(loadChats().reduce((s, c) => s + c.messages.length, 0));
  }, []);
  useEffect(() => {
    setSeries(generateSeries(days));
  }, [days]);

  const total = useMemo(() => series.reduce((s, p) => s + p.value, 0), [series]);
  const newInPeriod = useMemo(
    () => series.slice(-7).reduce((s, p) => s + p.value, 0),
    [series]
  );
  const prevWeek = useMemo(
    () => series.slice(-14, -7).reduce((s, p) => s + p.value, 0),
    [series]
  );
  const weekDelta = prevWeek > 0 ? Math.round(((newInPeriod - prevWeek) / prevWeek) * 100) : 0;
  const maxLabel = Math.max(1, ...labels.map((l) => l.count));

  // Разбивка пользователей по каналам.
  const channels = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach((u) => (map[u.channel] = (map[u.channel] || 0) + 1));
    const totalU = users.length || 1;
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / totalU) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [users]);

  // Воронка из меток статистики.
  const funnel = useMemo(() => {
    const byId: Record<string, number> = {};
    labels.forEach((l) => (byId[l.id] = l.count));
    const steps = [
      { id: "sl_dialog", name: "Начали диалог" },
      { id: "sl_phone", name: "Оставили телефон" },
      { id: "sl_quiz", name: "Прошли тест" },
      { id: "sl_lead", name: "Оставили заявку" },
    ].filter((s) => byId[s.id] !== undefined);
    const base = steps.length ? byId[steps[0].id] || 1 : 1;
    return steps.map((s) => ({ name: s.name, count: byId[s.id] || 0, pct: Math.round(((byId[s.id] || 0) / base) * 100) }));
  }, [labels]);

  const leadLabel = labels.find((l) => l.id === "sl_lead");
  const dialogLabel = labels.find((l) => l.id === "sl_dialog");
  const conv = leadLabel && dialogLabel && dialogLabel.count
    ? ((leadLabel.count / dialogLabel.count) * 100).toFixed(1).replace(".", ",")
    : "16,5";

  return (
    <>
      <Topbar crumbs={["Основной проект", "Статистика"]} />
      <div className="content">
        <h1 className="h1" style={{ marginBottom: 2 }}>Статистика</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Следите, как растёт кабинет: активность пользователей по времени и по каналам.
        </p>

        {/* Фильтры */}
        <div className="stat-filters">
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Событие / метка</label>
            <select className="select" value={event} onChange={(e) => setEvent(e.target.value)}>
              <option value="all">Все пользователи</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Период</label>
            <select className="select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 дней</option>
              <option value={14}>14 дней</option>
              <option value={30}>30 дней</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Канал</label>
            <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {["Все каналы", "Telegram", "ВКонтакте", "WhatsApp", "Сайт"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Стат-тайлы */}
        <div className="stat-tiles">
          <StatTile label="Сообщений за период" value={total.toLocaleString("ru-RU")} sub="по всем каналам" />
          <StatTile
            label="Активность за 7 дней"
            value={newInPeriod.toLocaleString("ru-RU")}
            sub="сообщений"
            delta={weekDelta}
            accent
          />
          <StatTile label="Пользователей" value={(1240 + users.length).toLocaleString("ru-RU")} sub={`${users.length} в базе кабинета`} />
          <StatTile label="Конверсия в заявку" value={`${conv}%`} sub="из диалога в заявку" />
        </div>

        {/* Воронка + каналы */}
        <div className="stat-two">
          <div className="card" style={{ padding: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <b>Воронка</b>
              <span className="muted" style={{ fontSize: 12 }}>от диалога к заявке</span>
            </div>
            {funnel.length ? funnel.map((f, i) => (
              <div className="funnel-row" key={f.name}>
                <div className="funnel-top">
                  <span className="funnel-name">{f.name}</span>
                  <span className="funnel-val">{f.count.toLocaleString("ru-RU")} <span className="funnel-pct">· {f.pct}%</span></span>
                </div>
                <div className="funnel-track">
                  <div className="funnel-fill" style={{ width: `${Math.max(4, f.pct)}%`, opacity: 1 - i * 0.16 }} />
                </div>
              </div>
            )) : <div className="muted">Добавьте блок «Записать в статистику», чтобы видеть воронку.</div>}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <b>По каналам</b>
              <span className="muted" style={{ fontSize: 12 }}>{users.length} пользователей</span>
            </div>
            {channels.length ? channels.map((c) => (
              <div className="chan-row" key={c.name}>
                <span className="chan-dot" style={{ background: CHANNEL_COLORS[c.name] || "#9aa0b2" }} />
                <span className="chan-name">{c.name}</span>
                <div className="chan-track">
                  <div className="chan-fill" style={{ width: `${c.pct}%`, background: CHANNEL_COLORS[c.name] || "#9aa0b2" }} />
                </div>
                <span className="chan-val">{c.pct}%</span>
              </div>
            )) : <div className="muted">Нет данных по каналам.</div>}
          </div>
        </div>

        {/* График */}
        <div className="card" style={{ padding: 20, marginTop: 18 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <b>Активность пользователей</b>
            <span className="muted" style={{ fontSize: 12 }}>сообщений в день</span>
          </div>
          <LineChart data={series} />
        </div>

        {/* Разбивка по меткам */}
        <div className="section-title">По меткам</div>
        <div className="card" style={{ padding: 20 }}>
          {labels.map((l) => (
            <div className="stat-bar-row" key={l.id}>
              <div className="stat-bar-name">{l.name}</div>
              <div className="stat-bar-track">
                <div className="stat-bar-fill" style={{ width: `${(l.count / maxLabel) * 100}%` }} />
              </div>
              <div className="stat-bar-val">{l.count.toLocaleString("ru-RU")}</div>
            </div>
          ))}
          {labels.length === 0 && <div className="muted">Метки появятся после блока «Записать в статистику».</div>}
        </div>
      </div>
    </>
  );
}

function StatTile({ label, value, sub, accent, delta }: { label: string; value: string; sub: string; accent?: boolean; delta?: number }) {
  return (
    <div className={`stat-tile${accent ? " accent" : ""}`}>
      <div className="stat-tile__label">{label}</div>
      <div className="stat-tile__value">{value}</div>
      <div className="stat-tile__sub">
        {typeof delta === "number" && delta !== 0 && (
          <span className={`stat-delta ${delta > 0 ? "up" : "down"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: Point[] }) {
  const W = 920, H = 300;
  const padL = 40, padR = 14, padT = 16, padB = 28;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return <div style={{ height: H }} />;

  const max = Math.max(...data.map((d) => d.value));
  const niceMax = Math.ceil(max / 20) * 20;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number) => padL + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / niceMax) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(data.length - 1).toFixed(1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  const xTicks = data.map((_, i) => i).filter((i) => i % Math.ceil(data.length / 6) === 0);

  function onMove(e: React.MouseEvent) {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      role="img"
      aria-label="График активности пользователей по дням"
    >
      <defs>
        <linearGradient id="statFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Сетка + подписи Y */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#eef0f7" strokeWidth={1} />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#9aa0b2">{v}</text>
        </g>
      ))}

      {/* Подписи X */}
      {xTicks.map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#9aa0b2">{data[i].date}</text>
      ))}

      <path d={area} fill="url(#statFill)" />
      <path d={line} fill="none" stroke="#6c5ce7" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* Hover */}
      {hover !== null && (
        <g>
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH} stroke="#c9c3f5" strokeWidth={1} strokeDasharray="4 3" />
          <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill="#6c5ce7" stroke="#fff" strokeWidth={2} />
          <g transform={`translate(${Math.min(x(hover) + 10, W - 120)}, ${Math.max(y(data[hover].value) - 44, padT)})`}>
            <rect width={110} height={38} rx={8} fill="#171826" />
            <text x={10} y={16} fontSize="11" fill="#c9ccd6">{data[hover].date}</text>
            <text x={10} y={30} fontSize="13" fontWeight="700" fill="#fff">{data[hover].value} сообщ.</text>
          </g>
        </g>
      )}
    </svg>
  );
}
