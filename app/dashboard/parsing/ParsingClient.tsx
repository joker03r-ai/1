"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { addDrafts } from "@/lib/content";
import {
  HistoryRun, loadHistory, addRun, removeRun, download,
  channelsCSV, channelsExtended, channelLinks, audienceCSVClient, audienceLinks, resolvedCSV,
} from "@/lib/parseHistory";

type Account = { id: string; username: string; name: string };
type Resolved = { ok: boolean; type?: string; title?: string; username?: string; participantsAvailable?: boolean; commentsAvailable?: boolean; suggestedMode?: string; error?: string };
type LogRow = { t: string; msg: string; kind: "info" | "ok" | "warn" | "err" };
type Job = {
  id: string; kind: string; mode: string; status: string; source: string; sources?: string[]; title?: string;
  progress: number; found: number; saved: number; skipped: number; target: number;
  error: string; floodSeconds: number; audience: any[]; content: any[]; channels?: any[]; resolved?: any[]; logs?: LogRow[];
};

const SUBTABS = [
  { id: "accounts", label: "Аккаунты", icon: "👤" },
  { id: "search", label: "Поиск каналов", icon: "🔎" },
  { id: "similar", label: "Похожие", icon: "🧭" },
  { id: "members", label: "Участники", icon: "👥" },
  { id: "messages", label: "По сообщениям", icon: "💬" },
  { id: "resolve", label: "Резолвинг", icon: "📞" },
  { id: "history", label: "История и база", icon: "🗂" },
] as const;
type SubId = typeof SUBTABS[number]["id"];
const LANGS = [{ id: "ru", label: "Русский" }, { id: "en", label: "English" }, { id: "—", label: "Другой" }];

