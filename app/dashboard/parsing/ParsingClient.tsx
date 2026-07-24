"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark } from "@/components/icons";
import { MtSession, loadMt, saveMt, clearMt } from "@/lib/tgchats";
import { ParseRun, loadHistory, saveHistory } from "@/lib/parsing";
import { addDrafts } from "@/lib/content";

// Реальный чат из Telegram (contacts.Search через аккаунт).
type RealChat = { id: string; title: string; username: string; link: string; members: number; type: string; keyword: string };

const TYPE_LABEL: Record<string, string> = { channel: "Канал", supergroup: "Супергруппа", group: "Группа" };

export default function ParsingClient() {
  const router = useRouter();
  const [mt, setMt] = useState<MtSession | null>(null);

  // Логин по аккаунту Telegram (нужен для реального поиска чатов).
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

  // Поиск
  const [keywords, setKeywords] = useState("");
  const [minM, setMinM] = useState("100");
  const [maxM, setMaxM] = useState("");
  const [limit, setLimit] = useState("50");
  const [found, setFound] = useState<RealChat[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [history, setHistory] = useState<ParseRun[]>([]);
  const [note, setNote] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const saved = loadMt();
    if (saved) { setMt(saved); setApiId(saved.apiId); setApiHash(saved.apiHash); setSess(saved.session); setStep("ready"); }
    setHistory(loadHistory());
    try {
      const raw = localStorage.getItem("sb_found_chats");
      if (raw) setFound(JSON.parse(raw));
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
    clearMt(); setMt(null); setStep("creds"); setSess(""); setNeedPass(false); setCode(""); setPass("");
  }

  async function start() {
    setErr(""); setNote("");
    const qs = keywords.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!qs.length) { setErr("Укажите ключевые слова для поиска."); return; }
    setSearching(true);
    try {
      const r = await fetch("/api/telegram/mtproto/search-chats", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiId: mt!.apiId, apiHash: mt!.apiHash, session: mt!.session, keywords: qs, limit: Number(limit) || 50, minMembers: Number(minM) || 0, maxMembers: Number(maxM) || 0 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка поиска");
      const chats: RealChat[] = d.chats || [];
      setFound(chats);
      setSel(chats.map((c) => c.id));
      try { localStorage.setItem("sb_found_chats", JSON.stringify(chats)); } catch {}
      const run: ParseRun = { id: "r_" + Date.now(), at: Date.now(), keywords: qs.join(", "), source: "Поиск по Telegram", count: chats.length };
      const hist = [run, ...history].slice(0, 20);
      setHistory(hist); saveHistory(hist);
      setNote(d.note || `Найдено чатов: ${chats.length}`);
    } catch (e: any) {
      setErr(e?.message || "Не удалось выполнить поиск");
    } finally { setSearching(false); }
  }

  function toggleSel(id: string) { setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); }
  const chosen = found.filter((c) => sel.includes(c.id));

  function saveToDrafts(go: boolean) {
    const list = chosen.length ? chosen : found;
    if (!list.length) { setNote("Сначала выполните поиск."); return; }
    addDrafts(list.map((c) => ({ text: `Целевой чат по нише «${c.keyword}»: ${c.title} — ${c.link || c.username || c.id} · ${c.members} участников`, type: "Чат" })), "Парсинг");
    if (go) router.push("/dashboard/content?tab=drafts");
    else setNote(`Сохранено в черновики: ${list.length}. Раздел «Контент» → «Черновики».`);
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Парсинг"]} />
      <div className="content" style={{ maxWidth: 1080 }}>
        <div className="sec-head">
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Парсинг аудитории и контента</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Поиск идёт по <b>реальным чатам и каналам Telegram</b> через ваш аккаунт (метод contacts.Search).
              Найденные материалы сохраняются в «Черновики». Здесь ничего не публикуется автоматически.
            </p>
          </div>
        </div>

        <div className="pr-flow">Парсинг → <b>Черновики</b> → Создание контента → Календарь → Публикация</div>

        {/* Требуется вход в аккаунт Telegram */}
        {step !== "ready" && (
          <div className="card pr-card" style={{ maxWidth: 560 }}>
            <div className="pr-card__t">🔐 Подключите аккаунт Telegram</div>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Поиск реальных чатов работает через ваш аккаунт. Получите <b>api_id</b> и <b>api_hash</b> на{" "}
              <a href="https://my.telegram.org" target="_blank" rel="noreferrer" style={{ color: "var(--violet-700)", fontWeight: 700 }}>my.telegram.org</a>.
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
            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Сессия хранится локально в браузере. Полноценный менеджер аккаунтов — в разделе <Link href="/dashboard/user-parser" style={{ color: "var(--violet-700)" }}>Парсер аудитории</Link>.</div>
          </div>
        )}

        {step === "ready" && (
          <>
            <div className="pr-grid">
              {/* Настройки поиска */}
              <div className="card pr-card">
                <div className="pr-found__head" style={{ marginBottom: 12 }}>
                  <div className="pr-card__t" style={{ margin: 0 }}>🔍 Поиск реальных чатов</div>
                  <button className="btn-link" onClick={logout} type="button">Аккаунт: {mt?.user || "подключён"} · выйти</button>
                </div>

                <label className="pw-label">Ключевые слова (через запятую)</label>
                <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="здоровье, клиника, врач…" />

                <div className="pw-grid2" style={{ marginTop: 12 }}>
                  <div className="field"><label className="pw-label">Мин. участников</label><input className="input" value={minM} onChange={(e) => setMinM(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div>
                  <div className="field"><label className="pw-label">Макс. участников</label><input className="input" value={maxM} onChange={(e) => setMaxM(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="без ограничения" /></div>
                </div>
                <div className="field" style={{ marginTop: 8, maxWidth: 200 }}><label className="pw-label">Сколько найти</label><input className="input" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div>

                <div className="pw-row" style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={start} type="button" disabled={searching}>{searching ? "Ищу в Telegram…" : "🔍 Запустить парсинг"}</button>
                </div>
                {err && <div className="tgd-msg err" style={{ marginTop: 10 }}>⚠ {err}</div>}
                {note && <div className="pr-note">{note}</div>}
              </div>

              {/* История */}
              <div className="card pr-card">
                <div className="pr-card__t">🕓 История парсинга</div>
                {history.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>Запусков ещё не было.</div>
                ) : (
                  <div className="pr-hist">
                    {history.map((r) => (
                      <div key={r.id} className="pr-hist__row">
                        <div>
                          <b>{new Date(r.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b>
                          <div className="muted" style={{ fontSize: 12 }}>«{r.keywords}» · {r.source}</div>
                        </div>
                        <span className="pr-hist__n">{r.count} шт.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Найденные чаты */}
            <div className="card pr-card" style={{ marginTop: 16 }}>
              <div className="pr-found__head">
                <div className="pr-card__t" style={{ margin: 0 }}>Найденные чаты {found.length > 0 && `· ${found.length}`}</div>
                {found.length > 0 && <button className="btn-link" type="button" onClick={() => setSel(sel.length === found.length ? [] : found.map((c) => c.id))}>{sel.length === found.length ? "Снять выделение" : "Выбрать все"}</button>}
              </div>

              {found.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
                  Задайте ключевые слова и нажмите «Запустить парсинг» — Telegram вернёт реальные чаты и каналы, которые можно открыть по ссылке.
                </div>
              ) : (
                <>
                  <div className="pr-found__grid">
                    {found.map((c) => (
                      <div key={c.id} className={`pr-mat${sel.includes(c.id) ? " on" : ""}`}>
                        <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggleSel(c.id)} />
                        <span className="pr-mat__ico">{c.type === "channel" ? "📢" : "💬"}</span>
                        <div className="pr-mat__body">
                          <b>{c.title}</b>
                          <span className="muted">{TYPE_LABEL[c.type] || "Чат"} · {c.members.toLocaleString("ru-RU")} участников · нашли по «{c.keyword}»</span>
                          {c.link ? <a className="pr-mat__link" href={c.link} target="_blank" rel="noreferrer">{c.link}</a> : <span className="muted" style={{ fontSize: 12 }}>приватный (без публичной ссылки)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pr-actions">
                    <span className="muted" style={{ fontSize: 12.5 }}>Выбрано: {chosen.length || found.length}</span>
                    <div style={{ flex: 1 }} />
                    <button className="btn" onClick={() => saveToDrafts(false)} type="button">💾 Сохранить в черновики</button>
                    <button className="btn btn-ai" onClick={() => saveToDrafts(true)} type="button"><IconSpark className="ico" /> Создать контент →</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
