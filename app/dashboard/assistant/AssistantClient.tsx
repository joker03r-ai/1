"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import Topbar from "@/components/Topbar";
import { IconSpark, IconChat, IconCheck, IconBook, IconPlus } from "@/components/icons";
import {
  Assistant, AssistantStyle, STYLE_LABELS, Provider, PROVIDERS, LENGTHS, NO_ANSWER_LABELS, NoAnswer, Length,
  KbFile, QA, loadAssistant, saveAssistant, kbFilled, kbText, behaviorInstruction,
} from "@/lib/assistant";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";
import { DEFAULT_BOT, BotConfig } from "@/lib/types";
import { avatarColor } from "@/lib/users";

function initials(n: string) { const p = n.trim().split(/\s+/).filter(Boolean); return (!p.length ? "B" : p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase(); }
const KB_FIELDS: (keyof Assistant)[] = ["kbCompany", "kbServices", "kbPrices", "kbContacts", "kbHours", "kbPayment", "kbDelivery"];

type Field = { value: string; source: string; status: string };
function srcLabel(f: Field): { text: string; cls: string } {
  if (f.status === "needs") return { text: "Требуется уточнение", cls: "warn" };
  if (f.source === "site") return { text: "Найдено на сайте", cls: "ok" };
  if (f.source === "doc") return { text: "Из документа", cls: "ok" };
  return { text: "Создано ИИ — проверьте", cls: "ai" };
}

export default function AssistantClient() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [a, setA] = useState<Assistant | null>(null);
  const [flash, setFlash] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const flashT = useRef<any>(null);

  useEffect(() => {
    const list = loadBots(); setBots(list);
    const cur = getCurrentBotId() || list[0]?.id || ""; setBotId(cur); setA(loadAssistant(cur));
  }, []);
  function switchBot(id: string) { setBotId(id); setCurrentBotId(id); setA(loadAssistant(id)); }
  if (!a) return null;

  function patch(p: Partial<Assistant>) {
    setA((prev) => { if (!prev) return prev; const n = { ...prev, ...p }; if (botId) saveAssistant(botId, n); return n; });
    setFlash(true); clearTimeout(flashT.current); flashT.current = setTimeout(() => setFlash(false), 1400);
  }

  const filledCount = KB_FIELDS.filter((f) => String(a[f] || "").trim()).length + (a.kbFaq.length ? 1 : 0);
  const kbPct = Math.round((filledCount / (KB_FIELDS.length + 1)) * 100);
  const ready = kbFilled(a);
  const status = !ready ? { t: "Не настроен", cls: "warn" } : a.aiEnabled ? { t: "Работает", cls: "ok" } : { t: "Готов к запуску", cls: "info" };

  return (
    <>
      <Topbar crumbs={["Основной проект", "ИИ-ассистент"]} />
      <div className="content asx" style={{ maxWidth: 1440 }}>
        {/* Компактная верхняя панель */}
        <div className="asx-bar">
          <div className="asx-bar__bot">
            <span className="asx-bar__ava" style={{ background: avatarColor(botId) }}>{initials(bots.find((b) => b.id === botId)?.name || "B")}</span>
            <select className="asx-bar__sel" value={botId} onChange={(e) => switchBot(e.target.value)}>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <span className={`asx-status s-${status.cls}`}>{status.t}</span>
          <div className="asx-bar__kb">
            <div className="asx-bar__kbtop"><span>База знаний</span><b>{kbPct}%</b></div>
            <div className="asx-mini"><span style={{ width: `${kbPct}%` }} /></div>
          </div>
          <div className="asx-modeseg">
            <span className="asx-modeseg__l">Заполнение</span>
            <div className="asx-seg">
              <button className={`asx-seg__b${mode === "ai" ? " on" : ""}`} onClick={() => setMode("ai")} type="button"><IconSpark className="ico" /> С помощью ИИ</button>
              <button className={`asx-seg__b${mode === "manual" ? " on" : ""}`} onClick={() => setMode("manual")} type="button">Вручную</button>
            </div>
          </div>
          <label className="asx-toggle" title="Отвечает ли бот клиентам с помощью ИИ">
            <span className="asx-toggle__l">ИИ-ответы</span>
            <span className="sw"><input type="checkbox" checked={a.aiEnabled} onChange={(e) => patch({ aiEnabled: e.target.checked })} /><span className="sw__t" /></span>
          </label>
          <span className={`asx-saved${flash ? " show" : ""}`}>✓ Сохранено</span>
        </div>

        {/* Ориентир: понятная последовательность из трёх шагов */}
        <div className="asx-flow">
          <span className={ready ? "done" : "on"}><i>1</i> Заполните базу знаний</span>
          <b>→</b>
          <span className={a.aiEnabled ? "done" : ready ? "on" : ""}><i>2</i> Включите ИИ-ответы</span>
          <b>→</b>
          <span className={a.aiEnabled ? "on" : ""}><i>3</i> Проверьте в чате справа</span>
        </div>

        <div className="asx-grid">
          <div className="asx-main">
            <Connection a={a} patch={patch} />
            {mode === "ai" ? <AiWizard a={a} patch={patch} /> : <Manual a={a} patch={patch} />}
          </div>
          <aside className="asx-side">
            <ChatPreview a={a} botId={botId} patch={patch} />
            <Checklist a={a} ready={ready} />
          </aside>
        </div>
      </div>
    </>
  );
}