const PROTECTS = [
  { id: "conservative", label: "Консервативный", hint: "Максимальная защита" },
  { id: "balanced", label: "Сбалансированный", hint: "Оптимально" },
  { id: "aggressive", label: "Агрессивный", hint: "Высокая скорость" },
];
const BASE_FILTERS: { id: string; label: string }[] = [
  { id: "skipBots", label: "Пропустить ботов" },
  { id: "skipDeleted", label: "Пропустить удалённых" },
  { id: "skipScam", label: "Пропустить заблокированных / scam" },
  { id: "onlyActive", label: "Были в сети (до 30 дней)" },
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [sub, setSub] = useState<SubId>("search");
  const [seed, setSeed] = useState<{ to: SubId; text: string } | null>(null);

  useEffect(() => { loadAccount(); }, []);
  async function loadAccount() {
    try {
      const d = await (await fetch("/api/tg/auth/status")).json();
      const accs: Account[] = d.accounts || [];
      setAccounts(accs);
      const savedId = localStorage.getItem("sb_tg_account_id") || "";
      const acc = accs.find((a) => a.id === savedId) || accs[0] || null;
      if (acc) localStorage.setItem("sb_tg_account_id", acc.id);
      setAccount(acc);
      if (!acc) setSub("accounts");
    } catch {}
  }
  // Передача результата из одного модуля в другой (например, каналы → участники).
  function handoff(to: SubId, text: string) { setSeed({ to, text }); setSub(to); }

  const needAcc = !account && sub !== "accounts";

  return (
    <>
      <Topbar crumbs={["Основной проект", "Парсинг"]} />
      <div className="content pz" style={{ maxWidth: 1280 }}>
        <div className="sec-head">
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Парсинг — сбор базы под вашу нишу</h1>
            <p className="muted" style={{ margin: "4px 0 0", maxWidth: 760 }}>
              База — основа любой автоматизации. Соберите уникальную качественную базу каналов и аудитории:
              поиск по ключам → расширение через похожие → сбор участников. Реальные данные Telegram (MTProto).
            </p>
          </div>
          {account && <span className="pz-acc">✅ {account.username ? "@" + account.username : account.name}</span>}
        </div>

        <div className="pz-nav">
          {SUBTABS.map((t) => (
            <button key={t.id} className={`pz-tab${sub === t.id ? " on" : ""}`} onClick={() => { setSeed(null); setSub(t.id); }} type="button">
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {needAcc ? (
          <div className="card ct-card"><div className="ct-hint">👉 Сначала подключите аккаунт Telegram — он нужен для всех задач парсинга.</div><button className="btn btn-primary" onClick={() => setSub("accounts")} type="button">Перейти к аккаунтам</button></div>
        ) : (
          <>
            {sub === "accounts" && <AccountsTab accounts={accounts} current={account} onReload={loadAccount} onPick={(id: string) => { localStorage.setItem("sb_tg_account_id", id); loadAccount(); }} />}
            {sub === "search" && account && <ChannelSearchTab account={account} seed={seed?.to === "search" ? seed.text : ""} onHandoff={handoff} />}
            {sub === "similar" && account && <SimilarTab account={account} seed={seed?.to === "similar" ? seed.text : ""} onHandoff={handoff} />}
            {sub === "members" && account && <AudienceTab account={account} initialMode="participants" seedSources={seed?.to === "members" ? seed.text : ""} />}
            {sub === "messages" && account && <AudienceTab account={account} initialMode="message_authors" seedSources={seed?.to === "messages" ? seed.text : ""} />}
            {sub === "resolve" && account && <ResolveTab account={account} />}
            {sub === "history" && <HistoryTab onHandoff={handoff} />}
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

// Автосохранение завершённой задачи в историю (навсегда, без ручного действия).
function useSaveRun(job: Job | null, kind: string, paramsFn: () => any) {
  const saved = useRef<string>("");
  useEffect(() => {
    if (!job || saved.current === job.id) return;
    if (job.status === "done" || job.status === "stopped") {
      const has = (job.channels?.length || 0) + (job.audience?.length || 0) + (job.resolved?.length || 0) > 0;
      if (has) {
        saved.current = job.id;
        addRun({ kind: kind as any, title: job.title || job.source || kind, params: paramsFn(), counts: { found: job.found, saved: job.saved }, channels: job.channels, audience: job.audience, resolved: job.resolved });
      }
    }
  }, [job?.status, job?.id]); // eslint-disable-line
}

/* ---------- Вкладка «Аудитория» (участники / по сообщениям) ---------- */
function AudienceTab({ account, initialMode = "participants", seedSources = "" }: { account: Account; initialMode?: string; seedSources?: string }) {
  const [chats, setChats] = useState(seedSources);
  const [checks, setChecks] = useState<{ link: string; res: Resolved }[]>([]);
  const [checking, setChecking] = useState(false);
  const [mode, setMode] = useState(initialMode);
  useEffect(() => { if (seedSources) setChats(seedSources); }, [seedSources]);
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
  useSaveRun(job, "audience", () => ({ mode, target, days, keywords, filters }));

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

/* ================= Общие блоки ================= */
function Guard({ on, setOn, level, setLevel, fast, setFast }: any) {
  return (
    <div className="pr-row2" style={{ marginTop: 14 }}>
      <div className="pr-guard" style={{ margin: 0 }}>
        <div className="pr-guard__top">
          <div><b>🛡 AI-защита аккаунтов</b> <span className="pr-new">NEW</span><div className="muted" style={{ fontSize: 12.5 }}>Динамические задержки против блокировок. Для больших объёмов не отключайте.</div></div>
          <label className="sw"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /><span className="sw__t" /></label>
        </div>
        {on && <div className="pr-guard__lv">{PROTECTS.map((p) => <button key={p.id} className={`pr-lv${level === p.id ? " on" : ""}`} onClick={() => setLevel(p.id)} type="button"><b>{p.label}</b><span>{p.hint}</span></button>)}</div>}
      </div>
      <label className="pr-toggle"><span><b>⚡ Быстрая работа</b><em className="muted">Минимальные задержки (небольшие объёмы)</em></span><span className="sw"><input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /><span className="sw__t" /></span></label>
    </div>
  );
}

function ChannelFilters({ f, set }: { f: any; set: (p: any) => void }) {
  const toggleLang = (id: string) => set({ langs: f.langs.includes(id) ? f.langs.filter((x: string) => x !== id) : [...f.langs, id] });
  return (
    <div className="pz-filters">
      <div className="pr-fcard">
        <div className="pr-fcard__t">📊 Основные фильтры каналов</div>
        <label className="af"><span>Минимум подписчиков</span><input className="input" value={f.minSubs || ""} onChange={(e) => set({ minSubs: Number(e.target.value.replace(/\D/g, "")) || 0 })} placeholder="напр. 1000" inputMode="numeric" /></label>
        <label className="pr-chk" style={{ marginTop: 8 }}><input type="checkbox" checked={f.onlyComments} onChange={(e) => set({ onlyComments: e.target.checked })} /> <span>Только с открытыми комментариями</span></label>
        <label className="pr-chk"><input type="checkbox" checked={f.onlyActive} onChange={(e) => set({ onlyActive: e.target.checked })} /> <span>Только активные каналы</span></label>
      </div>
      <div className="pr-fcard">
        <div className="pr-fcard__t">⭐ Рейтинг для рассылки: <b>{f.minRating}+</b></div>
        <input type="range" min={1} max={10} step={1} value={f.minRating} onChange={(e) => set({ minRating: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--violet)" }} />
        <div className="muted" style={{ fontSize: 11.5 }}>Эвристика: просмотры/подписчики, частота постинга, описание, возраст, комментарии.</div>
        <div className="pr-fcard__t" style={{ marginTop: 12 }}>🌐 Язык</div>
        <div className="pw-chips">{LANGS.map((l) => <button key={l.id} className={`pw-chip${f.langs.includes(l.id) ? " on" : ""}`} onClick={() => toggleLang(l.id)} type="button">{f.langs.includes(l.id) ? "✓ " : ""}{l.label}</button>)}</div>
      </div>
    </div>
  );
}

function ChannelResults({ rows, onHandoff }: { rows: any[]; onHandoff: (to: SubId, text: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("subs");
  const [copied, setCopied] = useState(false);
  let list = rows;
  if (q.trim()) { const s = q.toLowerCase(); list = list.filter((r) => (r.title || "").toLowerCase().includes(s) || (r.username || "").toLowerCase().includes(s)); }
  if (sort === "subs") list = [...list].sort((a, b) => b.subscribers - a.subscribers);
  if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
  const links = () => rows.map((r) => r.username || r.link).filter(Boolean).join("\n");
  function copyLinks() { navigator.clipboard?.writeText(channelLinks(rows)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ marginTop: 16 }}>
      <div className="pr-found__head">
        <b>Каналов в базе: {rows.length}</b>
        <div className="pw-row" style={{ gap: 6 }}>
          <button className="btn btn-sm" onClick={copyLinks} type="button">{copied ? "✓ Скопировано" : "🔗 Ссылки"}</button>
          <button className="btn btn-sm" onClick={() => download(`channels_${stamp}.csv`, channelsCSV(rows), "text/csv")} type="button">⬇ Excel/CSV</button>
          <button className="btn btn-sm" onClick={() => download(`channels_ext_${stamp}.json`, channelsExtended(rows, "json"), "application/json")} type="button">JSON</button>
          <button className="btn btn-sm" onClick={() => download(`channels_ext_${stamp}.txt`, channelsExtended(rows, "txt"))} type="button">TXT для ИИ</button>
        </div>
      </div>
      <div className="pr-restools">
        <input className="input" style={{ maxWidth: 240 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск канала…" />
        <select className="input" style={{ maxWidth: 190 }} value={sort} onChange={(e) => setSort(e.target.value)}><option value="subs">По подписчикам</option><option value="rating">По рейтингу</option></select>
        <div className="pw-row" style={{ gap: 6, marginLeft: "auto" }}>
          <button className="btn btn-sm btn-primary" onClick={() => onHandoff("similar", links())} type="button">→ Расширить (Похожие)</button>
          <button className="btn btn-sm" onClick={() => onHandoff("members", rows.map((r) => r.link || r.username).filter(Boolean).join("\n"))} type="button">→ Участники</button>
        </div>
      </div>
      <div className="tg-table-wrap">
        <table className="tg-table">
          <thead><tr><th>Канал</th><th>Подписчики</th><th>Рейтинг</th><th>Комменты</th><th>Язык</th><th>Тип</th><th>~Просмотры</th><th>Постов/день</th></tr></thead>
          <tbody>
            {list.slice(0, 300).map((r, i) => (
              <tr key={i}>
                <td>{r.link ? <a href={r.link} target="_blank" rel="noreferrer" style={{ color: "var(--violet-700)", fontWeight: 600 }}>{r.title}</a> : r.title}<div className="muted" style={{ fontSize: 11 }}>{r.username}</div></td>
                <td>{r.subscribers.toLocaleString("ru-RU")}</td>
                <td><span className={`pz-rate r${r.rating >= 7 ? "hi" : r.rating >= 4 ? "mid" : "lo"}`}>{r.rating}</span></td>
                <td>{r.comments ? "✓" : "—"}</td>
                <td>{r.language}</td>
                <td>{r.type}</td>
                <td>{r.avgViews ? r.avgViews.toLocaleString("ru-RU") : "—"}</td>
                <td>{r.postFreq || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 300 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Показаны первые 300. В экспорте — все {rows.length}.</div>}
    </div>
  );
}

/* ================= 1.1 Аккаунты ================= */
function AccountsTab({ accounts, current, onReload, onPick }: any) {
  return (
    <div className="card ct-card">
      <div className="ct-hint">👉 Аккаунты Telegram для парсинга. Для первичного поиска достаточно одного. Сессии шифруются и хранятся на сервере — работа продолжается после закрытия браузера.</div>
      {accounts.length > 0 && (
        <div className="pz-acclist">
          {accounts.map((a: Account) => (
            <div key={a.id} className={`pz-accrow${current?.id === a.id ? " on" : ""}`}>
              <span className="pz-accava">{(a.username || a.name || "A").replace(/^@/, "").slice(0, 1).toUpperCase()}</span>
              <div className="pz-accid"><b>{a.username ? "@" + a.username : a.name}</b><span className="muted">{a.name}</span></div>
              <span className="pz-status s-ok">● Активен</span>
              {current?.id === a.id ? <span className="asx-tag ok">выбран</span> : <button className="btn btn-sm" onClick={() => onPick(a.id)} type="button">Выбрать</button>}
              <button className="user-act del" onClick={async () => { await fetch("/api/tg/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: a.id }) }); onReload(); }} type="button">Удалить</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <div className="pz-sub">Добавить аккаунт по номеру телефона</div>
        <LoginCard onDone={onReload} />
        <div className="tgd-info" style={{ marginTop: 12 }}>📁 Импорт папок <b>TData</b> и файлов <b>.session</b> доступен в десктоп-версии парсера (в вебе Telegram не даёт читать локальные сессии из соображений безопасности). Здесь используйте вход по номеру.</div>
      </div>
    </div>
  );
}

/* ================= 1.2 Поиск каналов ================= */
const KW_HINTS = ["крипта", "трейдинг", "инвестиции", "маркетинг", "новости", "бизнес"];
const SFX_HINTS = ["новости", "2026", "сигналы", "чат", "обучение", "россия"];
function ChannelSearchTab({ account, seed, onHandoff }: any) {
  const [keywords, setKeywords] = useState("");
  const [suffixes, setSuffixes] = useState("");
  const [f, setF] = useState({ minSubs: 1000, onlyComments: false, minRating: 1, langs: [] as string[], onlyActive: false });
  const [on, setOn] = useState(true); const [level, setLevel] = useState("balanced"); const [fast, setFast] = useState(false);
  const [starting, setStarting] = useState(false); const [err, setErr] = useState("");
  const { job, poll } = useJobPoller();
  useSaveRun(job, "channels", () => ({ keywords, suffixes, filters: f }));
  const kw = keywords.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const sfx = suffixes.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const combos = kw.length * (1 + sfx.length);

  async function start() {
    if (!kw.length) { setErr("Добавьте ключевые слова"); return; }
    setErr(""); setStarting(true);
    try {
      const d = await (await fetch("/api/tg/channels/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id, keywords: kw, suffixes: sfx, filters: f, protect: on ? level : "off", fast }) })).json();
      if (!d.ok) throw new Error(d.error || "Ошибка"); poll(d.jobId);
    } catch (e: any) { setErr(e?.message || "Ошибка"); } finally { setStarting(false); }
  }

  return (
    <div className="card ct-card">
      <div className="ct-hint">👉 Система сама вписывает слова в общий поиск Telegram, перебирает каналы и отсеивает ботов. Telegram отдаёт ~10 каналов на запрос — комбинатор «ключ × окончание» умножает охват, а массово базу наращивает вкладка «Похожие».</div>
      <div className="pz-2col">
        <label className="af"><span>Ключевые слова <em className="muted">— по одному в строке или через запятую</em></span><textarea className="input" style={{ minHeight: 90 }} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={"крипта\nкриптовалюта\nбиткоин"} /></label>
        <label className="af"><span>Окончания (суффиксы) <em className="muted">— комбинируются с каждым ключом</em></span><textarea className="input" style={{ minHeight: 90 }} value={suffixes} onChange={(e) => setSuffixes(e.target.value)} placeholder={"новости\n2026\nсигналы"} /></label>
      </div>
      <div className="pz-hints"><span className="muted">Подсказки:</span> {KW_HINTS.map((h) => <button key={h} className="pz-hint" onClick={() => setKeywords((v) => (v ? v + "\n" : "") + h)} type="button">+ {h}</button>)}<span className="muted" style={{ marginLeft: 8 }}>окончания:</span> {SFX_HINTS.map((h) => <button key={h} className="pz-hint" onClick={() => setSuffixes((v) => (v ? v + "\n" : "") + h)} type="button">+ {h}</button>)}</div>
      {combos > 0 && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Поисковых запросов будет: <b>{combos}</b></div>}
      <ChannelFilters f={f} set={(p) => setF({ ...f, ...p })} />
      <Guard on={on} setOn={setOn} level={level} setLevel={setLevel} fast={fast} setFast={setFast} />
      {err && <div className="tgd-msg err" style={{ marginTop: 10 }}>⚠ {err}</div>}
      <div className="pw-row" style={{ marginTop: 14 }}><button className="btn btn-primary" onClick={start} type="button" disabled={starting || !kw.length}>{starting ? "Запускаю…" : "▶ Запустить поиск"}</button></div>
      {job && <JobPanel job={job} onControl={(a) => jobControl(job.id, a)} />}
      {job && (job.channels?.length || 0) > 0 && <ChannelResults rows={job.channels!} onHandoff={onHandoff} />}
    </div>
  );
}

/* ================= 1.3 Похожие каналы ================= */
function SimilarTab({ account, seed, onHandoff }: any) {
  const [sources, setSources] = useState<string>(seed || "");
  useEffect(() => { if (seed) setSources(seed); }, [seed]);
  const [depth, setDepth] = useState(1); const [dedup, setDedup] = useState(true);
  const [f, setF] = useState({ minSubs: 0, onlyComments: false, minRating: 1, langs: [] as string[], onlyActive: false });
  const [on, setOn] = useState(true); const [level, setLevel] = useState("balanced"); const [fast, setFast] = useState(false);
  const [starting, setStarting] = useState(false); const [err, setErr] = useState("");
  const { job, poll } = useJobPoller();
  useSaveRun(job, "channels", () => ({ mode: "similar", depth, filters: f }));
  const list = sources.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

  async function start() {
    if (!list.length) { setErr("Вставьте исходные каналы"); return; }
    setErr(""); setStarting(true);
    try {
      const d = await (await fetch("/api/tg/channels/similar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id, sources: list.slice(0, 50), depth, dedup, filters: f, protect: on ? level : "off", fast }) })).json();
      if (!d.ok) throw new Error(d.error || "Ошибка"); poll(d.jobId);
    } catch (e: any) { setErr(e?.message || "Ошибка"); } finally { setStarting(false); }
  }

  return (
    <div className="card ct-card">
      <div className="ct-hint">👉 Telegram на каждый канал даёт до +10 похожих (до +100 с Premium). Так база растёт экспоненциально: 10 → +14 → +28… Возьмите результат, снова вставьте сюда и запустите — итеративно.</div>
      <label className="af"><span>Исходные каналы <em className="muted">— вставьте базу (до 50 штук), по одному в строке</em></span><textarea className="input" style={{ minHeight: 110, fontFamily: "ui-monospace,monospace", fontSize: 13 }} value={sources} onChange={(e) => setSources(e.target.value)} placeholder={"@channel1\nhttps://t.me/channel2"} /></label>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Исходных каналов: <b>{Math.min(list.length, 50)}</b>{list.length > 50 ? " (возьмём первые 50)" : ""}</div>
      <div className="pz-2col" style={{ marginTop: 12 }}>
        <label className="af"><span>Глубина расширения</span>
          <div className="asx-seg">
            <button className={`asx-seg__b${depth === 1 ? " on" : ""}`} onClick={() => setDepth(1)} type="button">1 — рекомендуется</button>
            <button className={`asx-seg__b${depth === 2 ? " on" : ""}`} onClick={() => setDepth(2)} type="button">2 — осторожно</button>
          </div>
        </label>
        <label className="pr-chk" style={{ alignSelf: "end" }}><input type="checkbox" checked={dedup} onChange={(e) => setDedup(e.target.checked)} /> <span>Жёсткая дедупликация по channel_id</span></label>
      </div>
      {depth === 2 && <div className="tgd-info" style={{ marginTop: 8 }}>⚠ Глубина 2 берёт похожие для похожих — база растёт сильнее, но тематика может сбиваться.</div>}
      <ChannelFilters f={f} set={(p) => setF({ ...f, ...p })} />
      <Guard on={on} setOn={setOn} level={level} setLevel={setLevel} fast={fast} setFast={setFast} />
      {err && <div className="tgd-msg err" style={{ marginTop: 10 }}>⚠ {err}</div>}
      <div className="pw-row" style={{ marginTop: 14 }}><button className="btn btn-primary" onClick={start} type="button" disabled={starting || !list.length}>{starting ? "Запускаю…" : "▶ Расширить базу"}</button></div>
      {job && <JobPanel job={job} onControl={(a) => jobControl(job.id, a)} />}
      {job && (job.channels?.length || 0) > 0 && <ChannelResults rows={job.channels!} onHandoff={onHandoff} />}
    </div>
  );
}

/* ================= 1.6 Резолвинг номеров ================= */
function ResolveTab({ account }: any) {
  const [phones, setPhones] = useState("");
  const [starting, setStarting] = useState(false); const [err, setErr] = useState("");
  const { job, poll } = useJobPoller();
  useSaveRun(job, "resolve", () => ({ count: phones.split(/[\n,;]/).filter(Boolean).length }));
  const list = phones.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);

  async function onFile(files: FileList | null) {
    if (!files || !files[0]) return;
    try { const t = await files[0].text(); setPhones((v) => (v ? v + "\n" : "") + t.slice(0, 200000)); } catch {}
  }
  async function start() {
    if (!list.length) { setErr("Добавьте номера"); return; }
    setErr(""); setStarting(true);
    try {
      const d = await (await fetch("/api/tg/phones/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id, phones: list }) })).json();
      if (!d.ok) throw new Error(d.error || "Ошибка"); poll(d.jobId);
    } catch (e: any) { setErr(e?.message || "Ошибка"); } finally { setStarting(false); }
  }

  return (
    <div className="card ct-card">
      <div className="ct-hint">👉 Резолвинг «телефон → user_id / @username» через адресную книгу аккаунта (ImportContacts → проверка → DeleteContacts для очистки). Учитываются политики приватности: скрытые номера не находятся.</div>
      <label className="asx-upload"><input type="file" accept=".txt,.csv" hidden onChange={(e) => onFile(e.target.files)} />📎 Загрузить .txt / .csv</label>
      <label className="af" style={{ marginTop: 10 }}><span>Список телефонов <em className="muted">— по одному в строке</em></span><textarea className="input" style={{ minHeight: 120, fontFamily: "ui-monospace,monospace", fontSize: 13 }} value={phones} onChange={(e) => setPhones(e.target.value)} placeholder={"+79001234567\n79007654321"} /></label>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Номеров: <b>{list.length}</b></div>
      {err && <div className="tgd-msg err" style={{ marginTop: 10 }}>⚠ {err}</div>}
      <div className="pw-row" style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={start} type="button" disabled={starting || !list.length}>{starting ? "Запускаю…" : "▶ Резолвить номера"}</button></div>
      {job && <JobPanel job={job} onControl={(a) => jobControl(job.id, a)} />}
      {job && (job.resolved?.length || 0) > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="pr-found__head"><b>Найдено: {job.resolved!.filter((r: any) => r.found).length} из {job.resolved!.length}</b>
            <a className="btn btn-sm" onClick={() => download(`resolved_${new Date().toISOString().slice(0, 10)}.csv`, resolvedCSV(job.resolved as any), "text/csv")}>⬇ Экспорт CSV</a>
          </div>
          <div className="tg-table-wrap"><table className="tg-table"><thead><tr><th>Телефон</th><th>user_id</th><th>username</th><th>Имя</th><th>Статус</th></tr></thead>
            <tbody>{job.resolved!.slice(0, 300).map((r: any, i: number) => <tr key={i}><td>{r.phone}</td><td>{r.user_id || "—"}</td><td>{r.username || "—"}</td><td>{r.name || "—"}</td><td>{r.found ? <span className="asx-tag ok">найден</span> : <span className="muted">не найден</span>}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

/* ================= 1.7 История и база ================= */
function HistoryTab({ onHandoff }: { onHandoff: (to: SubId, text: string) => void }) {
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [open, setOpen] = useState<HistoryRun | null>(null);
  useEffect(() => { setRuns(loadHistory()); }, []);
  function del(id: string) { removeRun(id); setRuns(loadHistory()); if (open?.id === id) setOpen(null); }
  const KIND_LABEL: Record<string, string> = { channels: "Каналы", audience: "Аудитория", resolve: "Резолвинг", content: "Контент" };

  if (open) {
    const isCh = open.kind === "channels"; const isRes = open.kind === "resolve";
    const rows: any[] = isCh ? (open.channels || []) : isRes ? (open.resolved || []) : (open.audience || []);
    return (
      <div className="card ct-card">
        <div className="pr-found__head">
          <div><button className="btn-link" onClick={() => setOpen(null)} type="button">← История</button> <b style={{ marginLeft: 8 }}>{open.title}</b> <span className="muted">· {new Date(open.date).toLocaleString("ru-RU")}</span></div>
        </div>
        {isCh && <ChannelResults rows={rows} onHandoff={onHandoff} />}
        {isRes && (<>
          <div className="pw-row" style={{ margin: "8px 0" }}><button className="btn btn-sm" onClick={() => download(`resolved.csv`, resolvedCSV(rows as any), "text/csv")} type="button">⬇ CSV</button></div>
          <div className="tg-table-wrap"><table className="tg-table"><thead><tr><th>Телефон</th><th>user_id</th><th>username</th><th>Имя</th></tr></thead><tbody>{rows.slice(0, 300).map((r, i) => <tr key={i}><td>{r.phone}</td><td>{r.user_id || "—"}</td><td>{r.username || "—"}</td><td>{r.name || "—"}</td></tr>)}</tbody></table></div>
        </>)}
        {open.kind === "audience" && (<>
          <div className="pw-row" style={{ margin: "8px 0", gap: 6 }}>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(audienceLinks(rows as any))} type="button">🔗 Ссылки</button>
            <button className="btn btn-sm" onClick={() => download(`audience.csv`, audienceCSVClient(rows as any), "text/csv")} type="button">⬇ CSV</button>
          </div>
          <div className="tg-table-wrap"><table className="tg-table"><thead><tr><th>user_id</th><th>username</th><th>Имя</th><th>Источник</th></tr></thead><tbody>{rows.slice(0, 300).map((r, i) => <tr key={i}><td>{r.user_id}</td><td>{r.username || "—"}</td><td>{r.name}</td><td>{r.source}</td></tr>)}</tbody></table></div>
        </>)}
      </div>
    );
  }

  return (
    <div className="card ct-card">
      <div className="ct-hint">👉 Все запуски сохраняются автоматически и навсегда. Вернитесь к любой базе в любой момент, откройте её и экспортируйте.</div>
      {runs.length === 0 ? (
        <div className="ct-empty"><div>Истории пока нет. Запустите поиск каналов или парсинг — результат появится здесь.</div></div>
      ) : (
        <div className="pz-hist">
          {runs.map((r) => {
            const cnt = (r.channels?.length || 0) + (r.audience?.length || 0) + (r.resolved?.length || 0);
            return (
              <div key={r.id} className="pz-histrow">
                <span className="pz-histk">{KIND_LABEL[r.kind] || r.kind}</span>
                <div className="pz-histmain"><b>{r.title}</b><span className="muted">{new Date(r.date).toLocaleString("ru-RU")} · записей: {cnt}</span></div>
                <button className="btn btn-sm btn-primary" onClick={() => setOpen(r)} type="button">Открыть</button>
                <button className="user-act del" onClick={() => del(r.id)} type="button">Удалить</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
