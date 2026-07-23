"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { MtSession, loadMt, saveMt, clearMt } from "@/lib/tgchats";

type ParsedUser = { id: string; name: string; username: string; premium: boolean; hasPhoto: boolean; bot: boolean };

const FILTERS: { key: string; label: string; group: "base" | "profile" }[] = [
  { key: "skipBots", label: "Пропустить ботов", group: "base" },
  { key: "skipDeleted", label: "Пропустить удалённых", group: "base" },
  { key: "onlyUsername", label: "Только с юзернеймом", group: "profile" },
  { key: "onlyPhoto", label: "Только с фото", group: "profile" },
  { key: "onlyPremium", label: "Только Premium", group: "profile" },
];

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

  const [chats, setChats] = useState("");
  const [limit, setLimit] = useState(1000);
  const [filters, setFilters] = useState<Record<string, boolean>>({ skipBots: true, skipDeleted: true, onlyUsername: false, onlyPhoto: false, onlyPremium: false });
  const [users, setUsers] = useState<ParsedUser[]>([]);
  const [note, setNote] = useState("");
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    const saved = loadMt();
    setMt(saved);
    if (saved) {
      setApiId(saved.apiId);
      setApiHash(saved.apiHash);
      setSess(saved.session);
      setStep("ready");
    }
    try {
      const u = localStorage.getItem("sb_parsed_users");
      if (u) setUsers(JSON.parse(u));
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

  async function run() {
    setErr("");
    const list = chats.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) { setErr("Укажите хотя бы один чат"); return; }
    setParsing(true); setNote("");
    try {
      const r = await fetch("/api/telegram/mtproto/parse-users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiId, apiHash, session: sess, chats: list, limit, filters }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка парсинга");
      setUsers(d.users || []);
      setNote(d.note || "");
      try { localStorage.setItem("sb_parsed_users", JSON.stringify(d.users || [])); } catch {}
    } catch (e: any) { setErr(e?.message || "Не удалось спарсить"); }
    finally { setParsing(false); }
  }

  function exportFile(fmt: "csv" | "json") {
    if (!users.length) return;
    let content = "", type = "", ext = fmt;
    if (fmt === "json") { content = JSON.stringify(users, null, 2); type = "application/json"; }
    else {
      const head = "username,name,premium,photo,bot";
      const rows = users.map((u) => [u.username, `"${u.name.replace(/"/g, '""')}"`, u.premium, u.hasPhoto, u.bot].join(","));
      content = [head, ...rows].join("\n"); type = "text/csv";
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `parsed-users.${ext}`; a.click();
    URL.revokeObjectURL(url);
  }

  function copyLinks() {
    const links = users.filter((u) => u.username).map((u) => "https://t.me/" + u.username.replace(/^@/, "")).join("\n");
    navigator.clipboard?.writeText(links);
    setNote(`Скопировано ссылок: ${users.filter((u) => u.username).length}`);
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Парсер пользователей"]} />
      <div className="content" style={{ maxWidth: 1180 }}>
        <div className="ch-head">
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Парсер пользователей</h1>
            <p className="muted" style={{ margin: 0, maxWidth: 640 }}>
              Соберите базу аудитории из открытых Telegram-чатов конкурентов: участники с
              фильтрами по активности и профилю, экспорт в CSV / JSON.
            </p>
          </div>
        </div>

        {/* Аккаунт */}
        {step !== "ready" ? (
          <div className="card up-login">
            <div className="up-login__title">🔐 Вход по Telegram-аккаунту</div>
            <p className="muted" style={{ marginTop: 0 }}>
              api_id и api_hash — на <b>my.telegram.org</b> → API development tools. Вход
              даёт полный доступ к аккаунту, сессия хранится в этом браузере.
            </p>
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
          <div className="up-layout">
            {/* Настройки парсинга */}
            <div className="card up-settings">
              <div className="tg-conn live" style={{ marginBottom: 14 }}>
                <span className="tg-conn__dot" />
                <span>Аккаунт подключён{mt?.user ? ` · ${mt.user.startsWith("@") ? mt.user : "@" + mt.user}` : ""}</span>
                <button className="tg-conn__link" onClick={logout}>Выйти</button>
              </div>

              <div className="field">
                <label className="label">Список чатов (ссылки или @username, по одному в строке)</label>
                <textarea className="textarea" style={{ minHeight: 96 }} value={chats} onChange={(e) => setChats(e.target.value)} placeholder={"@target_chat\nhttps://t.me/competitor_chat"} />
              </div>

              <div className="up-two">
                <div className="field" style={{ margin: 0 }}>
                  <label className="label">Лимит участников</label>
                  <input className="input" type="number" min={1} max={100000} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 1000)} />
                </div>
              </div>

              <div className="up-filters">
                <div className="up-filters__col">
                  <div className="up-filters__label">Базовые фильтры</div>
                  {FILTERS.filter((f) => f.group === "base").map((f) => (
                    <label key={f.key} className="up-check">
                      <input type="checkbox" checked={!!filters[f.key]} onChange={(e) => setFilters((v) => ({ ...v, [f.key]: e.target.checked }))} />
                      {f.label}
                    </label>
                  ))}
                </div>
                <div className="up-filters__col">
                  <div className="up-filters__label">Фильтры профиля</div>
                  {FILTERS.filter((f) => f.group === "profile").map((f) => (
                    <label key={f.key} className="up-check">
                      <input type="checkbox" checked={!!filters[f.key]} onChange={(e) => setFilters((v) => ({ ...v, [f.key]: e.target.checked }))} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="tg-help">
                Парсинг работает для чатов с открытым списком участников. Если список скрыт —
                соберите аудиторию по сообщениям (в разделе «Чаты»).
              </div>
              {err && <div className="ai-error">⚠ {err}</div>}
              <button className="btn btn-ai" style={{ width: "100%", marginTop: 12 }} onClick={run} disabled={parsing || !chats.trim()}>
                {parsing ? "Парсинг…" : "🚀 Запустить парсинг"}
              </button>
            </div>

            {/* Результаты */}
            <div className="card up-results">
              <div className="up-results__head">
                <b>Результаты {users.length > 0 && <span className="up-count">{users.length}</span>}</b>
                {users.length > 0 && (
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-sm" onClick={copyLinks}>Копировать ссылки</button>
                    <button className="btn btn-sm" onClick={() => exportFile("csv")}>CSV</button>
                    <button className="btn btn-sm" onClick={() => exportFile("json")}>JSON</button>
                  </div>
                )}
              </div>
              {note && <div className="tg-banner" style={{ margin: "10px 0" }}>{note}</div>}
              {users.length === 0 ? (
                <div className="ch-empty">
                  <div className="ch-empty__ico">👥</div>
                  <div className="ch-empty__title">Пока нет собранных пользователей</div>
                  <p>Укажите чаты, настройте фильтры и запустите парсинг.</p>
                </div>
              ) : (
                <div className="up-list">
                  {users.map((u) => (
                    <div className="up-user" key={u.id}>
                      <div className="part-ava">{u.name.slice(0, 1)}</div>
                      <div className="part-body">
                        <div className="part-name">{u.name}</div>
                        <div className="part-user">{u.username || "без юзернейма"}</div>
                      </div>
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
        )}
      </div>
    </>
  );
}
