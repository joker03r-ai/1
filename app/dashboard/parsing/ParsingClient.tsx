"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { addDrafts } from "@/lib/content";

type Account = { id: string; username: string; name: string };
type Resolved = { ok: boolean; type?: string; title?: string; username?: string; participantsAvailable?: boolean; commentsAvailable?: boolean; suggestedMode?: string; error?: string };
type Job = {
  id: string; kind: string; mode: string; status: string; source: string;
  progress: number; found: number; saved: number; skipped: number; target: number;
  error: string; floodSeconds: number; audience: any[]; content: any[];
};

const TYPE_LABEL: Record<string, string> = { supergroup: "Супергруппа", broadcast: "Канал (broadcast)", group: "Группа", user: "Пользователь", unknown: "Неизвестно" };
const MODES = [
  { id: "participants", label: "Участники группы" },
  { id: "message_authors", label: "Авторы сообщений" },
  { id: "comment_authors", label: "Комментаторы канала" },
];
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
    </div>
  );
}

/* ---------- Вкладка «Аудитория» ---------- */
function AudienceTab({ account }: { account: Account }) {
  const [link, setLink] = useState("");
  const [res, setRes] = useState<Resolved | null>(null);
  const [checking, setChecking] = useState(false);
  const [mode, setMode] = useState("participants");
  const [target, setTarget] = useState("1000");
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState("");
  const { job, poll, reset } = useJobPoller();

  async function check() {
    setErr(""); setRes(null); setChecking(true); reset();
    try {
      const d: Resolved = await (await fetch("/api/tg/source/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id, link }) })).json();
      setRes(d);
      if (d.ok && d.suggestedMode) setMode(d.suggestedMode);
    } catch (e: any) { setErr("Не удалось проверить источник"); }
    finally { setChecking(false); }
  }
  async function start() {
    setErr(""); setStarting(true);
    try {
      const d = await (await fetch("/api/tg/audience/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id, source: link, mode, target: Number(target) || 1000 }) })).json();
      if (!d.ok) throw new Error(d.error || "Ошибка запуска");
      poll(d.jobId);
    } catch (e: any) { setErr(e?.message || "Ошибка запуска"); }
    finally { setStarting(false); }
  }

  const participantsBlocked = res?.ok && res.type !== "user" && (res.type === "supergroup" || res.type === "group") && res.participantsAvailable === false;

  return (
    <div className="card ct-card">
      <div className="ct-hint">👉 Вставьте ссылку или @username источника, проверьте доступность и запустите сбор. Участники доступны только у групп, где список открыт или у вас есть права.</div>

      <label className="pw-label">Ссылка или username источника</label>
      <div className="pw-row">
        <input className="input" style={{ flex: 1, minWidth: 220 }} value={link} onChange={(e) => setLink(e.target.value)} placeholder="@mychat или https://t.me/mychat" />
        <button className="btn" onClick={check} type="button" disabled={checking || !link.trim()}>{checking ? "Проверяю…" : "Проверить"}</button>
      </div>
      {err && <div className="tgd-msg err" style={{ marginTop: 8 }}>⚠ {err}</div>}

      {/* Проверка перед запуском */}
      {res && (
        <div className="pr-check">
          {res.ok ? (
            <>
              <CheckRow ok label="Аккаунт подключён" />
              <CheckRow ok label={`Источник найден: ${res.title}`} />
              <CheckRow ok label={`Тип источника: ${TYPE_LABEL[res.type || "unknown"]}`} />
              <CheckRow ok={res.participantsAvailable} label={res.participantsAvailable ? "Список участников доступен" : "Список участников недоступен"} />
              {res.type === "broadcast" && <CheckRow ok={res.commentsAvailable} label={res.commentsAvailable ? "Есть группа обсуждений — доступны комментаторы" : "Группы обсуждений нет — только парсинг контента"} />}
              <CheckRow ok label={`Предполагаемый режим: ${MODES.find((m) => m.id === res.suggestedMode)?.label || "—"}`} />
            </>
          ) : (
            <div className="tgd-msg err">⚠ {res.error}</div>
          )}
        </div>
      )}

      {res?.ok && (
        <>
          <label className="pw-label" style={{ marginTop: 14 }}>Режим сбора</label>
          <div className="pw-chips">
            {MODES.map((m) => {
              const disabled = m.id === "participants" && res.participantsAvailable === false;
              const disabled2 = m.id === "comment_authors" && res.type === "broadcast" && !res.commentsAvailable;
              return (
                <button key={m.id} className={`pw-chip${mode === m.id ? " on" : ""}`} disabled={disabled || disabled2} onClick={() => setMode(m.id)} type="button" title={disabled ? "Список участников недоступен" : ""}>
                  {mode === m.id ? "✓ " : ""}{m.label}
                </button>
              );
            })}
          </div>
          {participantsBlocked && (
            <div className="tgd-info" style={{ marginTop: 10 }}>Telegram не предоставляет список участников этой группы. Вступите в неё или получите права администратора — либо используйте режим <b>«Авторы сообщений»</b>.</div>
          )}

          <div className="field" style={{ marginTop: 12, maxWidth: 200 }}><label className="pw-label">Сколько собрать</label><input className="input" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div>

          <div className="pw-row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={start} type="button" disabled={starting}>{starting ? "Запускаю…" : "▶ Запустить"}</button>
          </div>
        </>
      )}

      {job && <JobPanel job={job} onControl={(a) => { jobControl(job.id, a); }} />}

      {/* Результаты */}
      {job && job.audience.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="pr-found__head">
            <b>Собрано участников: {job.audience.length}</b>
            <a className="btn btn-sm" href={`/api/tg/job/export?jobId=${job.id}`} download>⬇ Экспорт CSV</a>
          </div>
          <div className="tg-table-wrap">
            <table className="tg-table">
              <thead><tr><th>user_id</th><th>username</th><th>Имя</th><th>Источник</th><th>Активность</th></tr></thead>
              <tbody>
                {job.audience.slice(0, 200).map((r, i) => (
                  <tr key={i}><td>{r.user_id}</td><td>{r.username}</td><td>{r.name}</td><td>{r.source}</td><td>{r.activity_date || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {job.audience.length > 200 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Показаны первые 200. В CSV — все {job.audience.length}.</div>}
        </div>
      )}
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
