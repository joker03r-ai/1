"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import {
  IconSpark, IconCalendar, IconDoc, IconLayers, IconPlus, IconChevron,
  IconChat, IconUserParse, IconSend, IconGlobe,
} from "@/components/icons";
import { Draft, loadDrafts, addDraft, removeDraft } from "@/lib/content";
import { ScheduledPost, PostStatus, STATUS_META, loadPosts, upsertPost, removePost, pid } from "@/lib/schedule";
import { Bot, loadBots, currentBot } from "@/lib/bots";
import { cityById, utcLabel } from "@/lib/tz";

/* ================= утилиты ================= */
const TZ_CHOICES = ["moscow", "spb", "kaliningrad", "samara", "ekb", "omsk", "nsk", "krasnoyarsk", "irkutsk", "ulanude", "yakutsk", "vladivostok", "magadan", "kamchatka", "minsk", "almaty", "tbilisi", "istanbul", "dubai", "london", "newyork"];
const FORMATS = ["Текст", "Текст + фото", "Изображение", "Видео", "Опрос", "Карусель"];
const TONES = ["Дружелюбный", "Экспертный", "Продающий", "Неформальный", "Вдохновляющий"];
const KINDS: { id: string; label: string }[] = [
  { id: "useful", label: "Полезный" }, { id: "sell", label: "Продающий" },
  { id: "engage", label: "Вовлекающий" }, { id: "fun", label: "Развлекательный" },
];
const RU_MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const RU_DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Закрытие оверлеев по Escape.
function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function todayYmd() { return ymd(new Date()); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { const x = new Date(d); const w = (x.getDay() + 6) % 7; return addDays(x, -w); }
function parseYmd(s: string) { return new Date(s + "T00:00:00"); }
function humanDate(s: string) { const d = parseYmd(s); return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`; }
function sameMonth(a: Date, b: Date) { return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear(); }

function tzOf(cityId: string) { return cityById(cityId)?.tz || "Europe/Moscow"; }
function timeLabel(time: string, cityId: string) {
  const c = cityById(cityId); return `${time} · ${c?.name || "Москва"}, ${utcLabel(tzOf(cityId))}`;
}

function genImage(topic: string, i: number): string {
  const pairs = [["#7c5cff", "#b892ff"], ["#2b6ef6", "#5aa2ff"], ["#16a34a", "#4ade80"], ["#f59e0b", "#fbbf24"], ["#ec4899", "#f9a8d4"]];
  const [a, b] = pairs[i % pairs.length];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 24);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='640' height='400' fill='url(#g)'/><circle cx='545' cy='80' r='120' fill='rgba(255,255,255,.13)'/><circle cx='90' cy='360' r='80' fill='rgba(255,255,255,.08)'/><text x='44' y='210' font-family='Arial' font-size='38' font-weight='700' fill='#fff'>${esc(topic)}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* Локальный генератор контента (работает без внешней сети; пользователь всё правит). */
function genTitle(topic: string, kind: string, v = 0) {
  const t = topic || "вашей теме";
  const banks: Record<string, string[]> = {
    useful: [`5 шагов по теме «${t}»`, `Как разобраться в «${t}»`, `«${t}»: короткий гайд`],
    sell: [`«${t}» — успейте до конца недели`, `Специальное предложение: ${t}`, `${t} со скидкой сегодня`],
    engage: [`А как вы решаете «${t}»?`, `${t}: угадаете правильный ответ?`, `Расскажите про ваш опыт с «${t}»`],
    fun: [`${t} — с юмором 😄`, `Пятничный пост про «${t}»`, `Немного лёгкого про ${t}`],
  };
  const arr = banks[kind] || banks.useful; return arr[v % arr.length];
}
function genBody(topic: string, kind: string, tone: string, v = 0) {
  const t = topic || "вашей теме";
  const intro: Record<string, string[]> = {
    useful: [`Разбираем «${t}» по шагам.`, `Собрали главное про «${t}».`, `Коротко о «${t}» — без воды.`],
    sell: [`Отличный повод попробовать «${t}».`, `Мы подготовили выгодное предложение по «${t}».`, `Самое время оформить «${t}».`],
    engage: [`Хотим узнать ваше мнение о «${t}».`, `Давайте обсудим «${t}».`, `Интересная ситуация вокруг «${t}».`],
    fun: [`Немного лёгкого настроения про «${t}».`, `Пятничная история про «${t}».`, `Улыбнитесь — сегодня про «${t}».`],
  };
  const body = [
    "• Что важно знать в первую очередь",
    "• Как это применить у себя",
    "• Частая ошибка и как её избежать",
  ];
  const toneNote = tone ? `\n\nТон: ${tone.toLowerCase()}.` : "";
  return `${(intro[kind] || intro.useful)[v % 3]}\n\n${body.join("\n")}${toneNote}`.replace(/Тон:.*$/, "").trim();
}
function genCTA(kind: string) {
  return kind === "sell" ? "Оформить заявку" : kind === "engage" ? "Ответить в комментариях" : "Узнать подробнее";
}

function channelsFrom(bots: Bot[]) {
  const list = bots.map((b) => ({ id: b.id, name: b.name, channel: b.tgUsername ? "@" + b.tgUsername : "", connected: !!b.tgConnected, rights: b.tgTokenValid !== false, bot: b }));
  return list;
}

/* ================= главный компонент ================= */
type Tab = "calendar" | "drafts" | "plan";
type CalMode = "month" | "week" | "day" | "list";

export default function ContentClient() {
  const [tab, setTab] = useState<Tab>("calendar");
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [cityId, setCityId] = useState("moscow");
  const [calMode, setCalMode] = useState<CalMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [statusF, setStatusF] = useState<PostStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("all");
  const [fBy, setFBy] = useState<"all" | "manual" | "ai">("all");
  const [side, setSide] = useState<ScheduledPost | null>(null);
  const [wizard, setWizard] = useState<null | { source?: string }>(null);
  const [series, setSeries] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setPosts(loadPosts()); setDrafts(loadDrafts());
    const bs = loadBots(); setBots(bs);
    const b = currentBot(bs) || bs[0]; if (b) setBotId(b.id);
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q === "drafts" || q === "plan" || q === "calendar") setTab(q as Tab);
  }, []);

  const refresh = () => { setPosts(loadPosts()); setDrafts(loadDrafts()); };
  const chans = channelsFrom(bots);
  const sel = chans.find((c) => c.id === botId);
  const channel = sel?.channel || (sel?.name ? sel.name : "@my_channel");

  function save(p: ScheduledPost) { upsertPost(p); refresh(); }
  function del(id: string) { removePost(id); refresh(); setSide(null); }

  // Фильтрация постов
  const filtered = useMemo(() => {
    let l = posts;
    if (statusF !== "all") l = l.filter((p) => p.status === statusF);
    if (fType !== "all") l = l.filter((p) => p.type === fType);
    if (fBy !== "all") l = l.filter((p) => (p.createdBy || "manual") === fBy);
    if (search.trim()) { const s = search.toLowerCase(); l = l.filter((p) => (p.title || p.text || "").toLowerCase().includes(s) || (p.channel || "").toLowerCase().includes(s)); }
    return l;
  }, [posts, statusF, fType, fBy, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    (["planned", "published", "review", "error", "draft"] as PostStatus[]).forEach((s) => { c[s] = posts.filter((p) => p.status === s).length; });
    return c;
  }, [posts]);

  const todayPosts = posts.filter((p) => p.date === todayYmd());

  function openCreate(kind: "ai" | "manual" | "parsing" | "series") {
    setMenu(false);
    if (kind === "ai") setWizard({});
    else if (kind === "parsing") setWizard({ source: "Материалы парсинга" });
    else if (kind === "series") setSeries(true);
    else {
      // вручную — новый пустой пост в боковой панели на сегодня
      setSide({ id: pid(), text: "", title: "", channel, date: todayYmd(), time: "12:00", cityId, regionMode: "sim", repeat: "Один раз", type: "Текст", status: "draft", createdBy: "manual", author: "Вы" });
    }
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Контент и календарь"]} />
      <div className="content cc" style={{ maxWidth: 1440 }}>
        {/* Верхняя панель */}
        <div className="cc-bar">
          <div className="cc-bar__title">
            <h1 className="h1" style={{ margin: 0 }}>Контент и календарь</h1>
            <p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>Создавайте посты вручную или с помощью ИИ, планируйте публикации и отслеживайте результаты.</p>
          </div>
          <div className="cc-bar__ctrl">
            <label className="cc-pick"><IconChat className="ico" />
              <select value={botId} onChange={(e) => setBotId(e.target.value)}>
                {chans.length === 0 && <option>Нет ботов</option>}
                {chans.map((c) => <option key={c.id} value={c.id}>{c.name}{c.channel ? " · " + c.channel : ""}</option>)}
              </select>
            </label>
            <label className="cc-pick"><IconGlobe className="ico" />
              <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
                {TZ_CHOICES.map((id) => { const c = cityById(id); return <option key={id} value={id}>{c?.name} · {utcLabel(c!.tz)}</option>; })}
              </select>
            </label>
            <div className="cc-create">
              <button className="btn btn-primary" onClick={() => setMenu((v) => !v)} type="button"><IconPlus className="ico" /> Создать публикацию <IconChevron className="ico cc-create__chev" /></button>
              {menu && (
                <>
                  <div className="cc-menu__ov" onClick={() => setMenu(false)} />
                  <div className="cc-menu">
                    <button onClick={() => openCreate("ai")} type="button"><IconSpark className="ico" /> <span><b>Создать с ИИ</b><em>ИИ подготовит текст и изображение</em></span></button>
                    <button onClick={() => openCreate("manual")} type="button"><IconDoc className="ico" /> <span><b>Создать вручную</b><em>Пустой редактор поста</em></span></button>
                    <button onClick={() => openCreate("parsing")} type="button"><IconUserParse className="ico" /> <span><b>Из материалов парсинга</b><em>Собранный контент в пост</em></span></button>
                    <button onClick={() => openCreate("series")} type="button"><IconLayers className="ico" /> <span><b>Создать серию постов</b><em>Несколько публикаций сразу</em></span></button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Разделы */}
        <div className="cc-tabs">
          <button className={`cc-tab${tab === "calendar" ? " on" : ""}`} onClick={() => setTab("calendar")} type="button"><IconCalendar className="ico" /> Календарь</button>
          <button className={`cc-tab${tab === "drafts" ? " on" : ""}`} onClick={() => setTab("drafts")} type="button"><IconDoc className="ico" /> Черновики{drafts.length > 0 && <em className="cc-tab__b">{drafts.length}</em>}</button>
          <button className={`cc-tab${tab === "plan" ? " on" : ""}`} onClick={() => setTab("plan")} type="button"><IconLayers className="ico" /> Контент-план</button>
        </div>

        {tab === "calendar" && (
          <>
            <FiltersBar
              counts={counts} statusF={statusF} setStatusF={setStatusF}
              search={search} setSearch={setSearch}
              fType={fType} setFType={setFType} fBy={fBy} setFBy={setFBy}
              calMode={calMode} setCalMode={setCalMode}
              cursor={cursor} setCursor={setCursor}
            />
            {posts.length === 0 ? (
              <EmptyState onAi={() => openCreate("ai")} onManual={() => openCreate("manual")} />
            ) : (
              <CalendarView mode={calMode} cursor={cursor} posts={filtered} cityId={cityId} onOpen={setSide} onMove={save} />
            )}
          </>
        )}

        {tab === "drafts" && (
          <DraftsView drafts={drafts} onRefresh={refresh} onEdit={(d: Draft) => {
            // Сразу сохраняем пост в календаре (иначе при закрытии панели без
            // правок черновик уже удалён, а пост не создан — потеря данных).
            const np: ScheduledPost = { id: pid(), text: d.text, title: d.text.slice(0, 40), channel, date: todayYmd(), time: "12:00", cityId, regionMode: "sim", repeat: "Один раз", type: d.type, status: "draft", createdBy: d.source === "ИИ" ? "ai" : "manual", author: "Вы", image: d.image };
            upsertPost(np); removeDraft(d.id); refresh();
            setSide(np); setTab("calendar");
          }} onAi={() => openCreate("ai")} onManual={() => openCreate("manual")} />
        )}

        {tab === "plan" && (
          <PlanBuilder channel={channel} cityId={cityId} posts={posts} onApply={refresh} />
        )}
      </div>

      {side && <SidePanel post={side} bot={sel?.bot} chans={chans} onClose={() => setSide(null)} onSave={save} onDelete={del} overLimit={posts.filter((p) => p.status === "planned").length >= 100} />}
      {wizard && <AiWizard initSource={wizard.source} channel={channel} cityId={cityId} onClose={() => setWizard(null)} onDone={() => { setWizard(null); refresh(); }} />}
      {series && <SeriesModal channel={channel} cityId={cityId} onClose={() => setSeries(false)} onDone={() => { setSeries(false); refresh(); }} />}
    </>
  );
}

/* ================= фильтры + переключатель режимов ================= */
function FiltersBar(props: any) {
  const { counts, statusF, setStatusF, search, setSearch, fType, setFType, fBy, setFBy, calMode, setCalMode, cursor, setCursor } = props;
  const chips: { id: PostStatus | "all"; label: string; cls?: string }[] = [
    { id: "all", label: "Все" },
    { id: "planned", label: "Запланировано", cls: "s-planned" },
    { id: "published", label: "Опубликовано", cls: "s-published" },
    { id: "review", label: "На согласовании", cls: "s-review" },
    { id: "error", label: "Ошибка", cls: "s-error" },
    { id: "draft", label: "Черновик", cls: "s-draft" },
  ];
  const title = calMode === "month" ? `${RU_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : calMode === "week" ? `Неделя с ${humanDate(ymd(startOfWeek(cursor)))}`
    : calMode === "day" ? humanDate(ymd(cursor))
    : "Список публикаций";
  const step = (n: number) => setCursor(calMode === "month" ? new Date(cursor.getFullYear(), cursor.getMonth() + n, 1) : addDays(cursor, calMode === "week" ? n * 7 : n));
  return (
    <div className="cc-filters">
      <div className="cc-chips">
        {chips.map((c) => (
          <button key={c.id} className={`cc-chip${statusF === c.id ? " on" : ""}`} onClick={() => setStatusF(c.id)} type="button">
            {c.cls && <span className={`cc-dot ${c.cls}`} />}{c.label} <em>{counts[c.id] ?? 0}</em>
          </button>
        ))}
      </div>
      <div className="cc-ftools">
        <div className="cc-nav">
          <button onClick={() => step(-1)} type="button" aria-label="Назад">‹</button>
          <span className="cc-nav__t">{title}</span>
          <button onClick={() => step(1)} type="button" aria-label="Вперёд">›</button>
          <button className="cc-today" onClick={() => setCursor(new Date())} type="button">Сегодня</button>
        </div>
        <div className="cc-modes">
          {(["month", "week", "day", "list"] as CalMode[]).map((m) => (
            <button key={m} className={`cc-mode${calMode === m ? " on" : ""}`} onClick={() => setCalMode(m)} type="button">{m === "month" ? "Месяц" : m === "week" ? "Неделя" : m === "day" ? "День" : "Список"}</button>
          ))}
        </div>
        <input className="input cc-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по тексту / каналу…" />
        <select className="input cc-selmini" value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="all">Все типы</option>
          {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="input cc-selmini" value={fBy} onChange={(e) => setFBy(e.target.value)}>
          <option value="all">Способ: любой</option>
          <option value="manual">Вручную</option>
          <option value="ai">С ИИ</option>
        </select>
      </div>
    </div>
  );
}

/* ================= календарь ================= */
function PostChip({ p, cityId, onOpen, onDragStart }: any) {
  const meta = STATUS_META[p.status as PostStatus];
  return (
    <div className={`cc-ev ${meta.cls}`} draggable onDragStart={onDragStart} onClick={(e) => { e.stopPropagation(); onOpen(p); }} title={p.text}>
      {p.image && <span className="cc-ev__img" style={{ backgroundImage: `url("${p.image}")` }} />}
      <span className="cc-ev__time">{p.time}</span>
      <span className="cc-ev__txt">{(p.title || p.text || "Без текста").slice(0, 40)}</span>
      {p.createdBy === "ai" && <IconSpark className="cc-ev__ai" />}
    </div>
  );
}

function CalendarView({ mode, cursor, posts, cityId, onOpen, onMove }: any) {
  const dragId = useRef<string>("");
  const byDay = (d: string) => posts.filter((p: ScheduledPost) => p.date === d).sort((a: any, b: any) => a.time.localeCompare(b.time));
  const onDrag = (id: string) => (e: any) => { dragId.current = id; e.dataTransfer.effectAllowed = "move"; };
  const dropDate = (date: string) => (e: any) => {
    e.preventDefault(); const id = dragId.current; dragId.current = "";
    const p = posts.find((x: ScheduledPost) => x.id === id); if (p && p.date !== date) onMove({ ...p, date });
  };
  const dropTime = (date: string, time: string) => (e: any) => {
    e.preventDefault(); const id = dragId.current; dragId.current = "";
    const p = posts.find((x: ScheduledPost) => x.id === id); if (p) onMove({ ...p, date, time });
  };

  if (mode === "list") {
    const sorted = [...posts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    if (sorted.length === 0) return <div className="cc-empty2">Нет публикаций по выбранным фильтрам.</div>;
    return (
      <div className="cc-list">
        {sorted.map((p: ScheduledPost) => {
          const meta = STATUS_META[p.status];
          return (
            <button key={p.id} className="cc-lrow" onClick={() => onOpen(p)} type="button">
              <span className={`cc-dot ${meta.cls}`} />
              <span className="cc-lrow__d">{humanDate(p.date)}</span>
              <span className="cc-lrow__t">{p.time}</span>
              {p.image && <span className="cc-lrow__img" style={{ backgroundImage: `url("${p.image}")` }} />}
              <span className="cc-lrow__txt">{(p.title || p.text || "Без текста").slice(0, 80)}</span>
              <span className="cc-lrow__ch muted">{p.channel}</span>
              {p.createdBy === "ai" && <span className="cc-tagai"><IconSpark className="ico" /> ИИ</span>}
              <span className={`cc-badge ${meta.cls}`}>{meta.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (mode === "day") {
    const date = ymd(cursor);
    const hours = Array.from({ length: 24 }, (_, h) => h);
    return (
      <div className="cc-day">
        {hours.map((h) => {
          const hh = String(h).padStart(2, "0");
          const items = byDay(date).filter((p: ScheduledPost) => p.time.slice(0, 2) === hh);
          return (
            <div key={h} className="cc-hour" onDragOver={(e) => e.preventDefault()} onDrop={dropTime(date, hh + ":00")}>
              <span className="cc-hour__h">{hh}:00</span>
              <div className="cc-hour__b">{items.map((p: ScheduledPost) => <PostChip key={p.id} p={p} cityId={cityId} onOpen={onOpen} onDragStart={onDrag(p.id)} />)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // month / week
  const days: Date[] = [];
  if (mode === "week") { const s = startOfWeek(cursor); for (let i = 0; i < 7; i++) days.push(addDays(s, i)); }
  else { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const s = startOfWeek(first); for (let i = 0; i < 42; i++) days.push(addDays(s, i)); }

  return (
    <div className={`cc-cal ${mode}`}>
      <div className="cc-cal__dow">{RU_DOW.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="cc-cal__grid">
        {days.map((d, i) => {
          const s = ymd(d); const items = byDay(s); const isToday = s === todayYmd(); const dim = mode === "month" && !sameMonth(d, cursor);
          return (
            <div key={i} className={`cc-cell${dim ? " dim" : ""}${isToday ? " today" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={dropDate(s)}>
              <div className="cc-cell__h"><span>{d.getDate()}</span>{isToday && <em>сегодня</em>}</div>
              <div className="cc-cell__b">
                {items.slice(0, mode === "week" ? 12 : 4).map((p: ScheduledPost) => <PostChip key={p.id} p={p} cityId={cityId} onOpen={onOpen} onDragStart={onDrag(p.id)} />)}
                {items.length > (mode === "week" ? 12 : 4) && <span className="cc-more">+{items.length - (mode === "week" ? 12 : 4)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= пустое состояние ================= */
function EmptyState({ onAi, onManual }: { onAi: () => void; onManual: () => void }) {
  return (
    <div className="cc-empty">
      <div className="cc-empty__ill">
        <IconCalendar className="ico" />
        <span className="cc-empty__spark"><IconSpark className="ico" /></span>
      </div>
      <b>В календаре пока нет публикаций</b>
      <p className="muted">Создайте первый пост вручную или поручите ИИ подготовить контент-план.</p>
      <div className="cc-empty__acts">
        <button className="btn btn-primary" onClick={onAi} type="button"><IconSpark className="ico" /> Создать с ИИ</button>
        <button className="btn" onClick={onManual} type="button">Создать вручную</button>
      </div>
      <Link className="cc-empty__link" href="/dashboard/parsing">Добавить материалы из парсинга →</Link>
    </div>
  );
}

/* ================= черновики ================= */
function DraftsView({ drafts, onRefresh, onEdit, onAi, onManual }: any) {
  if (drafts.length === 0) {
    return (
      <div className="cc-empty">
        <div className="cc-empty__ill"><IconDoc className="ico" /></div>
        <b>Черновиков пока нет</b>
        <p className="muted">Черновики — посты, ещё не поставленные в календарь.</p>
        <div className="cc-empty__acts">
          <button className="btn btn-primary" onClick={onAi} type="button"><IconSpark className="ico" /> Создать с ИИ</button>
          <button className="btn" onClick={onManual} type="button">Создать вручную</button>
        </div>
      </div>
    );
  }
  return (
    <div className="cc-drafts">
      {drafts.map((d: Draft) => (
        <div key={d.id} className="cc-draft">
          {d.image && <span className="cc-draft__img" style={{ backgroundImage: `url("${d.image}")` }} />}
          <div className="cc-draft__body">
            <span className="cc-draft__tag">{d.type}{d.source ? " · " + d.source : ""}</span>
            <div className="cc-draft__text">{d.text}</div>
          </div>
          <div className="cc-draft__acts">
            <button className="btn btn-sm btn-primary" onClick={() => onEdit(d)} type="button"><IconCalendar className="ico" /> В календарь</button>
            <button className="btn btn-sm" onClick={() => { removeDraft(d.id); onRefresh(); }} type="button">Удалить</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= боковая панель поста ================= */
function checksFor(p: ScheduledPost, bot?: Bot, limitReached?: boolean) {
  const out: { ok: boolean; label: string; fix?: { href: string; label: string } }[] = [];
  out.push(bot?.tgConnected ? { ok: true, label: "Бот подключён к Telegram" } : { ok: false, label: "Бот не подключён к Telegram", fix: { href: "/dashboard/bots", label: "Подключить бот" } });
  out.push(bot && bot.tgTokenValid !== false ? { ok: true, label: "Есть права на публикацию" } : { ok: false, label: "Нет прав на публикацию в канале", fix: { href: "/dashboard/bots", label: "Проверить права" } });
  out.push(p.channel && p.channel !== "@my_channel" ? { ok: true, label: `Канал выбран: ${p.channel}` } : { ok: false, label: "Канал не выбран" });
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(p.date) && /^\d{2}:\d{2}$/.test(p.time);
  out.push(dateOk ? { ok: true, label: "Дата и время заданы" } : { ok: false, label: "Некорректная дата или время" });
  out.push(!limitReached ? { ok: true, label: "Лимит тарифа не превышен" } : { ok: false, label: "Достигнут лимит публикаций по тарифу", fix: { href: "/dashboard/billing", label: "Повысить тариф" } });
  return out;
}

function SidePanel({ post, bot, chans, onClose, onSave, onDelete, overLimit }: any) {
  const [p, setP] = useState<ScheduledPost>(post);
  const first = useRef(true);
  const origCity = useRef(post.cityId);
  useEffect(() => { setP(post); first.current = true; origCity.current = post.cityId; }, [post.id]);
  // Автосохранение
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => onSave(p), 500); return () => clearTimeout(t);
  }, [p]); // eslint-disable-line
  const patch = (x: Partial<ScheduledPost>) => setP((cur) => ({ ...cur, ...x }));
  // Смена статуса: обновляем И локальное состояние, и хранилище — иначе
  // следующее автосохранение вернуло бы прежний статус.
  function commit(status: PostStatus) { const np = { ...p, status }; setP(np); onSave(np); onClose(); }
  const checks = checksFor(p, bot, overLimit);
  const canSchedule = checks.every((c) => c.ok);
  const cityChanged = p.cityId !== origCity.current;
  useEscape(onClose);

  function aiAct(kind: string) {
    if (kind === "shorter") patch({ text: (p.text || "").split(/(?<=[.!?])\s+/).slice(0, 2).join(" ") });
    if (kind === "emoji") patch({ text: "✨ " + (p.text || "") + " 🚀" });
    if (kind === "rewrite") patch({ text: genBody(p.title || p.text.slice(0, 24) || "теме", "useful", "", Math.floor(Math.random() * 3)) });
    if (kind === "image") patch({ image: genImage(p.title || "Пост", Math.floor(Math.random() * 5)), type: p.type === "Текст" ? "Текст + фото" : p.type });
  }

  return (
    <>
      <div className="cc-side__ov" onClick={onClose} />
      <aside className="cc-side">
        <div className="cc-side__h">
          <b>{p.status === "draft" ? "Новый пост" : "Публикация"}</b>
          <button className="cc-side__x" onClick={onClose} type="button">✕</button>
        </div>
        <div className="cc-side__b">
          {/* Предпросмотр */}
          <div className="cc-prev">
            <div className="cc-prev__top"><span className="cc-prev__ava">{(p.channel || "T").replace(/^@/, "").slice(0, 1).toUpperCase()}</span><b>{p.channel || "@channel"}</b></div>
            {p.image && <img className="cc-prev__img" src={p.image} alt="" />}
            <div className="cc-prev__text">{p.text || <span className="muted">Текст поста появится здесь…</span>}</div>
            {p.cta && <div className="cc-prev__cta">{p.cta}</div>}
            {(p.buttons || []).filter((b) => b.text).map((b, i) => <div key={i} className="cc-prev__btn">{b.text}</div>)}
          </div>

          {/* Редактирование */}
          <label className="af"><span>Заголовок</span><input className="input" value={p.title || ""} onChange={(e) => patch({ title: e.target.value })} placeholder="Короткое имя поста" /></label>
          <label className="af"><span>Текст</span><textarea className="input" style={{ minHeight: 110 }} value={p.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Текст публикации…" /></label>
          <div className="cc-aiacts">
            <button onClick={() => aiAct("shorter")} type="button">Сделать короче</button>
            <button onClick={() => aiAct("rewrite")} type="button">Переписать</button>
            <button onClick={() => aiAct("emoji")} type="button">Добавить эмодзи</button>
            <button onClick={() => aiAct("image")} type="button">Создать изображение</button>
          </div>

          <div className="cc-2">
            <label className="af"><span>Канал</span><select className="input" value={p.channel} onChange={(e) => patch({ channel: e.target.value })}>
              {chans.map((c: any) => <option key={c.id} value={c.channel || c.name}>{c.channel || c.name}</option>)}
              {!chans.some((c: any) => (c.channel || c.name) === p.channel) && <option value={p.channel}>{p.channel}</option>}
            </select></label>
            <label className="af"><span>Тип</span><select className="input" value={p.type} onChange={(e) => patch({ type: e.target.value })}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select></label>
          </div>
          <div className="cc-2">
            <label className="af"><span>Дата</span><input className="input" type="date" value={p.date} onChange={(e) => patch({ date: e.target.value })} /></label>
            <label className="af"><span>Время</span><input className="input" type="time" value={p.time} onChange={(e) => patch({ time: e.target.value })} /></label>
          </div>
          <label className="af"><span>Часовой пояс</span><select className="input" value={p.cityId} onChange={(e) => patch({ cityId: e.target.value })}>{TZ_CHOICES.map((id) => { const c = cityById(id); return <option key={id} value={id}>{c?.name} · {utcLabel(c!.tz)}</option>; })}</select></label>
          <div className="cc-when">🕑 {timeLabel(p.time, p.cityId)}</div>
          {cityChanged && <div className="cc-tzwarn">Пояс изменён: время «{p.time}» останется прежним, но фактический момент публикации сместится.</div>}

          {/* Проверки перед планированием */}
          <div className="cc-checks">
            <div className="cc-checks__t">Готовность к публикации</div>
            {checks.map((c, i) => (
              <div key={i} className={`cc-checkrow ${c.ok ? "ok" : "no"}`}>
                <span>{c.ok ? "✓" : "!"}</span> {c.label}
                {!c.ok && c.fix && <Link className="cc-fix" href={c.fix.href}>{c.fix.label}</Link>}
              </div>
            ))}
          </div>

          {/* Статистика */}
          {p.status === "published"
            ? <div className="cc-stats"><div className="cc-stat"><b>—</b><span>Просмотры</span></div><div className="cc-stat"><b>—</b><span>Реакции</span></div><div className="cc-stat"><b>—</b><span>Пересылки</span></div><div className="cc-note muted">Данные подтянутся из Telegram после публикации.</div></div>
            : <div className="cc-note muted">📊 Статистика появится после публикации.</div>}
        </div>

        <div className="cc-side__foot">
          <button className="user-act del" onClick={() => onDelete(p.id)} type="button">Удалить</button>
          <div className="pw-row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => commit("review")} type="button">На согласование</button>
            <button className="btn" onClick={() => commit("planned")} type="button" disabled={!canSchedule} title={canSchedule ? "" : "Исправьте ошибки готовности"}><IconCalendar className="ico" /> Запланировать</button>
            <button className="btn btn-primary" onClick={() => commit("published")} type="button" disabled={!canSchedule}><IconSend className="ico" /> Опубликовать</button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ================= мастер «Создать с ИИ» ================= */
const AI_SOURCES = ["База знаний", "Сайт", "Материалы парсинга", "Загруженный файл", "Собственное описание"];
function AiWizard({ initSource, channel, cityId, onClose, onDone }: any) {
  const [step, setStep] = useState(1);
  const [chan, setChan] = useState(channel);
  const [format, setFormat] = useState("Текст + фото");
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState("useful");
  const [source, setSource] = useState(initSource || "Собственное описание");
  const [tone, setTone] = useState("Дружелюбный");
  const [audience, setAudience] = useState("");
  const [gen, setGen] = useState<{ title: string; text: string; cta: string; image: string; buttons: { text: string; url: string }[] } | null>(null);
  const [variants, setVariants] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState<"now" | "later">("later");
  const [date, setDate] = useState(todayYmd());
  const [time, setTime] = useState("18:00");
  const draftId = useRef<string>("");
  useEscape(onClose);

  // автосохранение черновика
  useEffect(() => {
    if (!gen) return;
    const t = setTimeout(() => {
      if (!draftId.current) { const d = addDraft(gen.text, format, "ИИ", gen.image); draftId.current = d.id; }
    }, 600);
    return () => clearTimeout(t);
  }, [gen]); // eslint-disable-line

  function generate() {
    setBusy(true);
    setTimeout(() => {
      const t = topic.trim() || "вашей теме";
      setGen({ title: genTitle(t, kind), text: genBody(t, kind, tone), cta: genCTA(kind), image: format.includes("фото") || format === "Изображение" ? genImage(t, 0) : "", buttons: [{ text: genCTA(kind), url: "" }] });
      setBusy(false); setStep(6);
    }, 700);
  }
  function act(a: string) {
    if (!gen) return;
    const t = topic.trim() || "теме";
    if (a === "shorter") setGen({ ...gen, text: gen.text.split(/\n\n/)[0] });
    if (a === "rewrite") setGen({ ...gen, text: genBody(t, kind, tone, Math.floor(Math.random() * 3)), title: genTitle(t, kind, Math.floor(Math.random() * 3)) });
    if (a === "emoji") setGen({ ...gen, text: "✨ " + gen.text + "\n\n🔥🚀👇" });
    if (a === "style") { const nx = TONES[(TONES.indexOf(tone) + 1) % TONES.length]; setTone(nx); setGen({ ...gen, text: genBody(t, kind, nx, Math.floor(Math.random() * 3)) }); }
    if (a === "image") setGen({ ...gen, image: genImage(t, Math.floor(Math.random() * 5)) });
    if (a === "time") setTime(["10:00", "13:00", "18:00", "20:00"][Math.floor(Math.random() * 4)]);
    if (a === "variants") setVariants([genBody(t, kind, tone, 0), genBody(t, kind, tone, 1), genBody(t, kind, tone, 2)]);
  }
  function finish() {
    if (!gen) return;
    if (draftId.current) removeDraft(draftId.current);
    const p: ScheduledPost = {
      id: pid(), title: gen.title, text: gen.text, channel: chan, date, time, cityId,
      regionMode: "sim", repeat: "Один раз", type: format, status: when === "now" ? "published" : "planned",
      createdBy: "ai", author: "ИИ", cta: gen.cta, image: gen.image, buttons: gen.buttons,
    };
    upsertPost(p); onDone();
  }

  const steps = ["Канал и формат", "Тема", "Источник", "Тон и аудитория", "Генерация", "Предпросмотр", "Публикация"];
  return (
    <div className="cc-modal__ov" onClick={onClose}>
      <div className="cc-modal cc-wiz" onClick={(e) => e.stopPropagation()}>
        <div className="cc-modal__h"><b><IconSpark className="ico" /> Создать пост с ИИ</b><button onClick={onClose} type="button">✕</button></div>
        <div className="cc-wiz__steps">{steps.map((s, i) => <span key={i} className={`cc-wiz__st${step === i + 1 ? " on" : ""}${step > i + 1 ? " done" : ""}`}>{step > i + 1 ? "✓" : i + 1}</span>)}</div>
        <div className="cc-wiz__b">
          {step === 1 && (<>
            <label className="af"><span>Канал / группа</span><input className="input" value={chan} onChange={(e) => setChan(e.target.value)} /></label>
            <label className="af"><span>Формат публикации</span><div className="cc-pills">{FORMATS.map((f) => <button key={f} className={`cc-pill${format === f ? " on" : ""}`} onClick={() => setFormat(f)} type="button">{f}</button>)}</div></label>
          </>)}
          {step === 2 && (<>
            <label className="af"><span>Тема или цель поста</span><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Напр.: запуск нового курса по SMM" autoFocus /></label>
            <label className="af"><span>Тип контента</span><div className="cc-pills">{KINDS.map((k) => <button key={k.id} className={`cc-pill${kind === k.id ? " on" : ""}`} onClick={() => setKind(k.id)} type="button">{k.label}</button>)}</div></label>
          </>)}
          {step === 3 && (
            <label className="af"><span>Источник данных для ИИ</span><div className="cc-pills col">{AI_SOURCES.map((s) => <button key={s} className={`cc-pill${source === s ? " on" : ""}`} onClick={() => setSource(s)} type="button">{s}</button>)}</div>
              <div className="hint" style={{ marginTop: 8 }}>ИИ возьмёт факты из выбранного источника. Проверяйте цифры и цены перед публикацией.</div>
            </label>
          )}
          {step === 4 && (<>
            <label className="af"><span>Тон общения</span><div className="cc-pills">{TONES.map((t) => <button key={t} className={`cc-pill${tone === t ? " on" : ""}`} onClick={() => setTone(t)} type="button">{t}</button>)}</div></label>
            <label className="af"><span>Целевая аудитория</span><input className="input" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Напр.: начинающие предприниматели 25–40" /></label>
          </>)}
          {step === 5 && (
            <div className="cc-genstep">
              <button className="btn btn-primary" onClick={generate} type="button" disabled={busy}>{busy ? "Генерирую…" : <><IconSpark className="ico" /> Сгенерировать пост</>}</button>
              <p className="muted" style={{ fontSize: 12.5 }}>ИИ создаст заголовок, текст, изображение, CTA и кнопки. Любое поле можно изменить вручную.</p>
            </div>
          )}
          {step === 6 && gen && (
            <div className="cc-genres">
              <div className="cc-prev">
                <div className="cc-prev__top"><span className="cc-prev__ava">{chan.replace(/^@/, "").slice(0, 1).toUpperCase()}</span><b>{chan}</b></div>
                {gen.image && <img className="cc-prev__img" src={gen.image} alt="" />}
                <div className="cc-prev__text">{gen.text}</div>
                {gen.cta && <div className="cc-prev__cta">{gen.cta}</div>}
              </div>
              <label className="af"><span>Заголовок</span><input className="input" value={gen.title} onChange={(e) => setGen({ ...gen, title: e.target.value })} /></label>
              <label className="af"><span>Текст</span><textarea className="input" style={{ minHeight: 100 }} value={gen.text} onChange={(e) => setGen({ ...gen, text: e.target.value })} /></label>
              <div className="cc-aiacts">
                {[["shorter", "Сделать короче"], ["rewrite", "Переписать"], ["emoji", "Добавить эмодзи"], ["style", "Изменить стиль"], ["image", "Создать изображение"], ["variants", "Создать ещё 3 варианта"]].map(([k, l]) => <button key={k} onClick={() => act(k)} type="button">{l}</button>)}
              </div>
              {variants.length > 0 && (
                <div className="cc-variants">{variants.map((v, i) => <button key={i} className="cc-variant" onClick={() => { setGen({ ...gen, text: v }); setVariants([]); }} type="button"><b>Вариант {i + 1}</b>{v.slice(0, 90)}…</button>)}</div>
              )}
              <div className="cc-save muted">✓ Черновик сохраняется автоматически</div>
            </div>
          )}
          {step === 7 && gen && (<>
            <div className="cc-when2">
              <button className={`cc-pill${when === "now" ? " on" : ""}`} onClick={() => setWhen("now")} type="button">Опубликовать сейчас</button>
              <button className={`cc-pill${when === "later" ? " on" : ""}`} onClick={() => setWhen("later")} type="button">Запланировать</button>
            </div>
            {when === "later" && (<>
              <div className="cc-2">
                <label className="af"><span>Дата</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label className="af"><span>Время</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
              </div>
              <div className="cc-when">🕑 {timeLabel(time, cityId)}</div>
              <button className="btn btn-sm" onClick={() => act("time")} type="button" style={{ marginTop: 8 }}>Предложить другое время</button>
            </>)}
          </>)}
        </div>
        <div className="cc-wiz__foot">
          <button className="btn" onClick={() => (step === 1 ? onClose() : setStep(step - 1))} type="button">{step === 1 ? "Отмена" : "Назад"}</button>
          {step < 6 && <button className="btn btn-primary" onClick={() => (step === 5 ? generate() : setStep(step + 1))} type="button" disabled={step === 2 && !topic.trim()}>{step === 5 ? "Сгенерировать" : "Далее"}</button>}
          {step === 6 && <button className="btn btn-primary" onClick={() => setStep(7)} type="button">К публикации →</button>}
          {step === 7 && <button className="btn btn-primary" onClick={finish} type="button">{when === "now" ? "Опубликовать" : "Запланировать"}</button>}
        </div>
      </div>
    </div>
  );
}

/* ================= серия постов ================= */
function SeriesModal({ channel, cityId, onClose, onDone }: any) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("5");
  const [startDate, setStartDate] = useState(todayYmd());
  const [time, setTime] = useState("12:00");
  const [everyN, setEveryN] = useState("1");
  useEscape(onClose);
  function create() {
    const n = Math.min(Math.max(Number(count) || 1, 1), 30); const step = Math.max(Number(everyN) || 1, 1);
    const base = parseYmd(startDate);
    for (let i = 0; i < n; i++) {
      const d = addDays(base, i * step); const kind = KINDS[i % KINDS.length].id;
      const p: ScheduledPost = { id: pid(), title: genTitle(topic || "серии", kind, i), text: genBody(topic || "серии", kind, "", i), channel, date: ymd(d), time, cityId, regionMode: "sim", repeat: "Один раз", type: "Текст", status: "planned", createdBy: "ai", author: "ИИ" };
      upsertPost(p);
    }
    onDone();
  }
  return (
    <div className="cc-modal__ov" onClick={onClose}>
      <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cc-modal__h"><b><IconLayers className="ico" /> Создать серию постов</b><button onClick={onClose} type="button">✕</button></div>
        <div className="cc-modal__b">
          <label className="af"><span>Тема серии</span><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Напр.: прогрев к запуску" autoFocus /></label>
          <div className="cc-2">
            <label className="af"><span>Сколько постов</span><input className="input" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
            <label className="af"><span>Интервал (дней)</span><input className="input" value={everyN} onChange={(e) => setEveryN(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
          </div>
          <div className="cc-2">
            <label className="af"><span>Начать с</span><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <label className="af"><span>Время</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          </div>
          <div className="hint">ИИ создаст {count || 0} черновиков с чередованием форматов (полезный / продающий / вовлекающий / развлекательный) и поставит их в календарь.</div>
        </div>
        <div className="cc-modal__foot"><button className="btn" onClick={onClose} type="button">Отмена</button><button className="btn btn-primary" onClick={create} type="button">Создать серию</button></div>
      </div>
    </div>
  );
}

/* ================= контент-план ================= */
function PlanBuilder({ channel, cityId, posts, onApply }: any) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("8");
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [dows, setDows] = useState<number[]>([0, 2, 4]); // Пн Ср Пт
  const [time, setTime] = useState("18:00");
  const [ratio, setRatio] = useState<Record<string, number>>({ sell: 25, useful: 40, engage: 20, fun: 15 });
  const [plan, setPlan] = useState<{ date: string; time: string; theme: string; kind: string; format: string }[]>([]);

  const toggleDow = (i: number) => setDows((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort());
  const setR = (k: string, v: number) => setRatio((r) => ({ ...r, [k]: v }));

  function kindsSequence(n: number): string[] {
    const order = ["useful", "sell", "engage", "fun"];
    const weights = order.map((k) => Math.max(0, ratio[k] || 0));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const want = order.map((k, i) => Math.round((weights[i] / total) * n));
    const seq: string[] = [];
    order.forEach((k, i) => { for (let j = 0; j < want[i]; j++) seq.push(k); });
    while (seq.length < n) seq.push("useful");
    // перемешать по кругу для разнообразия
    return seq.slice(0, n).sort(() => 0.5 - Math.random());
  }
  function generate() {
    const n = Math.min(Math.max(Number(count) || 1, 1), 60);
    const seq = kindsSequence(n);
    const start = period === "week" ? startOfWeek(new Date()) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const horizon = period === "week" ? 7 : 31;
    const slots: { date: string; time: string }[] = [];
    for (let i = 0; i < horizon && slots.length < n; i++) { const d = addDays(start, i); if (dows.includes((d.getDay() + 6) % 7)) slots.push({ date: ymd(d), time }); }
    let di = 0;
    const out = seq.map((k, i) => { const slot = slots[di % Math.max(slots.length, 1)] || { date: ymd(addDays(start, i)), time }; di++; const label = KINDS.find((x) => x.id === k)!.label; return { date: slot.date, time: slot.time, theme: genTitle(topic || "вашей теме", k, i), kind: k, format: k === "fun" ? "Текст + фото" : "Текст" }; });
    out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    setPlan(out);
  }
  function replaceRow(i: number) { setPlan((pl) => pl.map((r, k) => k === i ? { ...r, theme: genTitle(topic || "теме", r.kind, Math.floor(Math.random() * 3) + i) } : r)); }
  function apply() {
    plan.forEach((r) => { const p: ScheduledPost = { id: pid(), title: r.theme, text: r.theme, channel, date: r.date, time: r.time, cityId, regionMode: "sim", repeat: "Один раз", type: r.format, status: "review", createdBy: "ai", author: "ИИ" }; upsertPost(p); });
    setPlan([]); onApply();
  }
  function fillFreeDays() {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const taken = new Set(posts.map((p: ScheduledPost) => p.date));
    const add: { date: string; time: string; theme: string; kind: string; format: string }[] = [];
    for (let i = 0; i < 31 && add.length < 10; i++) { const d = addDays(start, i); const s = ymd(d); if (!sameMonth(d, start)) continue; if (!taken.has(s) && dows.includes((d.getDay() + 6) % 7)) { const k = KINDS[add.length % KINDS.length].id; add.push({ date: s, time, theme: genTitle(topic || "теме", k, i), kind: k, format: "Текст" }); } }
    setPlan((pl) => [...pl, ...add].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
  }

  const ratioTotal = Object.values(ratio).reduce((a, b) => a + b, 0);
  return (
    <div className="cc-plan">
      <div className="cc-plan__form card">
        <div className="cc-plan__t">Автоматический контент-план</div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>Укажите параметры — ИИ подготовит темы и черновики на период. План можно проверить и отредактировать до добавления.</p>
        <label className="af"><span>Тематика</span><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Напр.: онлайн-школа английского" /></label>
        <div className="cc-2">
          <label className="af"><span>Количество постов</span><input className="input" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
          <label className="af"><span>Период</span><select className="input" value={period} onChange={(e) => setPeriod(e.target.value as any)}><option value="week">Неделя</option><option value="month">Месяц</option></select></label>
        </div>
        <label className="af"><span>Дни публикаций</span><div className="cc-dows">{RU_DOW.map((d, i) => <button key={i} className={`cc-dow${dows.includes(i) ? " on" : ""}`} onClick={() => toggleDow(i)} type="button">{d}</button>)}</div></label>
        <label className="af"><span>Время</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ maxWidth: 140 }} /></label>
        <div className="cc-ratio">
          <div className="cc-ratio__t">Соотношение контента <em className={ratioTotal === 100 ? "ok" : "warn"}>{ratioTotal}%</em></div>
          {[["useful", "Полезный"], ["sell", "Продающий"], ["engage", "Вовлекающий"], ["fun", "Развлекательный"]].map(([k, l]) => (
            <div key={k} className="cc-ratio__row"><span>{l}</span><input type="range" min={0} max={100} step={5} value={ratio[k]} onChange={(e) => setR(k, Number(e.target.value))} /><b>{ratio[k]}%</b></div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={generate} type="button" style={{ marginTop: 12 }}><IconSpark className="ico" /> Составить план</button>
      </div>

      <div className="cc-plan__res">
        {plan.length === 0 ? (
          <div className="cc-empty2">Заполните параметры слева и нажмите «Составить план». ИИ предложит темы и даты — вы сможете заменить любую перед добавлением.</div>
        ) : (
          <>
            <div className="cc-plan__head"><b>Предварительный план · {plan.length}</b><div className="pw-row" style={{ gap: 8 }}><button className="btn btn-sm" onClick={fillFreeDays} type="button"><IconSpark className="ico" /> Заполнить свободные дни</button><button className="btn btn-sm btn-primary" onClick={apply} type="button">Добавить в календарь →</button></div></div>
            <div className="cc-plan__list">
              {plan.map((r, i) => (
                <div key={i} className="cc-plan__row">
                  <span className="cc-plan__date">{humanDate(r.date)}<em>{r.time}</em></span>
                  <span className={`cc-kind k-${r.kind}`}>{KINDS.find((x) => x.id === r.kind)!.label}</span>
                  <input className="input" value={r.theme} onChange={(e) => setPlan((pl) => pl.map((x, k) => k === i ? { ...x, theme: e.target.value } : x))} />
                  <button className="cc-plan__re" onClick={() => replaceRow(i)} type="button" title="Заменить тему">↻</button>
                  <button className="cc-plan__del" onClick={() => setPlan((pl) => pl.filter((_, k) => k !== i))} type="button">✕</button>
                </div>
              ))}
            </div>
            <div className="hint" style={{ marginTop: 10 }}>Посты добавятся со статусом «На согласовании» — проверьте их в календаре и запланируйте публикацию.</div>
          </>
        )}
      </div>
    </div>
  );
}
