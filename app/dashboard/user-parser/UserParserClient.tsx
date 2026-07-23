"use client";

import { useEffect, useRef, useState } from "react";
import Topbar from "@/components/Topbar";
import { MtSession, loadMt, saveMt, clearMt } from "@/lib/tgchats";

type ParsedUser = { id: string; name: string; username: string; premium: boolean; hasPhoto: boolean; bot: boolean };
type FoundChat = { id: string; title: string; username: string; link: string; members: number; type: string; keyword: string };

const USER_FILTERS: { key: string; label: string; group: "base" | "profile" }[] = [
  { key: "skipBots", label: "Пропустить ботов", group: "base" },
  { key: "skipDeleted", label: "Пропустить удалённых", group: "base" },
  { key: "onlyUsername", label: "Только с юзернеймом", group: "profile" },
  { key: "onlyPhoto", label: "Только с фото", group: "profile" },
  { key: "onlyPremium", label: "Только Premium", group: "profile" },
];

// Простые AI-подсказки окончаний/комбинаций для ключевых слов.
const SUGGEST = ["новости", "чат", "россия", "2025", "2026", "official", "trade", "premium"];

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function UserParserClient() {
  const [mt, setMt] = useState<MtSession | null>(null);
  const [step, setStep] = useState<"creds" | "code" | "ready">("creds");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [needPass, setNeedPass] = useState(false);
  const [hash, setHash] = useState("");
  const [sess, setSess] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState<"users" | "chats" | "messages" | "warm">("chats");

  // Парсер пользователей
  const [chats, setChats] = useState("");
  const [uLimit, setULimit] = useState(1000);
  const [filters, setFilters] = useState<Record<string, boolean>>({ skipBots: true, skipDeleted: true, onlyUsername: false, onlyPhoto: false, onlyPremium: false });
  const [users, setUsers] = useState<ParsedUser[]>([]);
  const [uNote, setUNote] = useState("");
  const [uBusy, setUBusy] = useState(false);

  // Парсер чатов по ключевым словам
  const [kwInput, setKwInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [endings, setEndings] = useState<string[]>([]);
  const [endInput, setEndInput] = useState("");
  const [minM, setMinM] = useState(100);
  const [maxM, setMaxM] = useState(100000);
  const [cLimit, setCLimit] = useState(100);
  const [foundChats, setFoundChats] = useState<FoundChat[]>([]);
  const [cNote, setCNote] = useState("");
  const [cBusy, setCBusy] = useState(false);

  // Парсер по сообщениям (для чатов со скрытым списком участников)
  const [mmChats, setMmChats] = useState("");
  const [mmMsgLimit, setMmMsgLimit] = useState(1000);
  const [mmDays, setMmDays] = useState(30);
  const [mmKwInput, setMmKwInput] = useState("");
  const [mmKeywords, setMmKeywords] = useState<string[]>([]);
  const [mmProt, setMmProt] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [mmFilters, setMmFilters] = useState<Record<string, boolean>>({ skipBots: true, skipDeleted: true, skipScam: true, onlyUsername: false, onlyPhoto: false, onlyPremium: false, includeReplies: true, includeForwarded: false });
  const [mmUsers, setMmUsers] = useState<ParsedUser[]>([]);
  const [mmNote, setMmNote] = useState("");
  const [mmBusy, setMmBusy] = useState(false);

  // Прогрев аккаунтов
  const [wFrom, setWFrom] = useState(18);
  const [wTo, setWTo] = useState(19);
  const [wTz, setWTz] = useState("UTC+3 (Москва)");
  const [wBreaks, setWBreaks] = useState(true);
  const [wIntensity, setWIntensity] = useState<"careful" | "normal" | "aggressive">("careful");
  const [wAutoAdapt, setWAutoAdapt] = useState(true);
  const [wActHour, setWActHour] = useState(5);
  const [wActDay, setWActDay] = useState(15);
  const [wJoinDay, setWJoinDay] = useState(1);
  const [wMsgDay, setWMsgDay] = useState(3);
  const [wProgressive, setWProgressive] = useState(true);
  const [wSession, setWSession] = useState("30 мин");
  const [wActions, setWActions] = useState<Record<string, boolean>>({
    readChannels: true, viewProfiles: true, typing: true, polls: true, archive: true, mute: true,
    reactions: false, stories: false, joinGroups: false, dialogs: false, trust: false,
  });
  const [wTargets, setWTargets] = useState("");
  const [wRunning, setWRunning] = useState(false);
  const [wProgress, setWProgress] = useState(0);
  const [wLog, setWLog] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadMt();
    setMt(saved);
    if (saved) { setApiId(saved.apiId); setApiHash(saved.apiHash); setSess(saved.session); setStep("ready"); }
    try {
      const u = localStorage.getItem("sb_parsed_users"); if (u) setUsers(JSON.parse(u));
      const c = localStorage.getItem("sb_found_chats"); if (c) setFoundChats(JSON.parse(c));
      const mu = localStorage.getItem("sb_parsed_msg_users"); if (mu) setMmUsers(JSON.parse(mu));
    } catch {}
  }, []);

  async function sendCode() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/telegram/mtproto/send-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiId, apiHash, phone }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setHash(d.phoneCodeHash); setSess(d.session); setStep("code");
    } catch (e: any) { setErr(e?.message || "Не удалось отправить код"); }
    finally { setBusy(false); }
  }
  async function signIn() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/telegram/mtproto/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiId, apiHash, phone, phoneCodeHash: hash, code, password: pass, session: sess }) });
      const d = await r.json();
      if (d.needPassword) { setNeedPass(true); setSess(d.session || sess); setErr("Введите пароль двухфакторной защиты"); return; }
      if (!r.ok) throw new Error(d.error || "Ошибка входа");
      const saved: MtSession = { apiId, apiHash, session: d.session, user: d.user?.username || d.user?.name };
      saveMt(saved); setMt(saved); setSess(d.session); setStep("ready");
    } catch (e: any) { setErr(e?.message || "Не удалось войти"); }
    finally { setBusy(false); }
  }
  function logout() {
    if (!confirm("Выйти из аккаунта Telegram?")) return;
    clearMt(); setMt(null); setStep("creds"); setSess(""); setNeedPass(false); setCode(""); setPass("");
  }

  // ---- Пользователи ----
  async function runUsers() {
    setErr("");
    const list = chats.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) { setErr("Укажите хотя бы один чат"); return; }
    setUBusy(true); setUNote("");
    try {
      const r = await fetch("/api/telegram/mtproto/parse-users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiId, apiHash, session: sess, chats: list, limit: uLimit, filters }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка парсинга");
      setUsers(d.users || []); setUNote(d.note || "");
      try { localStorage.setItem("sb_parsed_users", JSON.stringify(d.users || [])); } catch {}
    } catch (e: any) { setErr(e?.message || "Не удалось спарсить"); }
    finally { setUBusy(false); }
  }
  function exportUsers(fmt: "csv" | "json") {
    if (!users.length) return;
    if (fmt === "json") return download("users.json", JSON.stringify(users, null, 2), "application/json");
    const head = "username,name,premium,photo,bot";
    const rows = users.map((u) => [u.username, `"${u.name.replace(/"/g, '""')}"`, u.premium, u.hasPhoto, u.bot].join(","));
    download("users.csv", [head, ...rows].join("\n"), "text/csv");
  }
  function copyUserLinks() {
    const links = users.filter((u) => u.username).map((u) => "https://t.me/" + u.username.replace(/^@/, "")).join("\n");
    navigator.clipboard?.writeText(links);
    setUNote(`Скопировано ссылок: ${users.filter((u) => u.username).length}`);
  }

  // ---- Чаты по ключевым словам ----
  function addKeyword(w?: string) {
    const v = (w ?? kwInput).trim();
    if (!v) return;
    if (!keywords.includes(v)) setKeywords((k) => [...k, v]);
    setKwInput("");
  }
  function addEnding(w?: string) {
    const v = (w ?? endInput).trim();
    if (!v) return;
    if (!endings.includes(v)) setEndings((e) => [...e, v]);
    setEndInput("");
  }
  // Комбинации: базовое слово + каждое окончание («крипто новости», «крипто 2025»…).
  function buildQueries(): string[] {
    const out = new Set<string>();
    keywords.forEach((k) => {
      out.add(k);
      endings.forEach((e) => out.add(`${k} ${e}`));
    });
    return [...out];
  }
  async function runChats() {
    setErr("");
    const qs = buildQueries();
    if (!qs.length) { setErr("Добавьте хотя бы одно ключевое слово"); return; }
    setCBusy(true); setCNote("");
    try {
      const r = await fetch("/api/telegram/mtproto/search-chats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiId, apiHash, session: sess, keywords: qs, limit: cLimit, minMembers: minM, maxMembers: maxM }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка поиска");
      setFoundChats(d.chats || []); setCNote(d.note || "");
      try { localStorage.setItem("sb_found_chats", JSON.stringify(d.chats || [])); } catch {}
    } catch (e: any) { setErr(e?.message || "Не удалось найти чаты"); }
    finally { setCBusy(false); }
  }
  function exportChats(fmt: "txt" | "csv" | "json") {
    if (!foundChats.length) return;
    if (fmt === "txt") return download("chats-links.txt", foundChats.filter((c) => c.link).map((c) => c.link).join("\n"), "text/plain");
    if (fmt === "json") return download("chats.json", JSON.stringify(foundChats, null, 2), "application/json");
    const head = "title,username,link,members,type,keyword";
    const rows = foundChats.map((c) => [`"${c.title.replace(/"/g, '""')}"`, c.username, c.link, c.members, c.type, c.keyword].join(","));
    download("chats.csv", [head, ...rows].join("\n"), "text/csv");
  }
  function copyChatLinks() {
    const links = foundChats.filter((c) => c.link).map((c) => c.link).join("\n");
    navigator.clipboard?.writeText(links);
    setCNote(`Скопировано ссылок: ${foundChats.filter((c) => c.link).length}`);
  }

  // ---- Пользователи по сообщениям (скрытый список) ----
  function addMmKeyword(w?: string) {
    const v = (w ?? mmKwInput).trim();
    if (!v) return;
    if (!mmKeywords.includes(v)) setMmKeywords((k) => [...k, v]);
    setMmKwInput("");
  }
  async function runMessages() {
    setErr("");
    const list = mmChats.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) { setErr("Укажите хотя бы один чат"); return; }
    setMmBusy(true); setMmNote("");
    try {
      const r = await fetch("/api/telegram/mtproto/parse-messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiId, apiHash, session: sess, chats: list, msgLimit: mmMsgLimit, days: mmDays, keywords: mmKeywords, protection: mmProt, filters: mmFilters }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка парсинга");
      setMmUsers(d.users || []); setMmNote(d.note || "");
      try { localStorage.setItem("sb_parsed_msg_users", JSON.stringify(d.users || [])); } catch {}
    } catch (e: any) { setErr(e?.message || "Не удалось спарсить"); }
    finally { setMmBusy(false); }
  }
  function exportMm(fmt: "csv" | "json") {
    if (!mmUsers.length) return;
    if (fmt === "json") return download("users-by-messages.json", JSON.stringify(mmUsers, null, 2), "application/json");
    const head = "username,name,premium,photo,bot";
    const rows = mmUsers.map((u) => [u.username, `"${u.name.replace(/"/g, '""')}"`, u.premium, u.hasPhoto, u.bot].join(","));
    download("users-by-messages.csv", [head, ...rows].join("\n"), "text/csv");
  }
  function copyMmLinks() {
    const links = mmUsers.filter((u) => u.username).map((u) => "https://t.me/" + u.username.replace(/^@/, "")).join("\n");
    navigator.clipboard?.writeText(links);
    setMmNote(`Скопировано ссылок: ${mmUsers.filter((u) => u.username).length}`);
  }

  // ---- Прогрев аккаунтов (демо-симуляция; боевой прогрев идёт на сервере) ----
  const warmTimer = useRef<any>(null);
  const ACTION_LOG: Record<string, string> = {
    readChannels: "читает случайные каналы", viewProfiles: "просматривает профили",
    typing: "имитирует набор текста", polls: "голосует в опросе", archive: "архивирует чат",
    mute: "отключает звук в чате", reactions: "ставит реакцию 👍", stories: "смотрит сторис",
    joinGroups: "вступает в группу", dialogs: "пишет короткий диалог", trust: "повышает доверие",
  };
  function stopWarm() {
    if (warmTimer.current) clearInterval(warmTimer.current);
    warmTimer.current = null;
    setWRunning(false);
  }
  function startWarm() {
    stopWarm();
    setWRunning(true); setWProgress(0);
    const acc = mt?.user ? (mt.user.startsWith("@") ? mt.user : "@" + mt.user) : "аккаунт";
    setWLog([`⚙ Запуск прогрева · окно ${wFrom}:00–${wTo}:00 ${wTz}`, `Интенсивность: ${wIntensity === "careful" ? "Осторожный" : wIntensity === "normal" ? "Нормальный" : "Агрессивный"} · лимит ${wActHour}/час`]);
    const acts = Object.keys(wActions).filter((k) => wActions[k]);
    let p = 0;
    warmTimer.current = setInterval(() => {
      p += Math.round(6 + Math.random() * 8);
      const act = acts[Math.floor(Math.random() * acts.length)] || "readChannels";
      setWLog((l) => [...l.slice(-40), `${new Date().toLocaleTimeString("ru-RU")} · ${acc} ${ACTION_LOG[act]}`]);
      if (p >= 100) { p = 100; setWProgress(100); stopWarm(); setWLog((l) => [...l, "✅ Сессия прогрева завершена. Аккаунт вёл себя естественно."]); }
      else setWProgress(p);
    }, 700);
  }
  useEffect(() => () => stopWarm(), []);
  const toggleAct = (k: string) => setWActions((v) => ({ ...v, [k]: !v[k] }));

  return (
    <>
      <Topbar crumbs={["Основной проект", "Парсер и прогрев"]} />
      <div className="content" style={{ maxWidth: 1180 }}>
        <div className="ch-head">
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Парсер и прогрев Telegram</h1>
            <p className="muted" style={{ margin: 0, maxWidth: 680 }}>
              Соберите базу под продвижение (парсер чатов и пользователей) и безопасно
              прогрейте аккаунты, чтобы их не замораживали. Экспорт в TXT / CSV / JSON.
            </p>
          </div>
        </div>

        {step !== "ready" ? (
          <div className="card up-login">
            <div className="up-login__title">🔐 Вход по Telegram-аккаунту</div>
            <p className="muted" style={{ marginTop: 0 }}>
              api_id и api_hash — на <b>my.telegram.org</b> → API development tools. Вход
              даёт полный доступ к аккаунту, сессия хранится в этом браузере.
            </p>
            <div className="tg-help" style={{ marginBottom: 12 }}>
              📱 <b>Какой телефон вводить?</b> Это номер вашего <b>Telegram-аккаунта</b>,
              через который идёт парсинг (тот же, под которым вы получили api_id/api_hash на
              my.telegram.org). Рекомендуем <b>отдельный аккаунт</b>, а не основной: при
              активном парсинге Telegram может ограничить номер. Купить/зарегистрировать
              запасной аккаунт можно на обычную или виртуальную SIM.
            </div>
            {step === "creds" && (
              <div className="up-login__grid">
                <div className="field"><label className="label">api_id</label><input className="input" value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="1234567" /></div>
                <div className="field"><label className="label">api_hash</label><input className="input" value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="abcdef..." /></div>
                <div className="field"><label className="label">Телефон</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79001234567" /></div>
                <button className="btn btn-primary" onClick={sendCode} disabled={busy || !apiId || !apiHash || !phone}>{busy ? "Отправляю…" : "Получить код"}</button>
              </div>
            )}
            {step === "code" && (
              <div className="up-login__grid">
                <div className="field"><label className="label">Код из Telegram</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></div>
                {needPass && <div className="field"><label className="label">Пароль 2FA</label><input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>}
                <button className="btn" onClick={() => setStep("creds")} disabled={busy}>Назад</button>
                <button className="btn btn-primary" onClick={signIn} disabled={busy || !code}>{busy ? "Вхожу…" : "Войти"}</button>
              </div>
            )}
            {err && <div className="ai-error">⚠ {err}</div>}
          </div>
        ) : (
          <>
            <div className="tg-conn live" style={{ marginBottom: 14 }}>
              <span className="tg-conn__dot" />
              <span>Аккаунт подключён{mt?.user ? ` · ${mt.user.startsWith("@") ? mt.user : "@" + mt.user}` : ""}</span>
              <button className="tg-conn__link" onClick={logout}>Выйти</button>
            </div>

            <div className="tabs" style={{ marginBottom: 16 }}>
              <button className={`tab${tab === "chats" ? " active" : ""}`} onClick={() => setTab("chats")}>Чаты по ключевым словам</button>
              <button className={`tab${tab === "users" ? " active" : ""}`} onClick={() => setTab("users")}>Пользователи из чатов</button>
              <button className={`tab${tab === "messages" ? " active" : ""}`} onClick={() => setTab("messages")}>По сообщениям (скрытые)</button>
              <button className={`tab${tab === "warm" ? " active" : ""}`} onClick={() => setTab("warm")}>🔥 Прогрев аккаунтов</button>
            </div>

            {tab === "chats" ? (
              <div className="up-layout">
                <div className="card up-settings">
                  <div className="field">
                    <label className="label">Ключевые слова</label>
                    <div className="kw-input">
                      <input className="input" value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addKeyword()} placeholder="крипто, трейдинг…" />
                      <button className="btn btn-primary btn-sm" onClick={() => addKeyword()}>+ Добавить</button>
                    </div>
                    {keywords.length > 0 && (
                      <div className="kw-chips">
                        {keywords.map((k) => (
                          <span className="kw-chip" key={k}>{k}<button onClick={() => setKeywords((ks) => ks.filter((x) => x !== k))}>✕</button></span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="field">
                    <label className="label">✨ AI подсказывает окончания</label>
                    <div className="kw-input">
                      <input className="input" value={endInput} onChange={(e) => setEndInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEnding()} placeholder="новости, 2026…" />
                      <button className="btn btn-sm" onClick={() => addEnding()}>+ Добавить</button>
                    </div>
                    <div className="kw-suggest">
                      {SUGGEST.filter((s) => !endings.includes(s)).map((s) => (
                        <button key={s} className="kw-sugg" onClick={() => addEnding(s)}>+ {s}</button>
                      ))}
                    </div>
                    {endings.length > 0 && (
                      <div className="kw-chips">
                        {endings.map((k) => (
                          <span className="kw-chip end" key={k}>{k}<button onClick={() => setEndings((ks) => ks.filter((x) => x !== k))}>✕</button></span>
                        ))}
                      </div>
                    )}
                    {(keywords.length > 0) && (
                      <div className="fn__var-hint">Запросов будет: <b>{buildQueries().length}</b> (слова × окончания).</div>
                    )}
                  </div>

                  <div className="up-range">
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">Участников от</label>
                      <input className="input" type="number" value={minM} onChange={(e) => setMinM(Number(e.target.value) || 0)} />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">до</label>
                      <input className="input" type="number" value={maxM} onChange={(e) => setMaxM(Number(e.target.value) || 0)} />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">Лимит чатов</label>
                      <input className="input" type="number" value={cLimit} onChange={(e) => setCLimit(Number(e.target.value) || 50)} />
                    </div>
                  </div>

                  <div className="tg-help">
                    Чем выше участников и активность — тем качественнее чат для рассылки.
                    Начните с диапазона 4 000–100 000 подписчиков.
                  </div>
                  {err && <div className="ai-error">⚠ {err}</div>}
                  <button className="btn btn-ai" style={{ width: "100%", marginTop: 12 }} onClick={runChats} disabled={cBusy || !keywords.length}>
                    {cBusy ? "Ищу чаты…" : "🚀 Начать парсинг"}
                  </button>
                </div>

                <div className="card up-results">
                  <div className="up-results__head">
                    <b>Найденные чаты {foundChats.length > 0 && <span className="up-count">{foundChats.length}</span>}</b>
                    {foundChats.length > 0 && (
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn btn-sm" onClick={copyChatLinks}>Ссылки</button>
                        <button className="btn btn-sm" onClick={() => exportChats("txt")}>TXT</button>
                        <button className="btn btn-sm" onClick={() => exportChats("csv")}>CSV</button>
                        <button className="btn btn-sm" onClick={() => exportChats("json")}>JSON</button>
                      </div>
                    )}
                  </div>
                  {cNote && <div className="tg-banner" style={{ margin: "10px 0" }}>{cNote}</div>}
                  {foundChats.length === 0 ? (
                    <div className="ch-empty"><div className="ch-empty__ico">🔍</div><div className="ch-empty__title">Чаты ещё не найдены</div><p>Задайте ключевые слова и диапазон участников, затем запустите парсинг.</p></div>
                  ) : (
                    <div className="up-list">
                      {foundChats.map((c) => (
                        <div className="up-user" key={c.id}>
                          <div className="part-ava">{c.title.slice(0, 1)}</div>
                          <div className="part-body">
                            <div className="part-name">{c.title}</div>
                            <div className="part-user">{c.username || "—"} · {c.members.toLocaleString("ru-RU")} участников</div>
                          </div>
                          {c.link && <a className="ch-open" href={c.link} target="_blank" rel="noreferrer">открыть ↗</a>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : tab === "users" ? (
              <div className="up-layout">
                <div className="card up-settings">
                  <div className="field">
                    <label className="label">Список чатов (ссылки или @username, по одному в строке)</label>
                    <textarea className="textarea" style={{ minHeight: 96 }} value={chats} onChange={(e) => setChats(e.target.value)} placeholder={"@target_chat\nhttps://t.me/competitor_chat"} />
                  </div>
                  <div className="field">
                    <label className="label">Лимит участников</label>
                    <input className="input" type="number" min={1} max={100000} value={uLimit} onChange={(e) => setULimit(Number(e.target.value) || 1000)} />
                  </div>
                  <div className="up-filters">
                    <div className="up-filters__col">
                      <div className="up-filters__label">Базовые фильтры</div>
                      {USER_FILTERS.filter((f) => f.group === "base").map((f) => (
                        <label key={f.key} className="up-check"><input type="checkbox" checked={!!filters[f.key]} onChange={(e) => setFilters((v) => ({ ...v, [f.key]: e.target.checked }))} />{f.label}</label>
                      ))}
                    </div>
                    <div className="up-filters__col">
                      <div className="up-filters__label">Фильтры профиля</div>
                      {USER_FILTERS.filter((f) => f.group === "profile").map((f) => (
                        <label key={f.key} className="up-check"><input type="checkbox" checked={!!filters[f.key]} onChange={(e) => setFilters((v) => ({ ...v, [f.key]: e.target.checked }))} />{f.label}</label>
                      ))}
                    </div>
                  </div>
                  <div className="tg-help">Работает для чатов с открытым списком участников. Если список скрыт — соберите аудиторию из «Чаты по ключевым словам».</div>
                  {err && <div className="ai-error">⚠ {err}</div>}
                  <button className="btn btn-ai" style={{ width: "100%", marginTop: 12 }} onClick={runUsers} disabled={uBusy || !chats.trim()}>{uBusy ? "Парсинг…" : "🚀 Запустить парсинг"}</button>
                </div>

                <div className="card up-results">
                  <div className="up-results__head">
                    <b>Пользователи {users.length > 0 && <span className="up-count">{users.length}</span>}</b>
                    {users.length > 0 && (
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn btn-sm" onClick={copyUserLinks}>Ссылки</button>
                        <button className="btn btn-sm" onClick={() => exportUsers("csv")}>CSV</button>
                        <button className="btn btn-sm" onClick={() => exportUsers("json")}>JSON</button>
                      </div>
                    )}
                  </div>
                  {uNote && <div className="tg-banner" style={{ margin: "10px 0" }}>{uNote}</div>}
                  {users.length === 0 ? (
                    <div className="ch-empty"><div className="ch-empty__ico">👥</div><div className="ch-empty__title">Пока нет собранных пользователей</div><p>Укажите чаты, настройте фильтры и запустите парсинг.</p></div>
                  ) : (
                    <div className="up-list">
                      {users.map((u) => (
                        <div className="up-user" key={u.id}>
                          <div className="part-ava">{u.name.slice(0, 1)}</div>
                          <div className="part-body"><div className="part-name">{u.name}</div><div className="part-user">{u.username || "без юзернейма"}</div></div>
                          <div className="up-badges">
                            {u.premium && <span className="up-badge prem">Premium</span>}
                            {u.hasPhoto && <span className="up-badge">фото</span>}
                            {u.bot && <span className="up-badge bot">бот</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : tab === "messages" ? (
              <div className="up-layout">
                <div className="card up-settings">
                  <div className="ai-tips" style={{ marginTop: 0 }}>
                    🔓 Собирает авторов сообщений — работает даже когда <b>список участников скрыт</b>, но чат открыт.
                  </div>

                  <div className="field">
                    <label className="label">🛡️ AI-защита аккаунта</label>
                    <div className="prot-row">
                      {([["conservative", "Консервативный", "макс. защита"], ["balanced", "Сбалансированный", "рекомендуем"], ["aggressive", "Агрессивный", "макс. скорость"]] as const).map(([k, t, s]) => (
                        <button key={k} className={`prot-opt${mmProt === k ? " on" : ""}`} onClick={() => setMmProt(k)}>
                          <b>{t}</b><span>{s}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">Список чатов (ссылки или @username, по одному в строке)</label>
                    <textarea className="textarea" style={{ minHeight: 80 }} value={mmChats} onChange={(e) => setMmChats(e.target.value)} placeholder={"@channel\nhttps://t.me/xxx/chat"} />
                  </div>

                  <div className="up-range" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">Лимит сообщений</label>
                      <input className="input" type="number" min={1} max={100000} value={mmMsgLimit} onChange={(e) => setMmMsgLimit(Number(e.target.value) || 1000)} />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">За сколько дней (0 = всё время)</label>
                      <input className="input" type="number" min={0} value={mmDays} onChange={(e) => setMmDays(Number(e.target.value) || 0)} />
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">Ключевые слова в сообщениях <span className="intg-opt">— необязательно</span></label>
                    <div className="kw-input">
                      <input className="input" value={mmKwInput} onChange={(e) => setMmKwInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMmKeyword()} placeholder="какой криптокошелёк…" />
                      <button className="btn btn-sm" onClick={() => addMmKeyword()}>+ Добавить</button>
                    </div>
                    {mmKeywords.length > 0 && (
                      <div className="kw-chips">
                        {mmKeywords.map((k) => (<span className="kw-chip" key={k}>{k}<button onClick={() => setMmKeywords((ks) => ks.filter((x) => x !== k))}>✕</button></span>))}
                      </div>
                    )}
                  </div>

                  <div className="up-filters">
                    <div className="up-filters__col">
                      <div className="up-filters__label">Базовые</div>
                      {[["skipBots", "Пропустить ботов"], ["skipDeleted", "Пропустить удалённых"], ["skipScam", "Пропустить scam/заблок."]].map(([k, l]) => (
                        <label key={k} className="up-check"><input type="checkbox" checked={!!mmFilters[k]} onChange={(e) => setMmFilters((v) => ({ ...v, [k]: e.target.checked }))} />{l}</label>
                      ))}
                    </div>
                    <div className="up-filters__col">
                      <div className="up-filters__label">Профиль</div>
                      {[["onlyUsername", "Только с юзернеймом"], ["onlyPhoto", "Только с фото"], ["onlyPremium", "Только Premium"]].map(([k, l]) => (
                        <label key={k} className="up-check"><input type="checkbox" checked={!!mmFilters[k]} onChange={(e) => setMmFilters((v) => ({ ...v, [k]: e.target.checked }))} />{l}</label>
                      ))}
                    </div>
                  </div>
                  <div className="up-filters__label" style={{ marginTop: 4 }}>Дополнительно</div>
                  <div className="up-filters">
                    <label className="up-check"><input type="checkbox" checked={!!mmFilters.includeReplies} onChange={(e) => setMmFilters((v) => ({ ...v, includeReplies: e.target.checked }))} />Учитывать ответы</label>
                    <label className="up-check"><input type="checkbox" checked={!!mmFilters.includeForwarded} onChange={(e) => setMmFilters((v) => ({ ...v, includeForwarded: e.target.checked }))} />Учитывать пересланные</label>
                  </div>

                  {err && <div className="ai-error">⚠ {err}</div>}
                  <button className="btn btn-ai" style={{ width: "100%", marginTop: 12 }} onClick={runMessages} disabled={mmBusy || !mmChats.trim()}>{mmBusy ? "Анализирую сообщения…" : "🚀 Начать парсинг"}</button>
                </div>

                <div className="card up-results">
                  <div className="up-results__head">
                    <b>Пользователи {mmUsers.length > 0 && <span className="up-count">{mmUsers.length}</span>}</b>
                    {mmUsers.length > 0 && (
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn btn-sm" onClick={copyMmLinks}>Ссылки</button>
                        <button className="btn btn-sm" onClick={() => exportMm("csv")}>CSV</button>
                        <button className="btn btn-sm" onClick={() => exportMm("json")}>JSON</button>
                      </div>
                    )}
                  </div>
                  {mmNote && <div className="tg-banner" style={{ margin: "10px 0" }}>{mmNote}</div>}
                  {mmUsers.length === 0 ? (
                    <div className="ch-empty"><div className="ch-empty__ico">🔓</div><div className="ch-empty__title">Пока нет собранных пользователей</div><p>Укажите чаты со скрытым списком, настройте фильтры и запустите парсинг по сообщениям.</p></div>
                  ) : (
                    <div className="up-list">
                      {mmUsers.map((u) => (
                        <div className="up-user" key={u.id}>
                          <div className="part-ava">{u.name.slice(0, 1)}</div>
                          <div className="part-body"><div className="part-name">{u.name}</div><div className="part-user">{u.username || "без юзернейма"}</div></div>
                          <div className="up-badges">
                            {u.premium && <span className="up-badge prem">Premium</span>}
                            {u.hasPhoto && <span className="up-badge">фото</span>}
                            {u.bot && <span className="up-badge bot">бот</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="up-layout">
                <div className="card up-settings">
                  <div className="ai-tips" style={{ marginTop: 0 }}>
                    🔥 Прогрев — постепенное «оживление» аккаунта (чтение, реакции, навигация), чтобы Telegram не заморозил его перед рассылками.
                  </div>

                  <div className="warm-block">
                    <div className="warm-block__title">🗓️ Расписание активности</div>
                    <div className="up-range" style={{ gridTemplateColumns: "1fr 1fr 1.4fr" }}>
                      <div className="field" style={{ margin: 0 }}><label className="label">Активность с (ч)</label><input className="input" type="number" min={0} max={23} value={wFrom} onChange={(e) => setWFrom(Number(e.target.value) || 0)} /></div>
                      <div className="field" style={{ margin: 0 }}><label className="label">до (ч)</label><input className="input" type="number" min={0} max={23} value={wTo} onChange={(e) => setWTo(Number(e.target.value) || 0)} /></div>
                      <div className="field" style={{ margin: 0 }}><label className="label">Таймзона</label>
                        <select className="role-select" style={{ width: "100%" }} value={wTz} onChange={(e) => setWTz(e.target.value)}>
                          {["UTC+3 (Москва)", "UTC+2 (Киев)", "UTC+5 (Екб)", "UTC+0 (Лондон)"].map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <label className="up-check" style={{ marginTop: 8 }}><input type="checkbox" checked={wBreaks} onChange={(e) => setWBreaks(e.target.checked)} />Случайные перерывы (естественнее)</label>
                  </div>

                  <div className="warm-block">
                    <div className="warm-block__title">⚡ Интенсивность прогрева</div>
                    <div className="prot-row">
                      {([["careful", "Осторожный", "новые 0–7 дней"], ["normal", "Нормальный", "прогретые 7–30"], ["aggressive", "Агрессивный", "старые 30+ дней"]] as const).map(([k, t, s]) => (
                        <button key={k} className={`prot-opt${wIntensity === k ? " on" : ""}`} onClick={() => setWIntensity(k)}><b>{t}</b><span>{s}</span></button>
                      ))}
                    </div>
                    <label className="up-check" style={{ marginTop: 8 }}><input type="checkbox" checked={wAutoAdapt} onChange={(e) => setWAutoAdapt(e.target.checked)} />Автоадаптация по стадии аккаунта</label>
                  </div>

                  <div className="warm-block">
                    <div className="warm-block__title">🛡️ Лимиты безопасности</div>
                    <div className="warm-limits">
                      <div className="field" style={{ margin: 0 }}><label className="label">Действий/час</label><input className="input" type="number" value={wActHour} onChange={(e) => setWActHour(Number(e.target.value) || 0)} /></div>
                      <div className="field" style={{ margin: 0 }}><label className="label">Действий/день</label><input className="input" type="number" value={wActDay} onChange={(e) => setWActDay(Number(e.target.value) || 0)} /></div>
                      <div className="field" style={{ margin: 0 }}><label className="label">Вступлений/день</label><input className="input" type="number" value={wJoinDay} onChange={(e) => setWJoinDay(Number(e.target.value) || 0)} /></div>
                      <div className="field" style={{ margin: 0 }}><label className="label">Сообщений/день</label><input className="input" type="number" value={wMsgDay} onChange={(e) => setWMsgDay(Number(e.target.value) || 0)} /></div>
                    </div>
                    <label className="up-check" style={{ marginTop: 8 }}><input type="checkbox" checked={wProgressive} onChange={(e) => setWProgressive(e.target.checked)} />Прогрессивное увеличение (день 1: 30% → день 7: 100%)</label>
                  </div>

                  <div className="warm-block">
                    <div className="warm-block__title">⏱️ Длительность сеанса</div>
                    <div className="warm-sessions">
                      {["30 мин", "1 час", "2 часа", "8 часов", "1 день", "3 дня", "7 дней"].map((s) => (
                        <button key={s} className={`warm-sess${wSession === s ? " on" : ""}`} onClick={() => setWSession(s)}>{s}</button>
                      ))}
                    </div>
                  </div>

                  <div className="warm-block">
                    <div className="warm-block__title">🎬 Действия прогрева</div>
                    <div className="up-filters">
                      <div className="up-filters__col">
                        <div className="up-filters__label">Безопасные (рекомендуем)</div>
                        {[["readChannels", "Читать каналы"], ["viewProfiles", "Просмотр профилей"], ["typing", "Симуляция печати"], ["polls", "Голосовать в опросах"], ["archive", "Архивировать чаты"], ["mute", "Отключать звук"]].map(([k, l]) => (
                          <label key={k} className="up-check"><input type="checkbox" checked={!!wActions[k]} onChange={() => toggleAct(k)} />{l}</label>
                        ))}
                      </div>
                      <div className="up-filters__col">
                        <div className="up-filters__label">Усиленные (позже)</div>
                        {[["reactions", "Реакции 👍❤️🔥"], ["stories", "Просмотр сторис"], ["joinGroups", "Вступать в группы"], ["dialogs", "Диалоги между аккаунтами"], ["trust", "Повышение доверия"]].map(([k, l]) => (
                          <label key={k} className="up-check"><input type="checkbox" checked={!!wActions[k]} onChange={() => toggleAct(k)} />{l}</label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">Целевые группы/каналы <span className="intg-opt">— необязательно, лучше позже</span></label>
                    <textarea className="textarea" style={{ minHeight: 60 }} value={wTargets} onChange={(e) => setWTargets(e.target.value)} placeholder={"@myChannel\nhttps://t.me/myGroup"} />
                  </div>

                  <div className="tg-help">На старте держите «Осторожный» режим и минимум действий: аккаунт должен вести себя как обычный человек, а не как спамер.</div>
                  {wRunning ? (
                    <button className="btn" style={{ width: "100%", marginTop: 12, color: "#ef4444" }} onClick={stopWarm}>■ Остановить прогрев</button>
                  ) : (
                    <button className="btn btn-ai" style={{ width: "100%", marginTop: 12 }} onClick={startWarm}>🔥 Запустить прогрев</button>
                  )}
                </div>

                <div className="card up-results">
                  <div className="up-results__head"><b>Прогрев по времени</b>{wRunning && <span className="ch-status">● работает</span>}</div>
                  <div className="warm-bar"><span style={{ width: `${wProgress}%` }} /></div>
                  <div className="warm-bar__label">{wProgress}%{wRunning ? " · сессия идёт…" : wProgress === 100 ? " · завершено" : ""}</div>
                  {wLog.length === 0 ? (
                    <div className="ch-empty"><div className="ch-empty__ico">🔥</div><div className="ch-empty__title">Прогрев не запущен</div><p>Настройте расписание, интенсивность и действия, затем запустите прогрев.</p></div>
                  ) : (
                    <div className="warm-log">
                      {wLog.map((l, i) => <div key={i} className="warm-log__line">{l}</div>)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
