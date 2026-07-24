"use client";

import { useEffect, useMemo, useState } from "react";
import { IconSpark } from "@/components/icons";
import {
  ScheduledPost, PostStatus, STATUS_LABELS,
  loadPosts, savePosts, upsertPost, removePost, pid,
} from "@/lib/schedule";
import { CITIES, cityById, searchCities, wallToInstant, formatInTz, mskLabel } from "@/lib/tz";

const STATUS_COLOR: Record<PostStatus, string> = {
  draft: "s-draft", planned: "s-planned", published: "s-published", paused: "s-paused", error: "s-error",
};
const REPEATS = ["Один раз", "Каждый день", "По будням", "Каждую неделю", "Несколько раз в день", "По индивидуальному графику", "Повторять до даты"];
const TYPES = ["Текст", "Изображение", "Текст + фото", "Видео", "Опрос"];
const CORE = ["moscow", "irkutsk", "ulanude"]; // всегда показываем пересчёт для этих

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function todayStr(): string { return ymd(new Date()); }
function human(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

type Draft = Omit<ScheduledPost, "id"> & { id?: string };

export default function Scheduler({ channel, onChange }: { channel: string; onChange?: (list: ScheduledPost[]) => void }) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [view, setView] = useState<"month" | "week" | "day" | "list">("month");
  const [cursor, setCursor] = useState(new Date());
  const [editing, setEditing] = useState<Draft | null>(null);
  const [extraCities, setExtraCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [publishNow, setPublishNow] = useState(false);

  useEffect(() => { const l = loadPosts(); setPosts(l); onChange?.(l); }, []);

  function commit(list: ScheduledPost[]) { setPosts(list); savePosts(list); onChange?.(list); }

  function openCreate(date: string) {
    setEditing({ text: "", channel: channel || "@my_channel", date, time: "12:00", cityId: "moscow", regionMode: "sim", repeat: "Один раз", type: "Текст", status: "planned" });
    setPublishNow(false);
  }
  function saveDraft() {
    if (!editing) return;
    const p: ScheduledPost = { ...editing, id: editing.id || pid() } as ScheduledPost;
    if (publishNow) { p.status = "published"; p.date = todayStr(); }
    commit(upsertPost(p));
    setEditing(null);
  }
  function delPost(id: string) { commit(removePost(id)); }
  function copyPost(p: ScheduledPost) { commit(upsertPost({ ...p, id: pid(), status: "draft" })); }
  function pausePost(p: ScheduledPost) { commit(upsertPost({ ...p, status: p.status === "paused" ? "planned" : "paused" })); }
  function movePost(id: string, date: string) {
    commit(posts.map((x) => (x.id === id ? { ...x, date } : x)));
  }

  // ИИ-расписание: раскидывает 6 постов на ближайшие дни в активное время.
  function aiSchedule() {
    const base = new Date();
    const times = ["10:00", "13:00", "19:00"];
    const gen: ScheduledPost[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      gen.push({ id: pid(), text: `Пост №${i + 1} — подготовлено ИИ`, channel: channel || "@my_channel", date: ymd(d), time: times[i % times.length], cityId: "moscow", regionMode: "sim", repeat: "Один раз", type: "Текст", status: "planned" });
    }
    commit([...posts, ...gen]);
  }

  // Пересчёт времени для формы.
  const targetCities = useMemo(() => Array.from(new Set([...CORE, ...extraCities])), [extraCities]);
  const recalc = useMemo(() => {
    if (!editing) return [];
    const moscow = cityById("moscow")!;
    const instant = wallToInstant(editing.date, editing.time, moscow.tz);
    return targetCities.map((id) => {
      const c = cityById(id)!;
      const t = editing.regionMode === "local" ? editing.time : formatInTz(instant, c.tz);
      return { city: c, time: t, label: mskLabel(c.tz) };
    });
  }, [editing, targetCities]);

  const sorted = useMemo(() => [...posts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [posts]);
  const upcoming = sorted.filter((p) => p.status !== "published").slice(0, 5);
  const [showAll, setShowAll] = useState(false);

  // Сетка месяца.
  const monthCells = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7; // пн=0
    const cells: { date: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(y, m, 1 - startDow + i);
      cells.push({ date: ymd(d), inMonth: d.getMonth() === m });
    }
    return cells;
  }, [cursor]);

  function timesForCity(p: ScheduledPost, cityId: string): string {
    const c = cityById(cityId)!;
    if (p.regionMode === "local") return p.time;
    const instant = wallToInstant(p.date, p.time, cityById(p.cityId)?.tz || "Europe/Moscow");
    return formatInTz(instant, c.tz);
  }

  return (
    <div className="sc">
      {/* Верхняя строка: режим публикации + виды + ИИ */}
      <div className="sc-top">
        <div className="seg sc-mode">
          <button className={!publishNow ? "on" : ""} onClick={() => setPublishNow(false)} type="button">Запланировать</button>
          <button className={publishNow ? "on" : ""} onClick={() => setPublishNow(true)} type="button">Опубликовать сейчас</button>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ai btn-sm" onClick={aiSchedule} type="button"><IconSpark className="ico" /> Составить расписание с ИИ</button>
        <button className="btn btn-primary btn-sm" onClick={() => openCreate(todayStr())} type="button">+ Публикация</button>
      </div>

      {/* Переключатель видов */}
      <div className="sc-views">
        {(["month", "week", "day", "list"] as const).map((v) => (
          <button key={v} className={`sc-view${view === v ? " on" : ""}`} onClick={() => setView(v)} type="button">
            {v === "month" ? "Месяц" : v === "week" ? "Неделя" : v === "day" ? "День" : "Список"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {view === "month" && (
          <div className="sc-nav">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} type="button">‹</button>
            <b>{cursor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</b>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} type="button">›</button>
          </div>
        )}
      </div>

      {/* Календарь месяца */}
      {view === "month" && (
        <div className="sc-cal">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => <div key={d} className="sc-dow">{d}</div>)}
          {monthCells.map((cell) => {
            const dayPosts = posts.filter((p) => p.date === cell.date);
            return (
              <div
                key={cell.date}
                className={`sc-day${cell.inMonth ? "" : " out"}${cell.date === todayStr() ? " today" : ""}`}
                onClick={() => openCreate(cell.date)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const id = e.dataTransfer.getData("id"); if (id) movePost(id, cell.date); }}
              >
                <div className="sc-day__n">{cell.date.slice(8)}</div>
                {dayPosts.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className={`sc-chip ${STATUS_COLOR[p.status]}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("id", p.id)}
                    onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                  >
                    {p.time} {p.text.slice(0, 14) || "Без текста"}
                  </div>
                ))}
                {dayPosts.length > 3 && <div className="sc-more">+{dayPosts.length - 3}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Список / Неделя / День — единый список публикаций */}
      {view !== "month" && (
        <div className="sc-list">
          {sorted.length === 0 && <div className="muted" style={{ padding: 16 }}>Публикаций пока нет. Нажмите «+ Публикация» или «Составить расписание с ИИ».</div>}
          {sorted.map((p) => (
            <div key={p.id} className="sc-listrow">
              <span className={`sc-dot ${STATUS_COLOR[p.status]}`} />
              <div className="sc-listrow__main">
                <b>{human(p.date)} · {p.time}</b>
                <span className="muted">{p.text.slice(0, 40) || "Без текста"} · {p.channel}</span>
              </div>
              <span className={`sc-badge ${STATUS_COLOR[p.status]}`}>{STATUS_LABELS[p.status]}</span>
              <button className="btn btn-sm" onClick={() => setEditing(p)} type="button">Изменить</button>
            </div>
          ))}
        </div>
      )}

      {/* Форма создания / редактирования */}
      {editing && (
        <div className="sc-form">
          <div className="sc-form__head">
            <b>{editing.id ? "Редактирование публикации" : "Новая публикация"}</b>
            <button className="fn__x dark" onClick={() => setEditing(null)}>✕</button>
          </div>

          <div className="seg sc-mode" style={{ marginBottom: 12 }}>
            <button className={!publishNow ? "on" : ""} onClick={() => setPublishNow(false)} type="button">Запланировать публикацию</button>
            <button className={publishNow ? "on" : ""} onClick={() => setPublishNow(true)} type="button">Опубликовать сейчас</button>
          </div>

          <div className="field"><label className="pw-label">Текст поста</label>
            <textarea className="textarea" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} placeholder="Начните вводить текст публикации…" style={{ minHeight: 70 }} /></div>

          <div className="pw-grid2">
            <div className="field"><label className="pw-label">Telegram-канал</label>
              <input className="input" value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })} placeholder="@my_channel" /></div>
            <div className="field"><label className="pw-label">Тип контента</label>
              <select className="select" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select></div>
          </div>

          {!publishNow && (
            <>
              <div className="pw-grid2">
                <div className="field"><label className="pw-label">Дата</label>
                  <input className="input" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></div>
                <div className="field"><label className="pw-label">Время (по Москве)</label>
                  <input className="input" type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} /></div>
              </div>

              {/* Города и часовые пояса */}
              <label className="pw-label" style={{ marginTop: 8 }}>Города и часовые пояса</label>
              <div className="pw-chips">
                {[{ id: "moscow", n: "Москва — МСК" }, { id: "irkutsk", n: "Иркутск" }, { id: "ulanude", n: "Улан-Удэ" }].map((qc) => (
                  <button key={qc.id} className={`pw-chip on`} type="button" disabled>{qc.n}</button>
                ))}
                {extraCities.map((id) => (
                  <button key={id} className="pw-chip on" type="button" onClick={() => setExtraCities(extraCities.filter((x) => x !== id))}>✓ {cityById(id)?.name} ✕</button>
                ))}
              </div>
              <div className="sc-citysearch">
                <input className="input" value={citySearch} onChange={(e) => setCitySearch(e.target.value)} placeholder="Добавить другой город (поиск по России и миру)…" />
                {citySearch && (
                  <div className="sc-cityres">
                    {searchCities(citySearch).filter((c) => !CORE.includes(c.id) && !extraCities.includes(c.id)).map((c) => (
                      <button key={c.id} onClick={() => { setExtraCities([...extraCities, c.id]); setCitySearch(""); }} type="button">
                        {c.name} <span className="muted">{mskLabel(c.tz)}</span>
                      </button>
                    ))}
                    {searchCities(citySearch).length === 0 && <div className="muted" style={{ padding: 8 }}>Город не найден</div>}
                  </div>
                )}
              </div>

              {/* Режим региональной публикации */}
              <label className="pw-label" style={{ marginTop: 12 }}>Режим публикации по регионам</label>
              <div className="sc-regmode">
                <button className={`sc-reg${editing.regionMode === "sim" ? " on" : ""}`} onClick={() => setEditing({ ...editing, regionMode: "sim" })} type="button">
                  <b>Одновременно</b><span>Выходит во всех каналах в один момент. Вы задаёте время по Москве.</span>
                </button>
                <button className={`sc-reg${editing.regionMode === "local" ? " on" : ""}`} onClick={() => setEditing({ ...editing, regionMode: "local" })} type="button">
                  <b>По местному времени</b><span>В каждом городе пост выходит в выбранное местное время (напр. 12:00).</span>
                </button>
              </div>

              {/* Пересчёт времени */}
              <div className="sc-recalc">
                <div className="sc-recalc__t">🕒 Публикация запланирована:</div>
                <div className="sc-recalc__rows">
                  {recalc.map((r) => (
                    <div key={r.city.id} className="sc-recalc__row">
                      <span>{r.city.name} <em>{r.label}</em></span><b>{r.time}</b>
                    </div>
                  ))}
                </div>
              </div>

              {/* Повторение */}
              <div className="pw-grid2" style={{ marginTop: 12 }}>
                <div className="field"><label className="pw-label">Повторение</label>
                  <select className="select" value={editing.repeat} onChange={(e) => setEditing({ ...editing, repeat: e.target.value })}>
                    {REPEATS.map((r) => <option key={r}>{r}</option>)}
                  </select></div>
                <div className="field"><label className="pw-label">Статус</label>
                  <select className="select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as PostStatus })}>
                    {(Object.keys(STATUS_LABELS) as PostStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select></div>
              </div>
            </>
          )}

          <div className="sc-form__foot">
            {editing.id && <button className="user-act del" onClick={() => { delPost(editing.id!); setEditing(null); }} type="button">Удалить</button>}
            {editing.id && <button className="btn btn-sm" onClick={() => { copyPost(editing as ScheduledPost); }} type="button">Копировать</button>}
            {editing.id && <button className="btn btn-sm" onClick={() => { pausePost(editing as ScheduledPost); setEditing(null); }} type="button">{editing.status === "paused" ? "Возобновить" : "Пауза"}</button>}
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setEditing(null)} type="button">Отмена</button>
            <button className="btn btn-primary" onClick={saveDraft} type="button">{publishNow ? "Опубликовать" : "Сохранить"}</button>
          </div>
        </div>
      )}

      {/* Очередь публикаций */}
      <div className="sc-queue">
        <div className="sc-queue__head">
          <b>Ближайшие публикации</b>
          <button className="btn-link" onClick={() => setShowAll((v) => !v)} type="button">{showAll ? "Свернуть" : "Показать все публикации"}</button>
        </div>
        {(showAll ? sorted : upcoming).length === 0 && <div className="muted" style={{ padding: "8px 2px" }}>Пока ничего не запланировано.</div>}
        {(showAll ? sorted : upcoming).map((p) => (
          <div key={p.id} className="sc-qrow">
            <span className={`sc-dot ${STATUS_COLOR[p.status]}`} />
            <div className="sc-qrow__d"><b>{human(p.date)}</b><span className="muted">{p.channel}</span></div>
            <div className="sc-qrow__tz">
              <span>Мск <b>{timesForCity(p, "moscow")}</b></span>
              <span>Иркутск <b>{timesForCity(p, "irkutsk")}</b></span>
              <span>Улан-Удэ <b>{timesForCity(p, "ulanude")}</b></span>
            </div>
            <span className={`sc-badge ${STATUS_COLOR[p.status]}`}>{STATUS_LABELS[p.status]}</span>
            <button className="btn btn-sm" onClick={() => setEditing(p)} type="button">✎</button>
          </div>
        ))}
      </div>
    </div>
  );
}
