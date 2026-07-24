"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { addDrafts } from "@/lib/content";

type Account = { id: string; username: string; name: string };
type Resolved = { ok: boolean; type?: string; title?: string; username?: string; participantsAvailable?: boolean; commentsAvailable?: boolean; suggestedMode?: string; error?: string };
type LogRow = { t: string; msg: string; kind: "info" | "ok" | "warn" | "err" };
type Job = {
  id: string; kind: string; mode: string; status: string; source: string; sources?: string[];
  progress: number; found: number; saved: number; skipped: number; target: number;
  error: string; floodSeconds: number; audience: any[]; content: any[]; logs?: LogRow[];
};

const PROTECTS = [
  { id: "conservative", label: "Консервативный", hint: "Максимальная защита" },
  { id: "balanced", label: "Сбалансированный", hint: "Оптимально" },
  { id: "aggressive", label: "Агрессивный", hint: "Высокая скорость" },
];
const BASE_FILTERS: { id: string; label: string }[] = [
  { id: "skipBots", label: "Пропустить ботов" },
  { id: "skipDeleted", label: "Пропустить удалённых" },
  { id: "skipScam", label: "Пропустить заблокированных / scam" },
  { id: "onlyActive", label: "Только активные пользователи" },
];
const PROFILE_FILTERS: { id: string; label: string; premium?: boolean }[] = [
  { id: "onlyUsername", label: "Только с username" },
  { id: "onlyPhoto", label: "Только с фото" },
  { id: "onlyPremium", label: "Только Premium", premium: true },
];

const TYPE_LABEL: Record<string, string> = { supergroup: "Супергруппа", broadcast: "Канал (broadcast)", group: "Группа", user: "Пользователь", unknown: "Неизвестно" };
const JOB_LABEL: Record<string, string> = { running: "Выполняется", paused: "Пауза", flood: "Пауза (ограничение Telegram)", done: "Готово", error: "Ошибка", stopped: "Остановлена" };
const TERMINAL = ["done", "error", "stopped"];

