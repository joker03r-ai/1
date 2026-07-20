"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import {
  Scenario,
  ScenarioFolder,
  loadScenarios,
  upsertScenario,
  deleteScenario,
  loadFolders,
  addFolder,
  deleteFolder,
  moveScenarioToFolder,
  starterNodes,
  buildTemplate,
  uid,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  Template,
} from "@/lib/scenarios";

const AI_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Заявки и продажи",
    items: [
      "Бот собирает заявки на вебинар, сохраняет телефон и пишет менеджеру",
      "Приём заказа: спрашивает товар и контакт, отправляет в Google Таблицу",
    ],
  },
  {
    label: "Вовлечение",
    items: [
      "Викторина из 3 вопросов с начислением баллов и результатом",
      "Выдаёт бонус за подписку на канал",
    ],
  },
  {
    label: "Поддержка",
    items: [
      "Отвечает на частые вопросы по нашему магазину в режиме AI",
      "Консультант, который передаёт сложные вопросы менеджеру",
    ],
  },
];

const LOADING_STEPS = [
  "Разбираю запрос…",
  "Подбираю блоки…",
  "Собираю схему…",
  "Расставляю связи…",
];

export default function ScenariosClient() {
  const router = useRouter();
  const [list, setList] = useState<Scenario[]>([]);
  const [folders, setFolders] = useState<ScenarioFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all"); // "all" | folderId | "none"
  const [creating, setCreating] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [name, setName] = useState("Новый сценарий");
  const [allChannels, setAllChannels] = useState(true);
  const [cat, setCat] = useState("Все");
  const [tab, setTab] = useState<"scenarios" | "reactions">("scenarios");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<string | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    setList(loadScenarios());
    setFolders(loadFolders());
  }, []);
  useEsc(creating, () => setCreating(false));
  useEsc(catalog, () => setCatalog(false));
  useEsc(folderModal, () => setFolderModal(false));
  useEsc(aiOpen, () => !aiLoading && setAiOpen(false));

  // Анимация статуса во время генерации.
  useEffect(() => {
    if (!aiLoading) return;
    setAiStep(0);
    const t = setInterval(() => setAiStep((s) => (s + 1) % LOADING_STEPS.length), 1100);
    return () => clearInterval(t);
  }, [aiLoading]);

  async function generateAI() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.nodes)) {
        throw new Error(data.error || "Не удалось собрать сценарий");
      }
      const s: Scenario = {
        id: uid("s"),
        name: data.name || "Сценарий от ИИ",
        allChannels: true,
        published: false,
        nodes: data.nodes,
        edges: data.edges || [],
        updatedAt: Date.now(),
        folderId: activeFolder !== "all" && activeFolder !== "none" ? activeFolder : undefined,
      };
      upsertScenario(s);
      router.push(`/dashboard/scenarios/${s.id}`);
    } catch (e: any) {
      setAiError(e?.message || "Ошибка генерации");
      setAiLoading(false);
    }
  }

  function onAiKey(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generateAI();
  }

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
      folderId: activeFolder !== "all" && activeFolder !== "none" ? activeFolder : undefined,
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

  function createFolder() {
    const nm = folderName.trim();
    if (!nm) return;
    addFolder(nm);
    setFolders(loadFolders());
    setFolderName("");
    setFolderModal(false);
  }

  function removeFolder(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const f = folders.find((x) => x.id === id);
    if (!confirm(`Удалить папку «${f?.name}»? Сценарии останутся в списке.`)) return;
    deleteFolder(id);
    setFolders(loadFolders());
    setList(loadScenarios());
    if (activeFolder === id) setActiveFolder("all");
  }

  function moveTo(scenarioId: string, folderId?: string) {
    moveScenarioToFolder(scenarioId, folderId);
    setList(loadScenarios());
    setMenu(null);
  }

  const ungroupedCount = list.filter((s) => !s.folderId).length;
  const countFor = (fid: string) => list.filter((s) => s.folderId === fid).length;

  const filtered = list.filter((s) => {
    if (activeFolder === "none" && s.folderId) return false;
    if (activeFolder !== "all" && activeFolder !== "none" && s.folderId !== activeFolder) return false;
    return !q || s.name.toLowerCase().includes(q.toLowerCase());
  });

  const templates = cat === "Все" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat);

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
          <div className="scn-actions">
            <button className="btn btn-ai" onClick={() => setAiOpen(true)}>
              ✨ Собрать ИИ
            </button>
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
            <input placeholder="Поиск сценария" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="scn-actions">
            <button className="btn" style={{ position: "relative" }} onClick={() => setFolderModal(true)}>
              📁 Создать папку
              {folders.length === 0 && <span className="scn-new">новое</span>}
            </button>
            <button
              className="btn"
              onClick={() => {
                const next = list.map((s) => ({ ...s, published: true }));
                next.forEach(upsertScenario);
                setList(next);
              }}
            >
              🌐 Опубликовать сценарии
            </button>
          </div>
        </div>

        {/* Папки-фильтры */}
        {tab === "scenarios" && folders.length > 0 && (
          <div className="scn-folders">
            <button
              className={`scn-folder-chip${activeFolder === "all" ? " on" : ""}`}
              onClick={() => setActiveFolder("all")}
            >
              Все <span className="scn-folder-count">{list.length}</span>
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                className={`scn-folder-chip${activeFolder === f.id ? " on" : ""}`}
                onClick={() => setActiveFolder(f.id)}
                title={f.name}
              >
                📁 {f.name} <span className="scn-folder-count">{countFor(f.id)}</span>
                <span className="scn-folder-chip__x" onClick={(e) => removeFolder(f.id, e)} title="Удалить папку">
                  ✕
                </span>
              </button>
            ))}
            {ungroupedCount > 0 && (
              <button
                className={`scn-folder-chip${activeFolder === "none" ? " on" : ""}`}
                onClick={() => setActiveFolder("none")}
              >
                Без папки <span className="scn-folder-count">{ungroupedCount}</span>
              </button>
            )}
          </div>
        )}

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
                <button className="btn btn-ai" onClick={() => setAiOpen(true)}>✨ Собрать ИИ</button>
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
                {filtered.map((s) => {
                  const folder = folders.find((f) => f.id === s.folderId);
                  return (
                    <tr key={s.id} onClick={() => router.push(`/dashboard/scenarios/${s.id}`)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" />
                      </td>
                      <td className="scn-name">
                        {s.name}
                        {folder && <span className="scn-folder-tag">📁 {folder.name}</span>}
                      </td>
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
                            <div className="scn-menu__label">Переместить в папку</div>
                            {folders.length === 0 && (
                              <div className="scn-menu__hint">Сначала создайте папку</div>
                            )}
                            {folders.map((f) => (
                              <div
                                key={f.id}
                                className={`scn-menu__item${s.folderId === f.id ? " current" : ""}`}
                                onClick={() => moveTo(s.id, f.id)}
                              >
                                📁 {f.name}{s.folderId === f.id ? " ✓" : ""}
                              </div>
                            ))}
                            {s.folderId && (
                              <div className="scn-menu__item" onClick={() => moveTo(s.id, undefined)}>Убрать из папки</div>
                            )}
                            <div className="scn-menu__sep" />
                            <div className="scn-menu__item danger" onClick={(e) => { remove(s.id, e); setMenu(null); }}>Удалить</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI-генератор сценария */}
      {aiOpen && (
        <div className="modal-overlay" onClick={() => !aiLoading && setAiOpen(false)}>
          <div className="modal ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal__hero">
              <button className="ai-modal__x" onClick={() => !aiLoading && setAiOpen(false)}>✕</button>
              <div className="ai-modal__spark">✨</div>
              <div>
                <div className="ai-modal__title">Собрать сценарий с ИИ</div>
                <div className="ai-modal__sub">Опишите бота словами — нейросеть соберёт готовую схему из блоков и откроет её в редакторе.</div>
              </div>
            </div>

            <div className="ai-modal__body">
              {aiLoading ? (
                <div className="ai-loading">
                  <div className="ai-loading__spinner" />
                  <div className="ai-loading__text">{LOADING_STEPS[aiStep]}</div>
                  <div className="ai-loading__bar"><span /></div>
                </div>
              ) : (
                <>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 110 }}
                    placeholder="Например: бот записывает на бесплатную консультацию — спрашивает имя и телефон, сохраняет в Google Таблицу и пишет менеджеру"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={onAiKey}
                    autoFocus
                  />
                  <div className="ai-tips">
                    💡 Укажите: <b>цель бота</b> · <b>что спросить</b> у клиента · <b>куда сохранить</b> · <b>кому уведомление</b>
                  </div>

                  {AI_GROUPS.map((g) => (
                    <div className="ai-group" key={g.label}>
                      <div className="ai-group__label">{g.label}</div>
                      <div className="ai-examples">
                        {g.items.map((ex) => (
                          <button key={ex} className="ai-chip" onClick={() => setAiPrompt(ex)}>
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {aiError && <div className="ai-error">⚠ {aiError}</div>}
                </>
              )}
            </div>

            <div className="ai-modal__foot">
              <span className="ai-hint">С ключом Claude схему собирает нейросеть, без ключа — встроенный сборщик.</span>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn" onClick={() => setAiOpen(false)} disabled={aiLoading}>Отменить</button>
                <button className="btn btn-ai" onClick={generateAI} disabled={aiLoading || !aiPrompt.trim()}>
                  {aiLoading ? "Собираю…" : "✨ Собрать сценарий"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка создания папки */}
      {folderModal && (
        <div className="modal-overlay" onClick={() => setFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <b>Новая папка</b>
              <button className="fn__x dark" onClick={() => setFolderModal(false)}>✕</button>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label className="label">Название папки</label>
              <input
                className="input"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
                placeholder="Например: Продажи"
                autoFocus
              />
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button className="btn" onClick={() => setFolderModal(false)}>Отменить</button>
              <button className="btn btn-primary" onClick={createFolder} disabled={!folderName.trim()}>Создать папку</button>
            </div>
          </div>
        </div>
      )}

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
