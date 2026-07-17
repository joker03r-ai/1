"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
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

  useEffect(() => setList(loadScenarios()), []);

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

  return (
    <>
      <Topbar crumbs={["Основной проект", "Сценарии"]} />
      <div className="content">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Сценарии</h1>
            <p className="muted" style={{ margin: 0 }}>
              Графические сценарии диалога из блоков. Начните с нуля или возьмите шаблон.
            </p>
          </div>
          <div className="row">
            <button className="btn" onClick={() => setCatalog(true)}>
              ⚡ Использовать шаблон
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Создать сценарий
            </button>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="card scn-empty">
            <div className="scn-empty__ico">🧩</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Список сценариев пуст</div>
            <p className="muted" style={{ maxWidth: 420, margin: 0 }}>
              Создайте первый сценарий, чтобы бот реагировал на события пользователя
              цепочками действий.
            </p>
            <div className="row">
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                + Создать сценарий
              </button>
              <button className="btn" onClick={() => setCatalog(true)}>
                Использовать шаблон
              </button>
            </div>
          </div>
        ) : (
          <div className="scn-list">
            {list.map((s) => (
              <div key={s.id} className="card scn-item" onClick={() => router.push(`/dashboard/scenarios/${s.id}`)}>
                <div className="scn-item__ico">🧩</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {s.nodes.length} блоков · {s.edges.length} связей ·{" "}
                    {s.allChannels ? "все каналы" : "без каналов"}
                  </div>
                </div>
                <span className={`scn-badge ${s.published ? "pub" : "draft"}`}>
                  {s.published ? "опубликован" : "черновик"}
                </span>
                <button className="btn" onClick={(e) => remove(s.id, e)} style={{ padding: "6px 10px" }}>
                  🗑
                </button>
              </div>
            ))}
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