export default function ParsingClient() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [tab, setTab] = useState<"audience" | "content">("audience");

  useEffect(() => { loadAccount(); }, []);
  async function loadAccount() {
    try {
      const d = await (await fetch("/api/tg/auth/status")).json();
      const accs: Account[] = d.accounts || [];
      const savedId = localStorage.getItem("sb_tg_account_id") || "";
      const acc = accs.find((a) => a.id === savedId) || accs[0] || null;
      if (acc) localStorage.setItem("sb_tg_account_id", acc.id);
      setAccount(acc);
    } catch {}
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Парсинг"]} />
      <div className="content" style={{ maxWidth: 1080 }}>
        <div className="sec-head">
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Парсинг аудитории и контента</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Реальные данные Telegram через ваш аккаунт (MTProto). Участники — через channels.getParticipants,
              контент — через messages.getHistory. Никаких сгенерированных данных.
            </p>
          </div>
        </div>
        <div className="pr-flow">Парсинг → <b>Черновики</b> → Создание контента → Календарь → Публикация</div>

        {!account ? (
          <LoginCard onDone={loadAccount} />
        ) : (
          <>
            <AccountBar account={account} onLogout={async () => { await fetch("/api/tg/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id }) }); localStorage.removeItem("sb_tg_account_id"); setAccount(null); }} />
            <div className="ct-tabs" style={{ marginTop: 14 }}>
              <button className={`ct-tab${tab === "audience" ? " on" : ""}`} onClick={() => setTab("audience")} type="button"><span>👥</span> Аудитория</button>
              <button className={`ct-tab${tab === "content" ? " on" : ""}`} onClick={() => setTab("content")} type="button"><span>📄</span> Контент</button>
            </div>
            {tab === "audience" ? <AudienceTab account={account} /> : <ContentTab account={account} router={router} />}
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Вход по аккаунту (сессия хранится на сервере) ---------- */
function LoginCard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"creds" | "code">("creds");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [authId, setAuthId] = useState("");
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [needPass, setNeedPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function sendCode() {
    setErr(""); setBusy(true);
    try {
      const d = await (await fetch("/api/tg/auth/send-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiId, apiHash, phone }) })).json();
      if (!d.ok) throw new Error(d.error || "Ошибка");
      setAuthId(d.authId); setStep("code");
    } catch (e: any) { setErr(e?.message || "Не удалось отправить код"); }
    finally { setBusy(false); }
  }
  async function signIn() {
    setErr(""); setBusy(true);
    try {
      const d = await (await fetch("/api/tg/auth/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ authId, code, password: pass }) })).json();
      if (d.needPassword) { setNeedPass(true); setErr("Введите пароль двухфакторной защиты"); return; }
      if (!d.ok) throw new Error(d.error || "Ошибка входа");
      localStorage.setItem("sb_tg_account_id", d.accountId);
      onDone();
    } catch (e: any) { setErr(e?.message || "Не удалось войти"); }
    finally { setBusy(false); }
  }

  return (
    <div className="card pr-card" style={{ maxWidth: 560 }}>
      <div className="pr-card__t">🔐 Подключите аккаунт Telegram</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Парсинг работает через ваш аккаунт (MTProto). Получите <b>api_id</b> и <b>api_hash</b> на{" "}
        <a href="https://my.telegram.org" target="_blank" rel="noreferrer" style={{ color: "var(--violet-700)", fontWeight: 700 }}>my.telegram.org</a>. Сессия шифруется и хранится на сервере — не в браузере.
      </p>
      {step === "creds" && (
        <>
          <div className="pw-grid2">
            <div className="field"><label className="pw-label">api_id</label><input className="input" value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="1234567" /></div>
            <div className="field"><label className="pw-label">api_hash</label><input className="input" value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="abcdef0123..." /></div>
          </div>
          <div className="field" style={{ marginTop: 8 }}><label className="pw-label">Телефон</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79991234567" /></div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={sendCode} disabled={busy || !apiId || !apiHash || !phone}>{busy ? "Отправляю…" : "Получить код"}</button>
        </>
      )}
      {step === "code" && (
        <>
          <div className="field"><label className="pw-label">Код из Telegram</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="12345" /></div>
          {needPass && <div className="field" style={{ marginTop: 8 }}><label className="pw-label">Пароль 2FA</label><input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>}
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={signIn} disabled={busy || !code}>{busy ? "Вхожу…" : "Войти"}</button>
        </>
      )}
      {err && <div className="tgd-msg err" style={{ marginTop: 10 }}>⚠ {err}</div>}
    </div>
  );
}

function AccountBar({ account, onLogout }: { account: Account; onLogout: () => void }) {
  return (
    <div className="card pr-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px" }}>
      <div>
        <b>✅ Аккаунт подключён: {account.username ? "@" + account.username : account.name}</b>
        <div className="muted" style={{ fontSize: 12.5 }}>{account.name} · сессия хранится на сервере</div>
      </div>
      <button className="btn btn-sm" onClick={onLogout} type="button">Отключить</button>
    </div>
  );
}

/* ---------- Живая панель задачи ---------- */
function useJobPoller() {
  const [job, setJob] = useState<Job | null>(null);
  const timer = useRef<any>(null);
  function poll(id: string) {
    clearTimeout(timer.current);
    fetch(`/api/tg/job?jobId=${id}`).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setJob(d.job);
        if (!TERMINAL.includes(d.job.status)) timer.current = setTimeout(() => poll(id), 1500);
      }
    }).catch(() => { timer.current = setTimeout(() => poll(id), 3000); });
  }
  function reset() { clearTimeout(timer.current); setJob(null); }
  useEffect(() => () => clearTimeout(timer.current), []);
  return { job, poll, reset, setJob };
}

async function jobControl(jobId: string, action: string) {
  await fetch("/api/tg/job/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId, action }) });
}

function JobPanel({ job, onControl }: { job: Job; onControl: (a: string) => void }) {
  const active = !TERMINAL.includes(job.status);
  return (
    <div className="jb">
      <div className="jb-top">
        <span className={`jb-badge jb-${job.status}`}>{JOB_LABEL[job.status] || job.status}{job.status === "flood" && job.floodSeconds ? ` · ${job.floodSeconds}с` : ""}</span>
        <div className="jb-ctrl">
          {job.status === "running" && <button className="btn btn-sm" onClick={() => onControl("pause")} type="button">⏸ Пауза</button>}
          {job.status === "paused" && <button className="btn btn-sm btn-primary" onClick={() => onControl("resume")} type="button">▶ Продолжить</button>}
          {active && <button className="user-act del" onClick={() => onControl("stop")} type="button">⏹ Остановить</button>}
        </div>
      </div>
      <div className="jb-bar"><span style={{ width: `${job.progress}%` }} /></div>
      <div className="jb-stats">
        <span>Прогресс: <b>{job.progress}%</b></span>
        <span>Найдено: <b>{job.found}</b></span>
        <span>Сохранено: <b>{job.saved}</b></span>
        <span>Пропущено: <b>{job.skipped}</b></span>
      </div>
      {job.error && <div className="tgd-msg err" style={{ marginTop: 8 }}>⚠ {job.error}</div>}
      {job.logs && job.logs.length > 0 && <LogPanel logs={job.logs} />}
    </div>
  );
}

function LogPanel({ logs }: { logs: LogRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs.length]);
  return (
    <div className="pr-log" ref={ref}>
      <div className="pr-log__head">Логи · {logs.length}</div>
      {logs.slice(-120).map((l, i) => (
        <div key={i} className={`pr-log__row k-${l.kind}`}><span className="pr-log__t">{l.t}</span> {l.msg}</div>
      ))}
    </div>
  );
}

/* ---------- Вкладка «Аудитория» ---------- */
function AudienceTab({ account }: { account: Account }) {
  const [chats, setChats] = useState("");
  const [checks, setChecks] = useState<{ link: string; res: Resolved }[]>([]);
  const [checking, setChecking] = useState(false);
  const [mode, setMode] = useState("participants");
  const [target, setTarget] = useState("1000");
  const [days, setDays] = useState("0");
  const [keywords, setKeywords] = useState("");
  const [protectOn, setProtectOn] = useState(false);
  const [protect, setProtect] = useState("balanced");
  const [fast, setFast] = useState(false);
  const [filters, setFilters] = useState<Record<string, boolean>>({ skipBots: true, skipDeleted: true, skipScam: true, onlyActive: false, onlyUsername: false, onlyPhoto: false, onlyPremium: false, inclReplies: true, inclForwards: false });
  const [advOpen, setAdvOpen] = useState(false);
  const [delayChat, setDelayChat] = useState("");
  const [delayUser, setDelayUser] = useState("");
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState("");
  const { job, poll, reset } = useJobPoller();

  const lines = chats.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const byMessages = mode !== "participants";
  const toggle = (k: string) => setFilters((f) => ({ ...f, [k]: !f[k] }));

  async function check() {
    if (!lines.length) return;
    setErr(""); setChecks([]); setChecking(true); reset();
    try {
      const out: { link: string; res: Resolved }[] = [];
      for (const link of lines.slice(0, 20)) {
        const d: Resolved = await (await fetch("/api/tg/source/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id, link }) })).json();
        out.push({ link, res: d });
      }
      setChecks(out);
      const firstOk = out.find((o) => o.res.ok && o.res.suggestedMode);
      if (firstOk?.res.suggestedMode) setMode(firstOk.res.suggestedMode);
    } catch { setErr("Не удалось проверить чаты"); }
    finally { setChecking(false); }
  }
  async function start() {
    if (!lines.length) { setErr("Добавьте хотя бы один чат"); return; }
    setErr(""); setStarting(true);
    try {
      const body = {
        accountId: account.id, sources: lines, mode, target: Number(target) || 1000,
        days: Number(days) || 0, keywords, filters,
        protect: protectOn ? protect : "off", fast,
        delayChat: Number(delayChat) || 0, delayUser: Number(delayUser) || 0,
      };
      const d = await (await fetch("/api/tg/audience/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
      if (!d.ok) throw new Error(d.error || "Ошибка запуска");
      poll(d.jobId);
    } catch (e: any) { setErr(e?.message || "Ошибка запуска"); }
    finally { setStarting(false); }
  }

  return (
    <div className="card ct-card">
      <div className="ct-hint">👉 Соберите базу активной аудитории из чатов и групп — даже если список участников скрыт. Вставьте один или несколько чатов, настройте фильтры и запустите сбор. Реальные данные Telegram через ваш аккаунт (MTProto).</div>

      {/* Режим сбора */}
      <label className="pw-label">Режим сбора</label>
      <div className="pr-modes">
        <button className={`pr-mode${mode === "participants" ? " on" : ""}`} onClick={() => setMode("participants")} type="button">
          <b>👥 Участники группы</b><span>Список участников открыт или вы админ</span>
        </button>
        <button className={`pr-mode${mode === "message_authors" ? " on" : ""}`} onClick={() => setMode("message_authors")} type="button">
          <b>💬 По сообщениям <em className="pr-rec">рекомендуется</em></b><span>Скрытый список — собираем активных по сообщениям</span>
        </button>
        <button className={`pr-mode${mode === "comment_authors" ? " on" : ""}`} onClick={() => setMode("comment_authors")} type="button">
          <b>🗨 Комментаторы канала</b><span>Авторы комментариев в обсуждениях</span>
        </button>
      </div>

      {/* Список чатов */}
      <label className="pw-label" style={{ marginTop: 14 }}>Список чатов <span className="muted" style={{ fontWeight: 500 }}>— по одному в строке</span></label>
      <textarea className="input" style={{ minHeight: 84, fontFamily: "ui-monospace,monospace", fontSize: 13 }} value={chats} onChange={(e) => setChats(e.target.value)} placeholder={"@mychat\nhttps://t.me/anotherchat\n+79001234567 (id)"} />
      <div className="pw-row" style={{ marginTop: 8, alignItems: "center" }}>
        <button className="btn" onClick={check} type="button" disabled={checking || !lines.length}>{checking ? "Проверяю…" : "Проверить чаты"}</button>
        {lines.length > 0 && <span className="muted" style={{ fontSize: 12.5 }}>Добавлено чатов: {lines.length}</span>}
      </div>
      {err && <div className="tgd-msg err" style={{ marginTop: 8 }}>⚠ {err}</div>}

      {checks.length > 0 && (
        <div className="pr-check">
          {checks.map(({ link, res }, i) => (
            res.ok
              ? <CheckRow key={i} ok label={`${link} — ${res.title} · ${TYPE_LABEL[res.type || "unknown"]}${res.participantsAvailable === false ? " · список скрыт" : ""}`} />
              : <CheckRow key={i} label={`${link} — ${res.error}`} />
          ))}
        </div>
      )}

      {/* AI-защита аккаунтов */}
      <div className="pr-guard">
        <div className="pr-guard__top">
          <div><b>🛡 AI-защита аккаунтов</b> <span className="pr-new">NEW</span><div className="muted" style={{ fontSize: 12.5 }}>Интеллектуальная защита от блокировок: задержки и работа через API. Рекомендуется для больших чатов.</div></div>
          <label className="sw"><input type="checkbox" checked={protectOn} onChange={(e) => setProtectOn(e.target.checked)} /><span className="sw__t" /></label>
        </div>
        {protectOn && (
          <div className="pr-guard__lv">
            {PROTECTS.map((p) => (
              <button key={p.id} className={`pr-lv${protect === p.id ? " on" : ""}`} onClick={() => setProtect(p.id)} type="button"><b>{p.label}</b><span>{p.hint}</span></button>
            ))}
          </div>
        )}
      </div>

      {/* Быстрая работа + лимиты */}
      <div className="pr-row2">
        <label className="pr-toggle">
          <span><b>⚡ Быстрая работа</b><em className="muted">Минимальные задержки (небольшие чаты 100–1000)</em></span>
          <span className="sw"><input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /><span className="sw__t" /></span>
        </label>
        <div className="pr-limits">
          <div className="field"><label className="pw-label">{byMessages ? "Собрать пользователей" : "Лимит участников"}</label><input className="input" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div>
          <div className="field"><label className="pw-label">Период (дней, 0 = всё)</label><input className="input" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" disabled={!byMessages} title={byMessages ? "" : "Доступно в режиме «По сообщениям»"} /></div>
        </div>
      </div>

      {/* Ключевые слова */}
      {byMessages && (
        <div className="field" style={{ marginTop: 12 }}>
          <label className="pw-label">Ключевые слова <span className="muted" style={{ fontWeight: 500 }}>— соберём только тех, кто писал эти фразы (через запятую, необязательно)</span></label>
          <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="раскрутить канал, купить трафик, крипта" />
        </div>
      )}

      {/* Фильтры */}
      <div className="pr-filters">
        <div className="pr-fcard">
          <div className="pr-fcard__t">🧰 Базовые фильтры</div>
          {BASE_FILTERS.map((f) => (
            <label key={f.id} className="pr-chk"><input type="checkbox" checked={!!filters[f.id]} onChange={() => toggle(f.id)} /> <span>{f.label}</span></label>
          ))}
        </div>
        <div className="pr-fcard">
          <div className="pr-fcard__t">👤 Фильтры профиля</div>
          {PROFILE_FILTERS.map((f) => (
            <label key={f.id} className="pr-chk"><input type="checkbox" checked={!!filters[f.id]} onChange={() => toggle(f.id)} /> <span>{f.label}{f.premium ? " ⭐" : ""}</span></label>
          ))}
        </div>
        <div className="pr-fcard">
          <div className="pr-fcard__t">⚙ Дополнительно</div>
          <label className="pr-chk"><input type="checkbox" checked={!!filters.inclReplies} onChange={() => toggle("inclReplies")} disabled={!byMessages} /> <span>Включать ответы</span></label>
          <label className="pr-chk"><input type="checkbox" checked={!!filters.inclForwards} onChange={() => toggle("inclForwards")} disabled={!byMessages} /> <span>Включать пересланные</span></label>
          <button className="btn-link" style={{ marginTop: 6 }} onClick={() => setAdvOpen((v) => !v)} type="button">{advOpen ? "Скрыть задержки" : "Настройки задержек"}</button>
          {advOpen && (
            <div className="pr-delays">
              <div className="field"><label className="pw-label">Между чатами (мс)</label><input className="input" value={delayChat} onChange={(e) => setDelayChat(e.target.value.replace(/\D/g, ""))} placeholder="авто" inputMode="numeric" /></div>
              <div className="field"><label className="pw-label">Между юзерами (мс)</label><input className="input" value={delayUser} onChange={(e) => setDelayUser(e.target.value.replace(/\D/g, ""))} placeholder="авто" inputMode="numeric" /></div>
            </div>
          )}
        </div>
      </div>

      <div className="pw-row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={start} type="button" disabled={starting || !lines.length}>{starting ? "Запускаю…" : "▶ Начать парсинг"}</button>
      </div>

      {job && <JobPanel job={job} onControl={(a) => { jobControl(job.id, a); }} />}

      {job && job.audience.length > 0 && <AudienceResults job={job} />}
    </div>
  );
}

function AudienceResults({ job }: { job: Job }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"none" | "az" | "premium">("none");
  const [copied, setCopied] = useState(false);
  let rows = job.audience;
  if (q.trim()) { const s = q.toLowerCase(); rows = rows.filter((r) => (r.username || "").toLowerCase().includes(s) || (r.name || "").toLowerCase().includes(s)); }
  if (sort === "az") rows = [...rows].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (sort === "premium") rows = [...rows].sort((a, b) => Number(b.premium) - Number(a.premium));

  function copyLinks() {
    const links = job.audience.filter((r) => r.username).map((r) => "https://t.me/" + r.username.replace(/^@/, "")).join("\n");
    navigator.clipboard?.writeText(links).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }
  const withUser = job.audience.filter((r) => r.username).length;

  return (
    <div style={{ marginTop: 16 }}>
      <div className="pr-found__head">
        <b>Результаты парсинга: {job.audience.length}</b>
        <div className="pw-row" style={{ gap: 8 }}>
          <button className="btn btn-sm" onClick={copyLinks} type="button" disabled={!withUser}>{copied ? "✓ Скопировано" : `🔗 Скопировать ссылки (${withUser})`}</button>
          <a className="btn btn-sm btn-primary" href={`/api/tg/job/export?jobId=${job.id}`} download>⬇ Экспорт CSV</a>
        </div>
      </div>
      <div className="pr-restools">
        <input className="input" style={{ maxWidth: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени / username…" />
        <select className="input" style={{ maxWidth: 200 }} value={sort} onChange={(e) => setSort(e.target.value as any)}>
          <option value="none">Без сортировки</option>
          <option value="az">По имени (А–Я)</option>
          <option value="premium">Сначала Premium</option>
        </select>
        <span className="muted" style={{ fontSize: 12.5 }}>Показано: {Math.min(rows.length, 300)} из {rows.length}</span>
      </div>
      <div className="tg-table-wrap">
        <table className="tg-table">
          <thead><tr><th>user_id</th><th>username</th><th>Имя</th><th>Источник</th><th>Активность</th><th>Premium</th></tr></thead>
          <tbody>
            {rows.slice(0, 300).map((r, i) => (
              <tr key={i}><td>{r.user_id}</td><td>{r.username || "—"}</td><td>{r.name}</td><td>{r.source}</td><td>{r.activity_date || "—"}</td><td>{r.premium ? "⭐" : "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 300 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Показаны первые 300. В CSV — все {job.audience.length}.</div>}
    </div>
  );
}

function CheckRow({ ok, label }: { ok?: boolean; label: string }) {
  return <div className={`pr-check__row ${ok ? "ok" : "no"}`}><span>{ok ? "✓" : "✕"}</span> {label}</div>;
}

/* ---------- Вкладка «Контент» ---------- */
function ContentTab({ account, router }: { account: Account; router: any }) {
  const [link, setLink] = useState("");
  const [days, setDays] = useState("30");
  const [keywords, setKeywords] = useState("");
  const [limit, setLimit] = useState("200");
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const { job, poll } = useJobPoller();

  async function start() {
    setErr(""); setNote("");
    setStarting(true);
    try {
      const d = await (await fetch("/api/tg/content/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id, source: link, days: Number(days) || 0, keywords, limit: Number(limit) || 200 }) })).json();
      if (!d.ok) throw new Error(d.error || "Ошибка запуска");
      poll(d.jobId);
    } catch (e: any) { setErr(e?.message || "Ошибка запуска"); }
    finally { setStarting(false); }
  }
  function toDrafts(go: boolean) {
    if (!job || !job.content.length) return;
    addDrafts(job.content.map((c: any) => ({ text: c.text, type: "Текст" })), "Парсинг");
    if (go) router.push("/dashboard/content?tab=drafts");
    else setNote(`Сохранено в черновики: ${job.content.length}. Раздел «Контент» → «Черновики».`);
  }

  return (
    <div className="card ct-card">
      <div className="ct-hint">👉 Загрузка публикаций канала/чата через messages.getHistory: текст, дата, ссылка, просмотры, реакции и медиа. Результаты можно отправить в «Черновики».</div>

      <label className="pw-label">Ссылка или username источника</label>
      <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="@mychannel или https://t.me/mychannel" />
      <div className="pw-grid2" style={{ marginTop: 12 }}>
        <div className="field"><label className="pw-label">Период (дней, 0 = всё)</label><input className="input" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div>
        <div className="field"><label className="pw-label">Максимум публикаций</label><input className="input" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div>
      </div>
      <div className="field" style={{ marginTop: 8 }}><label className="pw-label">Ключевые слова (через запятую, необязательно)</label><input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="акция, скидка, новинка" /></div>

      <div className="pw-row" style={{ marginTop: 14 }}>
        <button className="btn btn-primary" onClick={start} type="button" disabled={starting || !link.trim()}>{starting ? "Запускаю…" : "▶ Загрузить публикации"}</button>
      </div>
      {err && <div className="tgd-msg err" style={{ marginTop: 8 }}>⚠ {err}</div>}

      {job && <JobPanel job={job} onControl={(a) => { jobControl(job.id, a); }} />}

      {job && job.content.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="pr-found__head">
            <b>Загружено публикаций: {job.content.length}</b>
            <div className="pw-row" style={{ gap: 8 }}>
              <button className="btn btn-sm" onClick={() => toDrafts(false)} type="button">💾 В черновики</button>
              <button className="btn btn-sm btn-primary" onClick={() => toDrafts(true)} type="button">В черновики и открыть →</button>
            </div>
          </div>
          {note && <div className="pr-note">{note}</div>}
          <div className="cn-list">
            {job.content.slice(0, 60).map((c: any, i: number) => (
              <div key={i} className="cn-item">
                <div className="cn-item__text">{c.text.slice(0, 240)}</div>
                <div className="cn-item__meta muted">
                  {c.date} · 👁 {c.views} · ❤ {c.reactions}{c.media ? ` · ${c.media}` : ""}
                  {c.link && <> · <a href={c.link} target="_blank" rel="noreferrer" style={{ color: "var(--violet-700)" }}>открыть</a></>}
                </div>
              </div>
            ))}
          </div>
          {job.content.length > 60 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Показаны первые 60 из {job.content.length}.</div>}
        </div>
      )}
    </div>
  );
}
