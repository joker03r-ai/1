"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import {
  TgChat,
  TgRole,
  loadChats,
  saveChats,
  parseChats,
  setParticipantRole,
  loadToken,
  saveToken,
  clearToken,
  MtSession,
  loadMt,
  saveMt,
  clearMt,
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

  // Подключение реального Telegram-бота.
  const [token, setToken] = useState("");
  const [botName, setBotName] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState("");
  const [banner, setBanner] = useState("");

  // Парсер публичных каналов (MTProto, аккаунт).
  const [mt, setMt] = useState<MtSession | null>(null);
  const [mtOpen, setMtOpen] = useState(false);
  const [mtStep, setMtStep] = useState<"creds" | "code" | "channels">("creds");
  const [mApiId, setMApiId] = useState("");
  const [mApiHash, setMApiHash] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mCode, setMCode] = useState("");
  const [mPass, setMPass] = useState("");
  const [mNeedPass, setMNeedPass] = useState(false);
  const [mHash, setMHash] = useState("");
  const [mSess, setMSess] = useState("");
  const [mChannels, setMChannels] = useState("");
  const [mBusy, setMBusy] = useState(false);
  const [mErr, setMErr] = useState("");

  // Форма добавления участника команды.
  const [nName, setNName] = useState("");
  const [nUser, setNUser] = useState("");
  const [nRole, setNRole] = useState<Role>("operator");

  useEffect(() => {
    setChats(loadChats());
    setTeam(loadTeam());
    setViewerId(getCurrentId());
    setToken(loadToken());
    const saved = loadMt();
    setMt(saved);
    if (saved) {
      setMApiId(saved.apiId);
      setMApiHash(saved.apiHash);
      setMSess(saved.session);
      setMtStep("channels");
    }
  }, []);

  useEsc(teamOpen, () => setTeamOpen(false));
  useEsc(connectOpen, () => !connecting && setConnectOpen(false));
  useEsc(mtOpen, () => !mBusy && setMtOpen(false));

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

  async function runParse() {
    if (!manage) return;
    setBanner("");
    setParsing(true);
    if (token) {
      // Реальный парсинг через Telegram Bot API.
      try {
        const res = await fetch("/api/telegram/parse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка парсинга");
        const list: TgChat[] = data.chats || [];
        saveChats(list);
        setChats(list);
        setSelected(list[0]?.id ?? null);
        setBotName(data.bot?.username ? "@" + data.bot.username : "");
        setBanner(data.note || (list.length ? `Готово: спарсено чатов — ${list.length}.` : ""));
      } catch (e: any) {
        setBanner("⚠ " + (e?.message || "Не удалось спарсить. Проверьте токен и что бот добавлен в чаты."));
      } finally {
        setParsing(false);
      }
      return;
    }
    // Демо-режим (без токена).
    setTimeout(() => {
      const res = parseChats();
      setChats(res);
      setSelected(res[0]?.id ?? null);
      setBanner("Демо-данные. Подключите токен бота, чтобы парсить реальные чаты Telegram.");
      setParsing(false);
    }, 700);
  }

  async function connectBot() {
    const t = tokenInput.trim();
    if (!t) return;
    setConnecting(true);
    setConnectErr("");
    try {
      const res = await fetch("/api/telegram/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const data = await res.json();
      // Токен валиден, если Telegram вернул имя бота (даже когда чатов пока нет).
      if (!data.bot && !res.ok) throw new Error(data.error || "Токен не принят");
      saveToken(t);
      setToken(t);
      setBotName(data.bot?.username ? "@" + data.bot.username : "");
      if (Array.isArray(data.chats)) {
        saveChats(data.chats);
        setChats(data.chats);
        setSelected(data.chats[0]?.id ?? null);
      }
      setBanner(data.note || (data.chats?.length ? `Подключено. Спарсено чатов — ${data.chats.length}.` : "Бот подключён."));
      setConnectOpen(false);
      setTokenInput("");
    } catch (e: any) {
      setConnectErr(e?.message || "Не удалось подключить бота");
    } finally {
      setConnecting(false);
    }
  }

  function disconnectBot() {
    if (!confirm("Отключить бота? Токен будет удалён из этого браузера.")) return;
    clearToken();
    setToken("");
    setBotName("");
    setBanner("");
  }

  function openMt() {
    setMErr("");
    const saved = loadMt();
    setMtStep(saved ? "channels" : "creds");
    setMtOpen(true);
  }

  async function mtSendCode() {
    setMErr("");
    setMBusy(true);
    try {
      const res = await fetch("/api/telegram/mtproto/send-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiId: mApiId, apiHash: mApiHash, phone: mPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setMHash(data.phoneCodeHash);
      setMSess(data.session);
      setMtStep("code");
    } catch (e: any) {
      setMErr(e?.message || "Не удалось отправить код");
    } finally {
      setMBusy(false);
    }
  }

  async function mtSignIn() {
    setMErr("");
    setMBusy(true);
    try {
      const res = await fetch("/api/telegram/mtproto/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiId: mApiId, apiHash: mApiHash, phone: mPhone,
          phoneCodeHash: mHash, code: mCode, password: mPass, session: mSess,
        }),
      });
      const data = await res.json();
      if (data.needPassword) {
        setMNeedPass(true);
        setMSess(data.session || mSess);
        setMErr("Введите пароль двухфакторной защиты");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Ошибка входа");
      const saved: MtSession = { apiId: mApiId, apiHash: mApiHash, session: data.session, user: data.user?.username || data.user?.name };
      saveMt(saved);
      setMt(saved);
      setMSess(data.session);
      setMtStep("channels");
    } catch (e: any) {
      setMErr(e?.message || "Не удалось войти");
    } finally {
      setMBusy(false);
    }
  }

  async function mtParse() {
    setMErr("");
    const list = mChannels.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) { setMErr("Укажите хотя бы один канал"); return; }
    setMBusy(true);
    try {
      const res = await fetch("/api/telegram/mtproto/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiId: mApiId, apiHash: mApiHash, session: mSess, channels: list }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка парсинга");
      const list2: TgChat[] = data.chats || [];
      // Мержим с уже спарсенными (по id).
      const merged = [...list2, ...chats.filter((c) => !list2.some((n) => n.id === c.id))];
      saveChats(merged);
      setChats(merged);
      setSelected(list2[0]?.id ?? selected);
      setBanner(data.note || `Спарсено каналов: ${list2.length}.`);
      setMtOpen(false);
    } catch (e: any) {
      setMErr(e?.message || "Не удалось спарсить");
    } finally {
      setMBusy(false);
    }
  }

  function mtLogout() {
    if (!confirm("Выйти из аккаунта Telegram? Сессия будет удалена из браузера.")) return;
    clearMt();
    setMt(null);
    setMtStep("creds");
    setMSess("");
    setMNeedPass(false);
    setMCode("");
    setMPass("");
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
            {manage && (
              <button className="btn btn-ai" onClick={openMt}>
                🔎 Парсер каналов
              </button>
            )}
            <button className="btn btn-blue" onClick={runParse} disabled={!manage || parsing}>
              {parsing ? "Парсинг…" : chats.length ? "🔄 Обновить парсинг" : "🔄 Запустить парсинг"}
            </button>
          </div>
        </div>

        {/* Статус подключения Telegram */}
        {manage && (
          <div className={`tg-conn${token ? " live" : ""}`}>
            {token ? (
              <>
                <span className="tg-conn__dot" />
                <span>Реальный парсинг Telegram подключён{botName ? ` · ${botName}` : ""}</span>
                <button className="tg-conn__link" onClick={disconnectBot}>Отключить</button>
              </>
            ) : (
              <>
                <span>⚪ Демо-режим. Чтобы парсить реальные чаты Telegram — подключите токен бота.</span>
                <button className="tg-conn__link primary" onClick={() => { setConnectErr(""); setConnectOpen(true); }}>
                  Подключить Telegram
                </button>
              </>
            )}
          </div>
        )}
        {banner && <div className="tg-banner">{banner}</div>}

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

      {/* Модалка: парсер публичных каналов (MTProto) */}
      {mtOpen && (
        <div className="modal-overlay" onClick={() => !mBusy && setMtOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal__head">
              <b>🔎 Парсер каналов Telegram</b>
              <button className="fn__x dark" onClick={() => !mBusy && setMtOpen(false)}>✕</button>
            </div>

            {mtStep !== "channels" && (
              <>
                <p className="muted" style={{ marginTop: 10 }}>
                  Вход в Telegram по аккаунту — только так можно парсить любые публичные
                  каналы по ссылке. api_id и api_hash берутся на{" "}
                  <b>my.telegram.org</b> → API development tools.
                </p>
                <div className="tg-help">
                  ⚠ Вход даёт полный доступ к аккаунту. Сессия хранится в этом браузере.
                  Парсите только те каналы, где это разрешено правилами Telegram.
                </div>
              </>
            )}

            {mtStep === "creds" && (
              <>
                <div className="field" style={{ marginTop: 14 }}>
                  <label className="label">api_id</label>
                  <input className="input" value={mApiId} onChange={(e) => setMApiId(e.target.value)} placeholder="1234567" />
                </div>
                <div className="field">
                  <label className="label">api_hash</label>
                  <input className="input" value={mApiHash} onChange={(e) => setMApiHash(e.target.value)} placeholder="abcdef0123456789..." />
                </div>
                <div className="field">
                  <label className="label">Телефон аккаунта</label>
                  <input className="input" value={mPhone} onChange={(e) => setMPhone(e.target.value)} placeholder="+79001234567" />
                </div>
                {mErr && <div className="ai-error">⚠ {mErr}</div>}
                <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button className="btn" onClick={() => setMtOpen(false)} disabled={mBusy}>Отменить</button>
                  <button className="btn btn-primary" onClick={mtSendCode} disabled={mBusy || !mApiId || !mApiHash || !mPhone}>
                    {mBusy ? "Отправляю…" : "Получить код"}
                  </button>
                </div>
              </>
            )}

            {mtStep === "code" && (
              <>
                <div className="field" style={{ marginTop: 14 }}>
                  <label className="label">Код из Telegram</label>
                  <input className="input" value={mCode} onChange={(e) => setMCode(e.target.value)} placeholder="12345" autoFocus />
                </div>
                {mNeedPass && (
                  <div className="field">
                    <label className="label">Пароль двухфакторной защиты</label>
                    <input className="input" type="password" value={mPass} onChange={(e) => setMPass(e.target.value)} />
                  </div>
                )}
                {mErr && <div className="ai-error">⚠ {mErr}</div>}
                <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button className="btn" onClick={() => setMtStep("creds")} disabled={mBusy}>Назад</button>
                  <button className="btn btn-primary" onClick={mtSignIn} disabled={mBusy || !mCode}>
                    {mBusy ? "Вхожу…" : "Войти"}
                  </button>
                </div>
              </>
            )}

            {mtStep === "channels" && (
              <>
                <div className="tg-conn live" style={{ marginTop: 12 }}>
                  <span className="tg-conn__dot" />
                  <span>Аккаунт подключён{mt?.user ? ` · ${mt.user.startsWith("@") ? mt.user : "@" + mt.user}` : ""}</span>
                  <button className="tg-conn__link" onClick={mtLogout}>Выйти</button>
                </div>
                <div className="field" style={{ marginTop: 8 }}>
                  <label className="label">Каналы (ссылки или @username, по одному в строке)</label>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 110 }}
                    value={mChannels}
                    onChange={(e) => setMChannels(e.target.value)}
                    placeholder={"@durov\nhttps://t.me/telegram\nmyshopchat"}
                    autoFocus
                  />
                </div>
                <div className="tg-help">
                  Парсятся сообщения и (где доступно) участники. Список участников
                  каналов Telegram скрывает — он придёт только для групп, где вы админ.
                </div>
                {mErr && <div className="ai-error">⚠ {mErr}</div>}
                <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button className="btn" onClick={() => setMtOpen(false)} disabled={mBusy}>Закрыть</button>
                  <button className="btn btn-ai" onClick={mtParse} disabled={mBusy || !mChannels.trim()}>
                    {mBusy ? "Парсинг…" : "🔎 Спарсить каналы"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Модалка подключения Telegram */}
      {connectOpen && (
        <div className="modal-overlay" onClick={() => !connecting && setConnectOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <b>Подключить Telegram</b>
              <button className="fn__x dark" onClick={() => !connecting && setConnectOpen(false)}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Вставьте токен бота от <b>@BotFather</b>. Сервис проверит его и начнёт парсить чаты.
            </p>
            <div className="field">
              <label className="label">Токен бота</label>
              <input
                className="input"
                placeholder="123456789:AA..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && connectBot()}
                autoFocus
              />
            </div>
            <div className="tg-help">
              ⚠ Telegram не даёт боту список всех чатов. Бот видит только те, куда его
              добавили администратором. Добавьте бота в нужную группу/канал и напишите
              туда сообщение — чат появится при парсинге.
            </div>
            {connectErr && <div className="ai-error">⚠ {connectErr}</div>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn" onClick={() => setConnectOpen(false)} disabled={connecting}>Отменить</button>
              <button className="btn btn-primary" onClick={connectBot} disabled={connecting || !tokenInput.trim()}>
                {connecting ? "Проверяю…" : "Подключить"}
              </button>
            </div>
          </div>
        </div>
      )}

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