/* ---------- Подключение нейросети ---------- */
function Connection({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  const [open, setOpen] = useState(false);
  const prov = PROVIDERS.find((p) => p.id === a.provider) || PROVIDERS[0];
  const [st, setSt] = useState<"idle" | "checking" | "ok" | "err" | "nokey">("idle");
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);

  async function check() {
    if (prov.needsKey && !a.apiKey.trim()) { setSt("nokey"); return; }
    setSt("checking");
    try {
      const d = await (await fetch("/api/ai/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: a.provider, apiKey: a.apiKey, model: a.model }) })).json();
      if (d.ok) { setSt("ok"); setMsg(""); } else { setSt(d.status === "no_key" ? "nokey" : "err"); setMsg(d.error || ""); }
    } catch { setSt("err"); setMsg("Сервер недоступен"); }
  }

  return (
    <div className="asx-card">
      <div className="asx-conn">
        <div><b>Нейросеть:</b> {a.provider === "builtin" ? "Встроенная модель BotPilot" : prov.label + " · " + a.model} {a.provider === "builtin" && <span className="asx-tag ok">готово, ключ не нужен</span>}</div>
        <button className="btn-link" onClick={() => setOpen((v) => !v)} type="button">{open ? "Скрыть" : "Расширенные настройки"}</button>
      </div>
      {open && (
        <div className="asx-adv">
          <div className="asx-seg">
            <button className={`asx-seg__b${a.provider === "builtin" ? " on" : ""}`} onClick={() => { patch({ provider: "builtin", model: "Быстрый" }); setSt("idle"); }} type="button">Встроенная BotPilot</button>
            <button className={`asx-seg__b${a.provider !== "builtin" ? " on" : ""}`} onClick={() => { const p = PROVIDERS[1]; patch({ provider: p.id, model: p.models[0] }); setSt("idle"); }} type="button">Свой API-ключ</button>
          </div>
          {a.provider !== "builtin" && (
            <>
              <div className="asx-2">
                <label className="af"><span>Провайдер</span><select className="input" value={a.provider} onChange={(e) => { const p = PROVIDERS.find((x) => x.id === e.target.value)!; patch({ provider: p.id, model: p.models[0] }); setSt("idle"); }}>{PROVIDERS.filter((p) => p.needsKey).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
                <label className="af"><span>Модель</span><select className="input" value={a.model} onChange={(e) => patch({ model: e.target.value })}>{prov.models.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
              </div>
              <label className="af" style={{ marginTop: 8 }}><span>API-ключ <em className="muted">{prov.keyHint}</em></span>
                <span className="asx-key"><input className="input" type={show ? "text" : "password"} value={a.apiKey} onChange={(e) => { patch({ apiKey: e.target.value }); setSt("idle"); }} placeholder="Вставьте ключ" style={{ fontFamily: "ui-monospace,monospace" }} /><button className="btn btn-sm" type="button" onClick={() => setShow((v) => !v)}>{show ? "🙈" : "👁"}</button></span>
              </label>
              <div className="pw-row" style={{ marginTop: 8, alignItems: "center" }}>
                <button className="btn btn-sm btn-primary" onClick={check} type="button" disabled={st === "checking"}>{st === "checking" ? "Проверяем…" : "Проверить подключение"}</button>
                {st === "ok" && <span className="asx-tag ok">✓ Подключено</span>}
                {st === "err" && <span className="asx-tag warn">Ошибка{msg ? ": " + msg.slice(0, 60) : ""}</span>}
                {st === "nokey" && <span className="asx-tag warn">Укажите ключ</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Режим «Заполнить с помощью ИИ» ---------- */
function AiWizard({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  const [step, setStep] = useState(1);
  const [site, setSite] = useState("");
  const [about, setAbout] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [docs, setDocs] = useState<KbFile[]>([]);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const add: KbFile[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      let text = ""; if (/\.txt$/i.test(f.name)) { try { text = (await f.text()).slice(0, 15000); } catch {} }
      add.push({ name: f.name, type: f.type, size: f.size, text });
    }
    setDocs([...docs, ...add]);
  }

  async function collect() {
    setErr(""); setStep(2); setRes(null);
    try {
      const docsText = docs.map((d) => d.text ? `### ${d.name}\n${d.text}` : "").filter(Boolean).join("\n\n");
      const d = await (await fetch("/api/ai/collect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ about, siteUrl: site, docsText, links, provider: a.provider, apiKey: a.apiKey, model: a.model }) })).json();
      if (!d.ok) throw new Error("Не удалось собрать");
      setRes(d); setStep(3);
    } catch (e: any) { setErr(e?.message || "Ошибка"); setStep(1); }
  }

  function applyAll() {
    if (!res) return;
    const F = (k: string) => (res[k]?.value || "");
    patch({
      kbCompany: F("company") || a.kbCompany, kbServices: F("services") || a.kbServices, kbPrices: F("prices") || a.kbPrices,
      kbContacts: F("contacts") || a.kbContacts, kbHours: F("hours") || a.kbHours, kbPayment: F("payment") || a.kbPayment, kbDelivery: F("delivery") || a.kbDelivery,
      kbFaq: [...(res.faq || []).filter((f: any) => f.q && f.a).map((f: any) => ({ q: f.q, a: f.a })), ...a.kbFaq],
      role: res.instruction?.value || a.role,
    });
    setStep(4);
  }

  const canCollect = site.trim() || about.trim() || docs.length > 0;

  return (
    <div className="asx-card">
      <div className="asx-steps">
        {["Добавьте информацию", "ИИ собирает базу", "Проверьте результат"].map((s, i) => (
          <div key={i} className={`asx-step${step === i + 1 ? " on" : ""}${step > i + 1 ? " done" : ""}`}><span>{step > i + 1 ? "✓" : i + 1}</span> {s}</div>
        ))}
      </div>

      {step === 1 && (
        <div className="asx-fill">
          <div className="asx-2">
            <label className="af"><span>Ссылка на сайт</span><input className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://site.ru" /></label>
            <label className="af"><span>Telegram-канал / соцсети</span><input className="input" onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) { setLinks([...links, v]); (e.target as HTMLInputElement).value = ""; } } }} placeholder="@channel или ссылка, Enter" /></label>
          </div>
          {links.length > 0 && <div className="asx-chips">{links.map((l, i) => <span key={i} className="asx-chipx">{l}<button onClick={() => setLinks(links.filter((_, k) => k !== i))} type="button">✕</button></span>)}</div>}
          <label className="af" style={{ marginTop: 8 }}><span>Расскажите о компании своими словами</span><textarea className="input" style={{ minHeight: 80 }} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Чем занимаетесь, услуги, для кого, важные детали…" /></label>
          <label className="asx-upload"><input type="file" accept=".pdf,.docx,.txt" multiple hidden onChange={(e) => onFiles(e.target.files)} />📎 Документы PDF, DOCX, TXT</label>
          {docs.length > 0 && <div className="asx-chips">{docs.map((d, i) => <span key={i} className="asx-chipx">{d.name}<button onClick={() => setDocs(docs.filter((_, k) => k !== i))} type="button">✕</button></span>)}</div>}
          {err && <div className="asx-tag warn" style={{ marginTop: 8 }}>⚠ {err}</div>}
          <div className="pw-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={collect} type="button" disabled={!canCollect}><IconSpark className="ico" /> Собрать и заполнить автоматически</button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>ИИ не выдумывает цены и адреса — если их нет в источниках, отметит «Требуется уточнение».</div>
        </div>
      )}

      {step === 2 && (
        <div className="asx-collecting">
          <div className="asx-spin" />
          <div className="asx-collecting__t">ИИ анализирует источники…</div>
          <ul className="asx-collecting__src">
            {site && <li>🌐 {site}</li>}
            {docs.map((d, i) => <li key={i}>📄 {d.name}</li>)}
            {about && <li>📝 Ваше описание</li>}
            {links.map((l, i) => <li key={i}>🔗 {l}</li>)}
          </ul>
        </div>
      )}

      {step === 3 && res && (
        <div className="asx-result">
          <div className="asx-result__head"><b>Проверьте результат</b><button className="btn btn-sm btn-primary" onClick={applyAll} type="button">Применить всё</button></div>
          {[["company", "О компании"], ["services", "Услуги и товары"], ["prices", "Цены"], ["contacts", "Контакты"], ["hours", "Часы работы"], ["payment", "Оплата"], ["delivery", "Доставка"]].map(([k, label]) => {
            const f: Field = res[k] || { value: "", source: "none", status: "needs" };
            const s = srcLabel(f);
            return (
              <div key={k} className="asx-rf">
                <div className="asx-rf__top"><span className="asx-rf__label">{label}</span><span className={`asx-tag ${s.cls}`}>{s.text}</span></div>
                <textarea className="input" style={{ minHeight: 44 }} value={f.value} onChange={(e) => setRes({ ...res, [k]: { ...f, value: e.target.value, status: e.target.value ? "found" : "needs" } })} placeholder={f.status === "needs" ? "Заполните вручную…" : ""} />
              </div>
            );
          })}
          {res.faq?.length > 0 && <div className="asx-rf"><div className="asx-rf__top"><span className="asx-rf__label">Частые вопросы</span><span className="asx-tag ai">Создано ИИ — проверьте</span></div>{res.faq.map((f: any, i: number) => <div key={i} className="asx-faqline">{f.q} → {f.a || <em className="muted">нужен ответ</em>}</div>)}</div>}
          <div className="pw-row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={applyAll} type="button">Применить всё</button>
            <button className="btn btn-sm" onClick={() => setStep(1)} type="button">Перегенерировать</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="asx-done">
          <div className="asx-done__ico"><IconCheck className="ico" /></div>
          <b>База знаний заполнена!</b>
          <p className="muted">Проверьте разделы вручную и включите ИИ-ответы. Справа — тестовый чат.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setStep(1)} type="button">Добавить ещё источники</button>
        </div>
      )}
    </div>
  );
}

/* ---------- Режим «Заполнить вручную» ---------- */
function SectionAI({ text, onResult, field }: { text: string; onResult: (v: string) => void; field: string }) {
  const [busy, setBusy] = useState("");
  async function run(action: string) {
    if (!text.trim()) return; setBusy(action);
    try {
      const d = await (await fetch("/api/ai/assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, text, provider: "builtin" }) })).json();
      if (d.result) onResult(d.result);
    } catch {} finally { setBusy(""); }
  }
  return (
    <div className="asx-aiacts">
      <button className="asx-aibtn" onClick={() => run("improve")} type="button" disabled={!!busy}>{busy === "improve" ? "…" : "✨ Улучшить текст"}</button>
      <button className="asx-aibtn" onClick={() => run("shorten")} type="button" disabled={!!busy}>Сократить</button>
    </div>
  );
}

function Manual({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  const [open, setOpen] = useState<string>("company");
  const secs: { id: string; label: string; body: ReactNode }[] = [
    { id: "company", label: "О компании", body: (<><Ta label="Опишите компанию" v={a.kbCompany} on={(v) => patch({ kbCompany: v })} ex="Клиника «Форма Здоровья», с 2015 года" /><SectionAI text={a.kbCompany} field="kbCompany" onResult={(v) => patch({ kbCompany: v })} /></>) },
    { id: "serv", label: "Услуги, товары и цены", body: (<div className="asx-2"><Ta label="Услуги и товары" v={a.kbServices} on={(v) => patch({ kbServices: v })} ex="Приём терапевта, УЗI, анализы" /><Ta label="Цены" v={a.kbPrices} on={(v) => patch({ kbPrices: v })} ex="Приём — 2000 ₽" /></div>) },
    { id: "cont", label: "Контакты и часы работы", body: (<div className="asx-2"><Ta label="Адрес и контакты" v={a.kbContacts} on={(v) => patch({ kbContacts: v })} ex="Москва, ул. Ленина 1" /><Ta label="Часы работы" v={a.kbHours} on={(v) => patch({ kbHours: v })} ex="Пн–Пт 9:00–20:00" /></div>) },
    { id: "pay", label: "Оплата, доставка и условия", body: (<div className="asx-2"><Ta label="Оплата" v={a.kbPayment} on={(v) => patch({ kbPayment: v })} ex="Карты, наличные, рассрочка" /><Ta label="Доставка" v={a.kbDelivery} on={(v) => patch({ kbDelivery: v })} ex="Доставка за 1 день" /></div>) },
    { id: "faq", label: "Частые вопросы", body: <Faq a={a} patch={patch} /> },
    { id: "style", label: "Стиль ответов и ограничения", body: <StyleBlock a={a} patch={patch} /> },
  ];
  return (
    <div className="asx-card">
      {secs.map((s) => (
        <div key={s.id} className={`asx-acc${open === s.id ? " open" : ""}`}>
          <button className="asx-acc__h" onClick={() => setOpen(open === s.id ? "" : s.id)} type="button"><span>{s.label}</span><span className="asx-acc__chev">{open === s.id ? "▲" : "▼"}</span></button>
          {open === s.id && <div className="asx-acc__b">{s.body}</div>}
        </div>
      ))}
    </div>
  );
}
function Ta({ label, v, on, ex }: { label: string; v: string; on: (v: string) => void; ex?: string }) {
  return <label className="af"><span>{label}</span><textarea className="input" style={{ minHeight: 56 }} value={v} onChange={(e) => on(e.target.value)} placeholder={ex ? "Напр.: " + ex : ""} /></label>;
}
function Faq({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  async function genFaq() {
    const base = [a.kbCompany, a.kbServices, a.kbPrices].filter(Boolean).join(". ");
    const d = await (await fetch("/api/ai/assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "faq", text: base || a.kbCompany || "услуги компании", provider: "builtin" }) })).json();
    if (d.faq) patch({ kbFaq: [...d.faq.map((f: any) => ({ q: f.q, a: f.a })), ...a.kbFaq] });
  }
  return (
    <>
      <div className="pw-row" style={{ marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={() => patch({ kbFaq: [...a.kbFaq, { q: "", a: "" }] })} type="button"><IconPlus className="ico" /> Вопрос</button>
        <button className="asx-aibtn" onClick={genFaq} type="button">✨ Создать FAQ из базы</button>
      </div>
      {a.kbFaq.length === 0 && <div className="hint">Например: «Нужна ли предоплата?» → «Нет, оплата после приёма».</div>}
      {a.kbFaq.map((e, i) => (
        <div key={i} className="asx-faq">
          <input className="input" value={e.q} onChange={(ev) => patch({ kbFaq: a.kbFaq.map((x, k) => k === i ? { ...x, q: ev.target.value } : x) })} placeholder="Вопрос" />
          <input className="input" value={e.a} onChange={(ev) => patch({ kbFaq: a.kbFaq.map((x, k) => k === i ? { ...x, a: ev.target.value } : x) })} placeholder="Ответ" />
          <button className="asx-x" onClick={() => patch({ kbFaq: a.kbFaq.filter((_, k) => k !== i) })} type="button">✕</button>
        </div>
      ))}
    </>
  );
}
function StyleBlock({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  return (
    <>
      <div className="asx-2">
        <label className="af"><span>Имя ассистента</span><input className="input" value={a.name} onChange={(e) => patch({ name: e.target.value })} /></label>
        <label className="af"><span>Стиль</span><select className="input" value={a.style} onChange={(e) => patch({ style: e.target.value as AssistantStyle })}>{(Object.keys(STYLE_LABELS) as AssistantStyle[]).map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}</select></label>
        <label className="af"><span>Язык</span><input className="input" value={a.language} onChange={(e) => patch({ language: e.target.value })} /></label>
        <label className="af"><span>Длина ответа</span><select className="input" value={a.length} onChange={(e) => patch({ length: e.target.value as Length })}>{LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
        <label className="af"><span>Обращение</span><select className="input" value={a.address} onChange={(e) => patch({ address: e.target.value as any })}><option value="вы">На «вы»</option><option value="ты">На «ты»</option></select></label>
        <label className="af"><span>Если ответа нет</span><select className="input" value={a.noAnswer} onChange={(e) => patch({ noAnswer: e.target.value as NoAnswer })}>{(Object.keys(NO_ANSWER_LABELS) as NoAnswer[]).map((k) => <option key={k} value={k}>{NO_ANSWER_LABELS[k]}</option>)}</select></label>
      </div>
      <Ta label="Системная инструкция (необязательно)" v={a.role} on={(v) => patch({ role: v })} ex="Ты — администратор клиники, помогаешь записаться" />
      <Ta label="Запрещённые темы" v={a.forbidden} on={(v) => patch({ forbidden: v })} ex="Политика, диагнозы, гарантии" />
    </>
  );
}

/* ---------- Правый чат ---------- */
function ChatPreview({ a, botId, patch }: { a: Assistant; botId: string; patch: (p: Partial<Assistant>) => void }) {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ role: "u" | "b"; text: string; src?: string; conf?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  function config(): BotConfig { return { ...DEFAULT_BOT, id: botId || "1", name: a.name, goal: "consult", knowledge: kbText(a), instruction: behaviorInstruction(a), extraContext: "", sites: a.kbLinks, documents: [], showSources: false, stopWord: DEFAULT_BOT.stopWord, modelId: "x", maxMessages: 0 }; }
  async function ask() {
    if (!q.trim() || busy) return; const question = q.trim();
    setLog((l) => [...l, { role: "u", text: question }]); setQ(""); setBusy(true);
    try {
      const history = [...log, { role: "u" as const, text: question }].map((m) => ({ role: m.role === "u" ? "user" : "assistant", content: m.text }));
      const d = await (await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bot: config(), history, ai: { provider: a.provider, apiKey: a.apiKey, model: a.model } }) })).json();
      const reply = d.reply || d.error || "Не удалось получить ответ.";
      const low = /Я не нашёл точной информации/.test(reply);
      const src = d.source === "claude" ? "Нейросеть" : d.source === "operator" ? "Оператор" : "База знаний";
      const conf = low ? "Низкая — нет в базе" : d.source === "claude" ? "Высокая" : "Средняя";
      setLog((l) => [...l, { role: "b", text: reply, src, conf }]);
    } catch { setLog((l) => [...l, { role: "b", text: "Ошибка запроса." }]); }
    finally { setBusy(false); }
  }
  function addToBase() {
    const lastU = [...log].reverse().find((m) => m.role === "u"); const lastB = [...log].reverse().find((m) => m.role === "b");
    if (lastU && lastB) patch({ kbFaq: [{ q: lastU.text, a: lastB.text }, ...a.kbFaq] });
  }

  return (
    <div className="asx-card asx-chat">
      <div className="asx-chat__h"><IconChat className="ico" /> Проверить ассистента</div>
      <div className="asx-chat__log">
        {log.length === 0 && <div className="hint">Спросите как клиент: «Сколько стоит приём?», «Где вы находитесь?»</div>}
        {log.map((m, i) => (
          <div key={i} className={`asx-msg ${m.role === "u" ? "u" : "b"}`}>
            <div>{m.text}</div>
            {m.role === "b" && m.src && (
              <>
                <div className="asx-msg__meta">Источник: {m.src} · Уверенность: {m.conf}</div>
                <div className="asx-msg__acts">
                  <button onClick={addToBase} type="button">Добавить в базу</button>
                  <button onClick={addToBase} type="button">Создать правило</button>
                </div>
              </>
            )}
          </div>
        ))}
        {busy && <div className="asx-msg b muted">Печатает…</div>}
      </div>
      <div className="asx-chat__in"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} placeholder="Вопрос клиента…" /><button className="btn btn-sm btn-primary" onClick={ask} type="button" disabled={busy}>Спросить</button></div>
    </div>
  );
}

/* ---------- Чек-лист готовности ---------- */
function Checklist({ a, ready }: { a: Assistant; ready: boolean }) {
  const items = [
    { ok: true, t: "Нейросеть подключена" },
    { ok: ready, t: "База знаний заполнена" },
    { ok: !!a.style, t: "Стиль настроен" },
    { ok: a.aiEnabled, t: "ИИ-ответы включены" },
  ];
  const done = items.filter((i) => i.ok).length;
  return (
    <div className="asx-card asx-check">
      <div className="asx-check__t">Готовность к запуску · {done}/{items.length}</div>
      {items.map((i, k) => <div key={k} className={`asx-check__i${i.ok ? " ok" : ""}`}><span>{i.ok ? "✓" : "○"}</span> {i.t}</div>)}
    </div>
  );
}
