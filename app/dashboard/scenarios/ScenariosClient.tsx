"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import {
  Scenario,
  loadScenarios,
  upsertScenario,
  deleteScenario,
  starterNodes,
  buildTemplate,
  uid,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  Template,
} from "@/lib/scenarios";

export default function ScenariosClient() {
  const router = useRouter();
  const [list, setList] = useState<Scenario[]>([]);
  const [creating, setCreating] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [name, setName] = useState("Тестовый сценарий");
  const [allChannels, setAllChannels] = useState(true);
  const [cat, setCat] = useState("Все");
  const [tab, setTab] = useState<"scenarios" | "reactions">("scenarios");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<string | null>(null);

  useEffect(() => setList(loadScenarios()), []);
  useEsc(creating, () => setCreating(false));
  useEsc(catalog, () => setCatalog(false));

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function create(fromTemplate?: Template) {
    const { nodes, edges } = fromTemplate ? buildTemplate(fromTemplate.id) : starterNodes();
    const s: Scenario = {
      id: uid("s"),
      name: fromTemplate ? fromTemplate.name : name.trim() || "Новый сценарий",
      allChannels,
      published: false,
      nodes,
      edges,
      updatedAt: Date.now(),
    };
    upsertScenario(s);
    router.push(`/dashboard/scenarios/${s.id}`);
  }

  function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Удалить сценарий?")) return;
    deleteScenario(id);
    setList(loadScenarios());
  }

  const templates = cat === "Все" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat);
  const filtered = list.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Topbar crumbs={["Основной проект", "Сценарии"]} />
      <div className="content" style={{ maxWidth: 1280 }}>
        {/* Вкладки + основные кнопки */}
        <div className="scn-head">
          <div className="tabs" style={{ border: 0, margin: 0 }}>
            <button className={`tab${tab === "scenarios" ? " active" : ""}`} onClick={() => setTab("scenarios")}>
              Сценарии
            </button>
            <button className={`tab${tab === "reactions" ? " active" : ""}`} onClick={() => setTab("reactions")}>
              Реакции
            </button>
          </div>
          <div className="row">
            <button className="btn btn-blue" onClick={() => setCreating(true)}>
              + Создать сценарий
            </button>
            <button className="btn btn-primary" onClick={() => setCatalog(true)}>
              ⚙ Использовать шаблон
            </button>
          </div>
        </div>

        {/* Панель инструментов */}
        <div className="scn-toolbar">
          <div className="scn-search">
            <span className="scn-search__ico">🔍</span>
            <input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn" style={{ position: "relative" }} onClick={() => alert("Демо: создание папки")}>
              📁 Создать папку
              <span className="scn-new">новое</span>
            </button>
            <button className="btn" onClick={() => {
              setList((cur) => {
                const next = cur.map((s) => ({ ...s, published: true }));
                next.forEach(upsertScenario);
                return next;
              });
            }}>
              🌐 Опубликовать сценарии
            </button>
          </div>
        </div>

        {tab === "reactions" ? (
          <div className="card scn-empty">
            <div className="scn-empty__ico">⚡</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Реакций пока нет</div>
            <p className="muted" style={{ maxWidth: 420, margin: 0 }}>
              Реакции — быстрые ответы бота на отдельные события. Раздел появится в
              следующей итерации.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card scn-empty">
            <div className="scn-empty__ico">🧩</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {list.length === 0 ? "Список сценариев пуст" : "Ничего не найдено"}
            </div>
            {list.length === 0 && (
              <div className="row">
                <button className="btn btn-blue" onClick={() => setCreating(true)}>+ Создать сценарий</button>
                <button className="btn btn-primary" onClick={() => setCatalog(true)}>Использовать шаблон</button>
              </div>
            )}
          </div>
        ) : (
          <div className="scn-table-wrap">
            <table className="scn-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}></th>
                  <th>Название</th>
                  <th>В работе</th>
                  <th>Статус</th>
                  <th>Каналы</th>
                  <th>Дата изменения</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} onClick={() => router.push(`/dashboard/scenarios/${s.id}`)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" />
                    </td>
                    <td className="scn-name">{s.name}</td>
                    <td className="scn-work">
                      <div><span className="dot on" /> Включён в опубликованной версии проекта</div>
                      <div><span className="dot on" /> Включён в неопубликованной версии проекта</div>
                    </td>
                    <td>
                      {s.published ? (
                        <span className="scn-status pub"><span className="dot on" /> Сценарий опубликован</span>
                      ) : (
                        <span className="scn-status draft"><span className="dot warn" /> Есть неопубликованные изменения</span>
                      )}
                    </td>
                    <td className="muted">{s.allChannels ? "Все" : "—"}</td>
                    <td className="muted">{fmtDate(s.updatedAt)}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
                      <button className="scn-kebab" onClick={() => setMenu(menu === s.id ? null : s.id)}>⋮</button>
                      {menu === s.id && (
                        <div className="scn-menu" onMouseLeave={() => setMenu(null)}>
                          <div className="scn-menu__item" onClick={() => router.push(`/dashboard/scenarios/${s.id}`)}>Открыть</div>
                          <div className="scn-menu__item danger" onClick={(e) => { remove(s.id, e); setMenu(null); }}>Удалить</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Модалка создания */}
      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <b>Создание сценария</b>
              <button className="fn__x dark" onClick={() => setCreating(false)}>✕</button>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label className="label">Название</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="label">Список каналов</label>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Подключить все каналы к сценарию</span>
                <button className="toggle" data-on={allChannels} onClick={() => setAllChannels((v) => !v)} />
              </div>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button className="btn" onClick={() => setCreating(false)}>Отменить</button>
              <button className="btn btn-primary" onClick={() => create()}>Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* Каталог шаблонов */}
      {catalog && (
        <div className="modal-overlay" onClick={() => setCatalog(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head" style={{ marginBottom: 16 }}>
              <b>Каталог шаблонов</b>
              <button className="fn__x dark" onClick={() => setCatalog(false)}>✕</button>
            </div>
            <div className="tpl-cats">
              {TEMPLATE_CATEGORIES.map((c) => (
                <button key={c} className={`tpl-cat${cat === c ? " on" : ""}`} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className="tpl-grid">
              {templates.map((t) => (
                <div key={t.id} className="tpl-card">
                  <div className="tpl-card__top">
                    <div className="tpl-card__emoji">{t.emoji}</div>
                    <h4>{t.name}</h4>
                  </div>
                  <p>{t.description}</p>
                  <div className="tpl-card__foot">
                    <button className="btn btn-primary" style={{ padding: "7px 14px" }} onClick={() => create(t)}>
                      Использовать
                    </button>
                    <span className="tpl-uses">👁 {t.uses}</span>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <p className="muted">В этой категории пока нет шаблонов.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
