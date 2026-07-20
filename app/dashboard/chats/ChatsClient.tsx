"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import {
  TgChat,
  TgRole,
  loadChats,
  parseChats,
  setParticipantRole,
  CHAT_TYPE_LABELS,
  CHAT_TYPE_ICON,
} from "@/lib/tgchats";
import {
  Member,
  Role,
  ROLE_LABELS,
  ROLE_HINTS,
  loadTeam,
  addMember,
  updateMember,
  removeMember,
  currentMember,
  getCurrentId,
  setCurrentId,
  canSeeAll,
  canManage,
  memberCanSeeChat,
  toggleChatAccess,
} from "@/lib/team";

type DetailTab = "messages" | "participants" | "access";

export default function ChatsClient() {
  const [chats, setChats] = useState<TgChat[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [viewerId, setViewerId] = useState("me");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("messages");
  const [q, setQ] = useState("");
  const [parsing, setParsing] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  // Форма добавления участника команды.
  const [nName, setNName] = useState("");
  const [nUser, setNUser] = useState("");
  const [nRole, setNRole] = useState<Role>("operator");

  useEffect(() => {
    setChats(loadChats());
    setTeam(loadTeam());
    setViewerId(getCurrentId());
  }, []);

  useEsc(teamOpen, () => setTeamOpen(false));

  const viewer = useMemo(() => currentMember(team.length ? team : [{ id: "me", name: "Вы", role: "owner", chatAccess: [], addedAt: 0 } as Member]), [team, viewerId]);
  const manage = canManage(viewer.role);

  const visibleChats = useMemo(
    () => chats.filter((c) => memberCanSeeChat(viewer, c.id)),
    [chats, viewer]
  );
  const filtered = visibleChats.filter(
    (c) => !q || c.title.toLowerCase().includes(q.toLowerCase()) || (c.username || "").toLowerCase().includes(q.toLowerCase())
  );

  const chat = chats.find((c) => c.id === selected) || null;
  // Если выбранный чат стал недоступен текущему зрителю — сбросить выбор.
  useEffect(() => {
    if (selected && !visibleChats.some((c) => c.id === selected)) setSelected(null);
  }, [visibleChats, selected]);

  function runParse() {
    if (!manage) return;
    setParsing(true);
    // Имитация запроса к Telegram Bot API.
    setTimeout(() => {
      const res = parseChats();
      setChats(res);
      setSelected(res[0]?.id ?? null);
      setParsing(false);
    }, 900);
  }

  function switchViewer(id: string) {
    setViewerId(id);
    setCurrentId(id);
    setTeam(loadTeam());
  }

  function promote(userId: string, to: TgRole) {
    if (!chat || !manage) return;
    setParticipantRole(chat.id, userId, to);
    setChats(loadChats());
  }

  function toggleAccess(memberId: string) {
    if (!chat || !manage) return;
    toggleChatAccess(memberId, chat.id);
    setTeam(loadTeam());
  }

  function saveRole(id: string, role: Role) {
    updateMember(id, { role });
    setTeam(loadTeam());
  }

  function addTeamMember() {
    const name = nName.trim();
    if (!name) return;
    addMember({ name, username: nUser.trim() || undefined, role: nRole, chatAccess: [] });
    setTeam(loadTeam());
    setNName("");
    setNUser("");
    setNRole("operator");
  }

  function delMember(id: string) {
    if (id === "me") return;
    if (!confirm("Удалить участника из команды?")) return;
    removeMember(id);
    setTeam(loadTeam());
    setViewerId(getCurrentId());
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  const tgBadge = (r: TgRole) =>
    r === "creator" ? "👑 Создатель" : r === "administrator" ? "🛡️ Админ" : "Участник";

  return (
    <>
      <Topbar crumbs={["Основной проект", "Чаты"]} />
      <div className="content" style={{ maxWidth: 1280 }}>
        <div className="chats-head">
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Чаты</h1>
            <p className="muted" style={{ margin: 0 }}>
              Парсинг Telegram-чатов, роли и доступы. Владелец и админ видят все чаты,
              оператор — только открытые ему.
            </p>
          </div>
          <div className="chats-head__actions">
            <label className="viewer-select" title="Смотреть кабинет от лица участника">
              <span>👁 Просмотр:</span>
              <select value={viewerId} onChange={(e) => switchViewer(e.target.value)}>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {ROLE_LABELS[m.role]}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" onClick={() => setTeamOpen(true)}>
              👥 Команда
            </button>
            <button className="btn btn-blue" onClick={runParse} disabled={!manage || parsing}>
              {parsing ? "Парсинг…" : chats.length ? "🔄 Обновить парсинг" : "🔄 Запустить парсинг"}
            </button>
          </div>
        </div>

        {chats.length === 0 ? (
          <div className="card scn-empty">
            <div className="scn-empty__ico">💬</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Чаты ещё не спарсены</div>
            <p className="muted" style={{ maxWidth: 480, margin: 0 }}>
              Запустите парсинг — сервис соберёт чаты, участников и сообщения. Для боевого
              режима подключите токен бота на вкладке «Каналы»; парсинг пойдёт через
              Telegram Bot API.
            </p>
            <button className="btn btn-blue" onClick={runParse} disabled={!manage || parsing}>
              {parsing ? "Парсинг…" : "🔄 Запустить парсинг"}
            </button>
            {!manage && <p className="muted" style={{ fontSize: 12 }}>Парсинг доступен владельцу и админу.</p>}
          </div>
        ) : (
          <div className="chats-layout">
            {/* Список чатов */}
            <div className="chats-list">
              <div className="chats-search">
                <span>🔍</span>
                <input placeholder="Поиск чата" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {filtered.length === 0 ? (
                <div className="chats-empty-side">
                  {visibleChats.length === 0
                    ? "Вам пока не открыт ни один чат. Обратитесь к администратору."
                    : "Ничего не найдено."}
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    className={`chat-item${selected === c.id ? " on" : ""}`}
                    onClick={() => { setSelected(c.id); setTab("messages"); }}
                  >
                    <span className="chat-item__ava">{CHAT_TYPE_ICON[c.type]}</span>
                    <span className="chat-item__body">
                      <span className="chat-item__title">{c.title}</span>
                      <span className="chat-item__last">
                        {c.messages.length ? c.messages[c.messages.length - 1].text : "Нет сообщений"}
                      </span>
                    </span>
                    <span className="chat-item__meta">{c.membersCount}👤</span>
                  </button>
                ))
              )}
            </div>

            {/* Детали чата */}
            <div className="chat-detail">
              {!chat ? (
                <div className="chat-detail__empty">Выберите чат слева</div>
              ) : (
                <>
                  <div className="chat-detail__head">
                    <div className="chat-item__ava lg">{CHAT_TYPE_ICON[chat.type]}</div>
                    <div>
                      <div className="chat-detail__title">{chat.title}</div>
                      <div className="chat-detail__sub">
                        {CHAT_TYPE_LABELS[chat.type]} · {chat.membersCount} участников
                        {chat.username ? ` · ${chat.username}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="tabs chat-tabs">
                    <button className={`tab${tab === "messages" ? " active" : ""}`} onClick={() => setTab("messages")}>
                      Сообщения
                    </button>
                    <button className={`tab${tab === "participants" ? " active" : ""}`} onClick={() => setTab("participants")}>
                      Участники · {chat.participants.length}
                    </button>
                    {manage && (
                      <button className={`tab${tab === "access" ? " active" : ""}`} onClick={() => setTab("access")}>
                        Доступ
                      </button>
                    )}
                  </div>

                  {tab === "messages" && (
                    <div className="chat-msgs">
                      {chat.messages.map((m) => (
                        <div key={m.id} className={`msg${m.out ? " out" : ""}`}>
                          {!m.out && <div className="msg__from">{m.from}</div>}
                          <div className="msg__bubble">{m.text}</div>
                          <div className="msg__time">{fmtTime(m.ts)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "participants" && (
                    <div className="part-list">
                      {chat.participants.map((p) => (
                        <div className="part-row" key={p.id}>
                          <div className="part-ava">{p.name.slice(0, 1)}</div>
                          <div className="part-body">
                            <div className="part-name">{p.name}</div>
                            <div className="part-user">{p.username}</div>
                          </div>
                          <span className={`tg-badge ${p.tgRole}`}>{tgBadge(p.tgRole)}</span>
                          {manage && p.tgRole !== "creator" && (
                            p.tgRole === "administrator" ? (
                              <button className="btn btn-sm" onClick={() => promote(p.id, "member")}>Снять админа</button>
                            ) : (
                              <button className="btn btn-sm btn-primary" onClick={() => promote(p.id, "administrator")}>Сделать админом</button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "access" && manage && (
                    <div className="access-list">
                      <p className="muted" style={{ marginTop: 0 }}>
                        Кому открыт этот чат. Владелец и админ видят все чаты; оператору
                        доступ выдаётся точечно.
                      </p>
                      {team.map((m) => {
                        const all = canSeeAll(m.role);
                        const has = all || m.chatAccess.includes(chat.id);
                        return (
                          <div className="access-row" key={m.id}>
                            <div className="part-ava">{m.name.slice(0, 1)}</div>
                            <div className="part-body">
                              <div className="part-name">{m.name}</div>
                              <div className="part-user">{ROLE_LABELS[m.role]}{m.username ? ` · ${m.username}` : ""}</div>
                            </div>
                            {all ? (
                              <span className="access-always">✓ Видит все чаты</span>
                            ) : (
                              <button
                                className={`toggle`}
                                data-on={has}
                                onClick={() => toggleAccess(m.id)}
                                title={has ? "Закрыть доступ" : "Открыть доступ"}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Модалка «Команда и доступы» */}
      {teamOpen && (
        <div className="modal-overlay" onClick={() => setTeamOpen(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal__head" style={{ marginBottom: 8 }}>
              <b>Команда и доступы</b>
              <button className="fn__x dark" onClick={() => setTeamOpen(false)}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Роли определяют, что человек видит. Роль «Оператор» — доступ к чатам выдаётся
              на вкладке «Доступ» внутри чата.
            </p>

            <div className="team-list">
              {team.map((m) => (
                <div className="team-row" key={m.id}>
                  <div className="part-ava">{m.name.slice(0, 1)}</div>
                  <div className="part-body">
                    <div className="part-name">{m.name}{m.id === "me" ? " (вы)" : ""}</div>
                    <div className="part-user">{m.username || "—"} · {ROLE_HINTS[m.role]}</div>
                  </div>
                  {m.role === "owner" ? (
                    <span className="tg-badge creator">👑 Владелец</span>
                  ) : (
                    <select className="role-select" value={m.role} onChange={(e) => saveRole(m.id, e.target.value as Role)}>
                      <option value="admin">Администратор</option>
                      <option value="operator">Оператор</option>
                    </select>
                  )}
                  {m.id !== "me" && (
                    <button className="scn-kebab" title="Удалить" onClick={() => delMember(m.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>

            <div className="team-add">
              <div className="team-add__title">Добавить в команду</div>
              <div className="team-add__row">
                <input className="input" placeholder="Имя" value={nName} onChange={(e) => setNName(e.target.value)} />
                <input className="input" placeholder="@username" value={nUser} onChange={(e) => setNUser(e.target.value)} />
                <select className="role-select" value={nRole} onChange={(e) => setNRole(e.target.value as Role)}>
                  <option value="admin">Администратор</option>
                  <option value="operator">Оператор</option>
                </select>
                <button className="btn btn-primary" onClick={addTeamMember} disabled={!nName.trim()}>Добавить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
