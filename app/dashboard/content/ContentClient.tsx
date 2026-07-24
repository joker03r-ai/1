"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark } from "@/components/icons";
import Scheduler from "../promotion/Scheduler";
import { Draft, loadDrafts, addDraft, updateDraft, removeDraft } from "@/lib/content";
import { ScheduledPost, PostStatus, STATUS_LABELS, loadPosts, upsertPost, removePost, pid } from "@/lib/schedule";
import { loadBots, currentBot } from "@/lib/bots";

type Tab = "drafts" | "create" | "plan" | "calendar" | "scheduled" | "published";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "drafts", label: "Черновики", icon: "📝" },
  { id: "create", label: "Создать пост", icon: "✍️" },
  { id: "plan", label: "Контент-план", icon: "🗓" },
  { id: "calendar", label: "Календарь", icon: "📅" },
  { id: "scheduled", label: "Запланированные", icon: "⏰" },
  { id: "published", label: "Опубликованные", icon: "✅" },
];

const TYPES = ["Текст", "Изображение", "Текст + фото", "Видео", "Опрос"];
const STATUS_COLOR: Record<PostStatus, string> = { draft: "s-draft", planned: "s-planned", published: "s-published", paused: "s-paused", error: "s-error" };

function human(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
function genImage(topic: string, i: number): string {
  const pairs = [["#7c5cff", "#b892ff"], ["#2b6ef6", "#5aa2ff"], ["#16a34a", "#4ade80"], ["#f59e0b", "#fbbf24"]];
  const [a, b] = pairs[i % pairs.length];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 22);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='640' height='400' fill='url(#g)'/><circle cx='540' cy='90' r='120' fill='rgba(255,255,255,.12)'/><text x='44' y='215' font-family='Arial' font-size='40' font-weight='700' fill='#fff'>${esc(topic)}</text><text x='44' y='268' font-family='Arial' font-size='22' fill='rgba(255,255,255,.85)'>Изображение ${i + 1}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export default function ContentClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("drafts");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [channel, setChannel] = useState("@my_channel");
  const [editId, setEditId] = useState("");
  const [editText, setEditText] = useState("");

  // Создание поста
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState("Текст");
  // Контент-план
  const [planTopic, setPlanTopic] = useState("");
  const [plan, setPlan] = useState<{ day: string; theme: string; format: string }[]>([]);

  useEffect(() => {
    setDrafts(loadDrafts());
    setPosts(loadPosts());
    const b = currentBot(loadBots());
    if (b?.tgUsername) setChannel("@" + b.tgUsername);
    const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (q && TABS.some((t) => t.id === q)) setTab(q);
  }, []);

  function refreshDrafts() { setDrafts(loadDrafts()); }
  function refreshPosts() { setPosts(loadPosts()); }

  function draftToCalendar(d: Draft) {
    const existing = loadPosts();
    const dt = new Date(); dt.setDate(dt.getDate() + existing.length + 1);
    const p: ScheduledPost = {
      id: pid(), text: d.text, channel, date: dt.toISOString().slice(0, 10), time: "12:00",
      cityId: "moscow", regionMode: "sim", repeat: "Один раз", type: d.type, status: "planned",
    };
    upsertPost(p);
    removeDraft(d.id);
    refreshDrafts(); refreshPosts();
    setTab("calendar");
  }

  function saveNewPost() {
    if (!newText.trim()) return;
    addDraft(newText.trim(), newType, "Создан вручную");
    setNewText("");
    refreshDrafts();
    setTab("drafts");
  }
  function aiPost() {
    const topic = newText.trim() || "вашей теме";
    const t = `🔥 Разбираем «${topic}»: 3 совета, которые работают. Сохраните, чтобы не потерять.`;
    setNewText(t);
  }

  function genPlan() {
    const topic = planTopic.trim() || "вашей теме";
    const days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
    const themes = ["Полезный совет", "Разбор ошибки", "Кейс / результат", "Ответы на вопросы", "Оффер / акция", "Развлекательный пост", "Итоги недели"];
    const formats = ["Текст", "Текст + фото", "Опрос", "Текст", "Текст + фото", "Видео", "Текст"];
    setPlan(days.map((d, i) => ({ day: d, theme: `${themes[i]} — «${topic}»`, format: formats[i] })));
  }
  function planToDrafts() {
    plan.forEach((it) => addDraft(it.theme, it.format, "Контент-план"));
    refreshDrafts();
    setTab("drafts");
  }

  const scheduled = posts.filter((p) => p.status !== "published").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const published = posts.filter((p) => p.status === "published").sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  return (
    <>
      <Topbar crumbs={["Основной проект", "Контент", TABS.find((t) => t.id === tab)?.label || ""]} />
      <div className="content" style={{ maxWidth: 1180 }}>
        <div className="sec-head">
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Контент и календарь</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Создавайте посты, планируйте их в календаре и следите за публикациями. Готовый контент можно
              выбрать в мастере продвижения.
            </p>
          </div>
        </div>

        <div className="pr-flow">Парсинг → Черновики → <b>Создание контента</b> → Календарь → Публикация</div>

        {/* Вкладки */}
        <div className="ct-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`ct-tab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)} type="button">
              <span>{t.icon}</span> {t.label}
              {t.id === "drafts" && drafts.length > 0 && <em className="ct-tab__b">{drafts.length}</em>}
              {t.id === "scheduled" && scheduled.length > 0 && <em className="ct-tab__b">{scheduled.length}</em>}
            </button>
          ))}
        </div>

        {/* ЧЕРНОВИКИ */}
        {tab === "drafts" && (
          <div className="card ct-card">
            <div className="ct-hint">👉 Черновики — посты, ещё не поставленные в календарь. Отредактируйте и нажмите «В календарь», чтобы запланировать публикацию.</div>
            {drafts.length === 0 ? (
              <div className="ct-empty">
                <div>Черновиков пока нет.</div>
                <div className="ct-empty__acts">
                  <button className="btn btn-primary" onClick={() => setTab("create")} type="button">✍️ Создать пост</button>
                  <Link className="btn" href="/dashboard/parsing">🔍 Собрать в парсинге</Link>
                </div>
              </div>
            ) : (
              <div className="ct-drafts">
                {drafts.map((d) => (
                  <div key={d.id} className="ct-draft">
                    {editId === d.id ? (
                      <>
                        <textarea className="textarea" value={editText} onChange={(e) => setEditText(e.target.value)} style={{ minHeight: 80 }} />
                        <div className="ct-draft__acts">
                          <button className="btn btn-sm btn-primary" onClick={() => { updateDraft(d.id, { text: editText }); setEditId(""); refreshDrafts(); }} type="button">Сохранить</button>
                          <button className="btn btn-sm" onClick={() => setEditId("")} type="button">Отмена</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ct-draft__body">
                          <span className="ct-draft__tag">{d.type} · {d.source}</span>
                          <div className="ct-draft__text">{d.text}</div>
                        </div>
                        <div className="ct-draft__acts">
                          <button className="btn btn-sm btn-primary" onClick={() => draftToCalendar(d)} type="button">📅 В календарь</button>
                          <button className="btn btn-sm" onClick={() => { setEditId(d.id); setEditText(d.text); }} type="button">Изменить</button>
                          <Link className="btn btn-sm" href="/dashboard/promotion">Продвигать</Link>
                          <button className="user-act del" onClick={() => { removeDraft(d.id); refreshDrafts(); }} type="button">Удалить</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* СОЗДАТЬ ПОСТ */}
        {tab === "create" && (
          <div className="card ct-card">
            <div className="ct-hint">👉 Напишите пост или сгенерируйте черновик с ИИ. После сохранения он появится во вкладке «Черновики».</div>
            <label className="pw-label">Текст поста</label>
            <textarea className="textarea" value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Введите текст или тему для ИИ…" style={{ minHeight: 120 }} />
            <div className="pw-grid2" style={{ marginTop: 12, maxWidth: 360 }}>
              <div className="field"><label className="pw-label">Тип</label>
                <select className="select" value={newType} onChange={(e) => setNewType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
            </div>
            <div className="pw-row" style={{ marginTop: 14 }}>
              <button className="btn btn-ai" onClick={aiPost} type="button"><IconSpark className="ico" /> Сгенерировать с ИИ</button>
              <button className="btn btn-primary" onClick={saveNewPost} type="button" disabled={!newText.trim()}>Сохранить в черновики →</button>
            </div>
          </div>
        )}

        {/* КОНТЕНТ-ПЛАН */}
        {tab === "plan" && (
          <div className="card ct-card">
            <div className="ct-hint">👉 Сгенерируйте план публикаций на неделю. Затем добавьте темы в черновики и распланируйте в календаре.</div>
            <div className="pw-row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, maxWidth: 340 }}>
                <label className="pw-label">Тема / ниша</label>
                <input className="input" value={planTopic} onChange={(e) => setPlanTopic(e.target.value)} placeholder="крипто, доставка еды…" />
              </div>
              <button className="btn btn-ai" onClick={genPlan} type="button"><IconSpark className="ico" /> Составить план</button>
            </div>
            {plan.length > 0 && (
              <>
                <table className="cw-plan__table" style={{ marginTop: 14 }}>
                  <thead><tr><th>День</th><th>Тема</th><th>Формат</th></tr></thead>
                  <tbody>{plan.map((it, i) => <tr key={i}><td>{it.day}</td><td>{it.theme}</td><td>{it.format}</td></tr>)}</tbody>
                </table>
                <div className="pw-row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={planToDrafts} type="button">Добавить в черновики →</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* КАЛЕНДАРЬ */}
        {tab === "calendar" && (
          <div className="card ct-card">
            <div className="ct-hint">👉 Перетаскивайте публикации между днями, задавайте время, канал и часовой пояс. Изменения сохраняются автоматически.</div>
            <Scheduler channel={channel} onChange={setPosts} />
          </div>
        )}

        {/* ЗАПЛАНИРОВАННЫЕ */}
        {tab === "scheduled" && (
          <div className="card ct-card">
            <div className="ct-hint">👉 Публикации, ожидающие выхода. Откройте «Календарь», чтобы изменить дату или время.</div>
            <PostList list={scheduled} empty="Запланированных публикаций нет." onOpen={() => setTab("calendar")} />
          </div>
        )}

        {/* ОПУБЛИКОВАННЫЕ */}
        {tab === "published" && (
          <div className="card ct-card">
            <div className="ct-hint">👉 Уже опубликованные посты.</div>
            <PostList list={published} empty="Опубликованных постов пока нет." onOpen={() => setTab("calendar")} />
          </div>
        )}
      </div>
    </>
  );

  function PostList({ list, empty, onOpen }: { list: ScheduledPost[]; empty: string; onOpen: () => void }) {
    if (list.length === 0) return <div className="ct-empty"><div>{empty}</div></div>;
    return (
      <div className="sc-list">
        {list.map((p) => (
          <div key={p.id} className="sc-listrow">
            <span className={`sc-dot ${STATUS_COLOR[p.status]}`} />
            <div className="sc-listrow__main">
              <b>{human(p.date)} · {p.time}</b>
              <span className="muted">{(p.text || "Без текста").slice(0, 48)} · {p.channel}</span>
            </div>
            <span className={`sc-badge ${STATUS_COLOR[p.status]}`}>{STATUS_LABELS[p.status]}</span>
            <button className="btn btn-sm" onClick={onOpen} type="button">Открыть в календаре</button>
          </div>
        ))}
      </div>
    );
  }
}
