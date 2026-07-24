"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark, IconPlus } from "@/components/icons";
import {
  Assistant, AssistantStyle, STYLE_LABELS, Provider, PROVIDERS, LENGTHS, NO_ANSWER_LABELS, NoAnswer, Length,
  KbFile, loadAssistant, saveAssistant, kbFilled, kbText, behaviorInstruction,
} from "@/lib/assistant";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";
import { DEFAULT_BOT, BotConfig } from "@/lib/types";
import { avatarColor } from "@/lib/users";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "🤖";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}

export default function AssistantClient() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [a, setA] = useState<Assistant | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashT = useRef<any>(null);

  useEffect(() => {
    const list = loadBots();
    setBots(list);
    const cur = getCurrentBotId() || list[0]?.id || "";
    setBotId(cur);
    setA(loadAssistant(cur));
  }, []);

  function switchBot(id: string) { setBotId(id); setCurrentBotId(id); setA(loadAssistant(id)); }
  if (!a) return null;

  // Автосохранение при любом изменении.
  function patch(p: Partial<Assistant>) {
    setA((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...p };
      if (botId) saveAssistant(botId, next);
      return next;
    });
    setSavedFlash(true);
    clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "ИИ-ассистент"]} />
      <div className="content" style={{ maxWidth: 860 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>ИИ-ассистент</h1>
            <p className="muted" style={{ margin: 0 }}>Подключите нейросеть, заполните базу знаний и бот будет отвечать клиентам сам. Все настройки сохраняются автоматически.</p>
          </div>
          <span className={`asst-saved${savedFlash ? " show" : ""}`}>✓ Сохранено автоматически</span>
        </div>

        {/* Бот */}
        <div className="asst-bots">
          <span className="asst-bots__label">Ассистент бота:</span>
          {bots.map((bt) => (
            <button key={bt.id} className={`asst-bot${bt.id === botId ? " on" : ""}`} onClick={() => switchBot(bt.id)} type="button">
              <span className="asst-bot__ava" style={{ background: avatarColor(bt.id) }}>{initials(bt.name)}</span>
              <span>{bt.name}</span>
            </button>
          ))}
          <Link href="/dashboard/create" className="asst-bot asst-bot--add"><IconPlus className="ico" /> Новый бот</Link>
        </div>

        {/* Главный переключатель */}
        <div className="asst-toggle">
          <div>
            <b>Ответы с помощью ИИ</b>
            <div className="muted" style={{ fontSize: 12.5 }}>Когда включено — бот отвечает клиентам нейросетью по вашей базе знаний.</div>
          </div>
          <label className="sw"><input type="checkbox" checked={a.aiEnabled} onChange={(e) => patch({ aiEnabled: e.target.checked })} /><span className="sw__t" /></label>
        </div>

        <Step1 a={a} patch={patch} />
        <Step2 a={a} patch={patch} />
        <Step3 a={a} patch={patch} />
        <Step4 a={a} botId={botId} />
        <Step5 a={a} patch={patch} />
      </div>
    </>
  );
}

function StepCard({ n, title, sub, children }: { n: number; title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="card asst-step">
      <div className="asst-step__head"><span className="asst-step__n">{n}</span><div><b>{title}</b>{sub && <div className="muted" style={{ fontSize: 12.5 }}>{sub}</div>}</div></div>
      <div className="asst-step__body">{children}</div>
    </div>
  );
}
function Field({ label, hint, example, children }: { label: string; hint?: string; example?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
      {(hint || example) && <div className="hint">{hint}{example ? ` Пример: ${example}` : ""}</div>}
    </div>
  );
}

/* Шаг 1 — подключение нейросети */
function Step1({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  const prov = PROVIDERS.find((p) => p.id === a.provider) || PROVIDERS[0];
  const [status, setStatus] = useState<"idle" | "checking" | "connected" | "error" | "no_key">("idle");
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);

  async function check() {
    if (prov.needsKey && !a.apiKey.trim()) { setStatus("no_key"); setMsg("Ключ не указан."); return; }
    setStatus("checking"); setMsg("");
    try {
      const d = await (await fetch("/api/ai/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: a.provider, apiKey: a.apiKey, model: a.model }) })).json();
      if (d.ok) { setStatus("connected"); setMsg(d.note || ""); }
      else { setStatus(d.status === "no_key" ? "no_key" : "error"); setMsg(d.error || "Ошибка подключения"); }
    } catch { setStatus("error"); setMsg("Ошибка подключения"); }
  }

  const statusText = status === "connected" ? "Подключено" : status === "error" ? "Ошибка подключения" : status === "no_key" ? "Ключ не указан" : status === "checking" ? "Проверяем…" : "";

  return (
    <StepCard n={1} title="Подключите нейросеть" sub="Выберите провайдера и модель. Встроенная работает без ключа.">
      <div className="pw-grid2">
        <Field label="Провайдер" hint="Кто отвечает за генерацию ответов.">
          <select className="select" value={a.provider} onChange={(e) => { const p = e.target.value as Provider; const pp = PROVIDERS.find((x) => x.id === p)!; patch({ provider: p, model: pp.models[0] }); setStatus("idle"); }}>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Модель" hint="Быстрее — дешевле, умнее — точнее.">
          <select className="select" value={a.model} onChange={(e) => patch({ model: e.target.value })}>
            {prov.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      {prov.needsKey && (
        <Field label="API-ключ" hint={prov.keyHint} example="sk-ant-… / sk-…">
          <div className="tgd-field">
            <input className="input" type={show ? "text" : "password"} value={a.apiKey} onChange={(e) => { patch({ apiKey: e.target.value }); setStatus("idle"); }} placeholder="Вставьте ключ" autoComplete="off" spellCheck={false} style={{ fontFamily: "ui-monospace, monospace" }} />
            <button className="btn btn-sm" type="button" onClick={() => setShow((v) => !v)}>{show ? "🙈" : "👁"}</button>
          </div>
        </Field>
      )}
      <div className="pw-row" style={{ marginTop: 4, alignItems: "center" }}>
        <button className="btn btn-primary" onClick={check} type="button" disabled={status === "checking"}>Проверить подключение</button>
        {statusText && <span className={`asst-status asst-status--${status}`}>{status === "connected" ? "✓ " : status === "checking" ? "" : "⚠ "}{statusText}</span>}
      </div>
      {msg && status !== "connected" && <div className="hint" style={{ color: status === "error" ? "#c02626" : undefined }}>{msg}</div>}
    </StepCard>
  );
}

/* Шаг 2 — база знаний */
function Step2({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  const filled = kbFilled(a);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const added: KbFile[] = [];
    for (const f of Array.from(files).slice(0, 10)) {
      const isTxt = /\.txt$/i.test(f.name) || f.type === "text/plain";
      let text = "";
      if (isTxt) { try { text = (await f.text()).slice(0, 20000); } catch {} }
      added.push({ name: f.name, type: f.type || f.name.split(".").pop() || "", size: f.size, text });
    }
    patch({ kbFiles: [...a.kbFiles, ...added] });
  }

  return (
    <StepCard n={2} title="Заполните базу знаний" sub="Именно её ИИ использует для ответов клиентам.">
      {!filled && (
        <div className="asst-notice">
          <b>⚠ Заполните базу знаний</b> — именно её ИИ-ассистент использует для ответов клиентам. Добавьте информацию об услугах, ценах, графике работы и частых вопросах. Если база знаний пустая, бот сможет давать только общие ответы.
        </div>
      )}
      <div className="pw-grid2">
        <Field label="О компании" example="Клиника «Форма Здоровья», работаем с 2015 года."><textarea className="textarea" style={{ minHeight: 64 }} value={a.kbCompany} onChange={(e) => patch({ kbCompany: e.target.value })} /></Field>
        <Field label="Услуги и товары" example="Приём терапевта, кардиолога, УЗИ, анализы."><textarea className="textarea" style={{ minHeight: 64 }} value={a.kbServices} onChange={(e) => patch({ kbServices: e.target.value })} /></Field>
        <Field label="Цены" example="Приём — 2000 ₽, УЗИ — от 1500 ₽."><textarea className="textarea" style={{ minHeight: 64 }} value={a.kbPrices} onChange={(e) => patch({ kbPrices: e.target.value })} /></Field>
        <Field label="Адреса и контакты" example="Москва, ул. Ленина 1. Тел. +7 999 000-00-00."><textarea className="textarea" style={{ minHeight: 64 }} value={a.kbContacts} onChange={(e) => patch({ kbContacts: e.target.value })} /></Field>
        <Field label="Часы работы" example="Пн–Пт 9:00–20:00, Сб 10:00–16:00."><textarea className="textarea" style={{ minHeight: 64 }} value={a.kbHours} onChange={(e) => patch({ kbHours: e.target.value })} /></Field>
        <Field label="Оплата" example="Наличные, карты, онлайн-оплата, рассрочка."><textarea className="textarea" style={{ minHeight: 64 }} value={a.kbPayment} onChange={(e) => patch({ kbPayment: e.target.value })} /></Field>
      </div>
      <Field label="Доставка / условия" example="Доставка по городу за 1 день, самовывоз бесплатно."><textarea className="textarea" style={{ minHeight: 56 }} value={a.kbDelivery} onChange={(e) => patch({ kbDelivery: e.target.value })} /></Field>

      {/* FAQ */}
      <div className="field">
        <div className="row" style={{ justifyContent: "space-between" }}><label className="label" style={{ margin: 0 }}>Частые вопросы и ответы</label><button className="btn btn-sm" type="button" onClick={() => patch({ kbFaq: [...a.kbFaq, { q: "", a: "" }] })}><IconPlus className="ico" /> Добавить</button></div>
        {a.kbFaq.length === 0 && <div className="hint" style={{ marginTop: 8 }}>Например: «Нужна ли предоплата?» → «Нет, оплата после приёма».</div>}
        {a.kbFaq.map((e, i) => (
          <div key={i} className="asst-ex">
            <input className="input" value={e.q} onChange={(ev) => patch({ kbFaq: a.kbFaq.map((x, k) => k === i ? { ...x, q: ev.target.value } : x) })} placeholder="Вопрос клиента" />
            <input className="input" value={e.a} onChange={(ev) => patch({ kbFaq: a.kbFaq.map((x, k) => k === i ? { ...x, a: ev.target.value } : x) })} placeholder="Ответ" />
            <button className="asst-ex__x" onClick={() => patch({ kbFaq: a.kbFaq.filter((_, k) => k !== i) })} type="button">✕</button>
          </div>
        ))}
      </div>

      {/* Файлы */}
      <Field label="Файлы (PDF, DOCX, TXT)" hint="TXT читается сразу; PDF/DOCX разбираются на сервере.">
        <label className="asst-upload">
          <input type="file" accept=".pdf,.docx,.txt" multiple onChange={(e) => onFiles(e.target.files)} hidden />
          📎 Загрузить файлы
        </label>
        {a.kbFiles.length > 0 && (
          <div className="asst-files">
            {a.kbFiles.map((f, i) => (
              <div key={i} className="asst-file"><span>{/\.txt$/i.test(f.name) ? "📄" : "📎"} {f.name} <em className="muted">{Math.round(f.size / 1024)} КБ{f.text ? "" : " · разбор на сервере"}</em></span><button className="asst-ex__x" onClick={() => patch({ kbFiles: a.kbFiles.filter((_, k) => k !== i) })} type="button">✕</button></div>
            ))}
          </div>
        )}
      </Field>

      {/* Ссылки */}
      <Field label="Ссылки на сайт" hint="Страницы, с которых брать информацию." example="https://site.ru/uslugi">
        <div className="row" style={{ gap: 8 }}>
          <input className="input" id="kblink" placeholder="https://site.ru" onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) { patch({ kbLinks: [...a.kbLinks, v] }); (e.target as HTMLInputElement).value = ""; } } }} />
          <button className="btn btn-sm" type="button" onClick={() => { const el = document.getElementById("kblink") as HTMLInputElement; const v = el.value.trim(); if (v) { patch({ kbLinks: [...a.kbLinks, v] }); el.value = ""; } }}>Добавить</button>
        </div>
        {a.kbLinks.length > 0 && <div className="asst-files">{a.kbLinks.map((l, i) => <div key={i} className="asst-file"><span>🔗 {l}</span><button className="asst-ex__x" onClick={() => patch({ kbLinks: a.kbLinks.filter((_, k) => k !== i) })} type="button">✕</button></div>)}</div>}
      </Field>
    </StepCard>
  );
}

/* Шаг 3 — стиль ответов */
function Step3({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  return (
    <StepCard n={3} title="Настройте стиль ответов" sub="Как ассистент общается с клиентами.">
      <div className="pw-grid2">
        <Field label="Как зовут ассистента?" example="Анна, Алекс"><input className="input" value={a.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label="Стиль общения" hint="Тон ответов."><select className="select" value={a.style} onChange={(e) => patch({ style: e.target.value as AssistantStyle })}>{(Object.keys(STYLE_LABELS) as AssistantStyle[]).map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}</select></Field>
        <Field label="Язык ответов" example="Русский, English"><input className="input" value={a.language} onChange={(e) => patch({ language: e.target.value })} /></Field>
        <Field label="Длина ответа"><select className="select" value={a.length} onChange={(e) => patch({ length: e.target.value as Length })}>{LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></Field>
        <Field label="Обращение к пользователю"><select className="select" value={a.address} onChange={(e) => patch({ address: e.target.value as "ты" | "вы" })}><option value="вы">На «вы»</option><option value="ты">На «ты»</option></select></Field>
        <Field label="Если ответа нет в базе" hint="Что делать, когда точной информации нет."><select className="select" value={a.noAnswer} onChange={(e) => patch({ noAnswer: e.target.value as NoAnswer })}>{(Object.keys(NO_ANSWER_LABELS) as NoAnswer[]).map((k) => <option key={k} value={k}>{NO_ANSWER_LABELS[k]}</option>)}</select></Field>
      </div>
      <Field label="Системная инструкция для нейросети" hint="Роль и правила. Оставьте пустым — соберём автоматически из настроек." example="Ты — администратор клиники, помогаешь записаться на приём.">
        <textarea className="textarea" style={{ minHeight: 90 }} value={a.role} onChange={(e) => patch({ role: e.target.value })} />
      </Field>
      <Field label="Запрещённые темы" example="Политика, диагнозы, обещания гарантий."><textarea className="textarea" style={{ minHeight: 48 }} value={a.forbidden} onChange={(e) => patch({ forbidden: e.target.value })} /></Field>
    </StepCard>
  );
}

/* Шаг 4 — тестирование */
function Step4({ a, botId }: { a: Assistant; botId: string }) {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);

  function config(): BotConfig {
    return { ...DEFAULT_BOT, id: botId || "1", name: a.name, goal: "consult", knowledge: kbText(a), instruction: behaviorInstruction(a), extraContext: "", sites: a.kbLinks, documents: [], showSources: false, stopWord: DEFAULT_BOT.stopWord, modelId: "x", maxMessages: 0 };
  }
  async function ask() {
    if (!q.trim() || busy) return;
    const question = q.trim();
    setLog((l) => [...l, { role: "user", text: question }]);
    setQ(""); setBusy(true);
    try {
      const history = [...log, { role: "user" as const, text: question }].map((m) => ({ role: m.role, content: m.text }));
      const d = await (await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bot: config(), history, ai: { provider: a.provider, apiKey: a.apiKey, model: a.model } }) })).json();
      setLog((l) => [...l, { role: "assistant", text: d.reply || d.error || "Не удалось получить ответ." }]);
    } catch { setLog((l) => [...l, { role: "assistant", text: "Ошибка запроса." }]); }
    finally { setBusy(false); }
  }

  return (
    <StepCard n={4} title="Проверьте ассистента" sub="Задайте вопрос и посмотрите ответ до включения.">
      <div className="asst-test">
        {log.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Напишите вопрос клиента — например, «Сколько стоит приём?» или «Где вы находитесь?».</div>}
        {log.map((m, i) => (
          <div key={i} className={`asst-msg asst-msg--${m.role}`}>{m.text}</div>
        ))}
        {busy && <div className="asst-msg asst-msg--assistant muted">Печатает…</div>}
      </div>
      <div className="tgd-field" style={{ marginTop: 10 }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} placeholder="Вопрос клиента…" />
        <button className="btn btn-primary" onClick={ask} type="button" disabled={busy || !q.trim()}>Спросить</button>
      </div>
      <div className="hint">{a.provider === "builtin" ? "Встроенная модель отвечает по базе знаний. Для более точных ответов подключите Claude или OpenAI в шаге 1." : "Ответ формирует подключённая нейросеть по вашей базе знаний."}</div>
    </StepCard>
  );
}

/* Шаг 5 — включение */
function Step5({ a, patch }: { a: Assistant; patch: (p: Partial<Assistant>) => void }) {
  return (
    <StepCard n={5} title="Включите ответы с помощью ИИ" sub="Финальный шаг — бот начнёт отвечать сам.">
      <div className="asst-toggle" style={{ margin: 0, border: 0, padding: 0 }}>
        <div>
          <b>{a.aiEnabled ? "ИИ-ответы включены" : "ИИ-ответы выключены"}</b>
          <div className="muted" style={{ fontSize: 12.5 }}>{a.aiEnabled ? "Бот отвечает клиентам нейросетью по базе знаний." : "Включите, когда база знаний заполнена и проверена."}</div>
        </div>
        <label className="sw"><input type="checkbox" checked={a.aiEnabled} onChange={(e) => patch({ aiEnabled: e.target.checked })} /><span className="sw__t" /></label>
      </div>
      {a.aiEnabled && !kbFilled(a) && <div className="asst-notice" style={{ marginTop: 12 }}>База знаний пустая — бот будет давать только общие ответы. Вернитесь к шагу 2.</div>}
      <div className="hint" style={{ marginTop: 10 }}>Не забудьте подключить бота в разделе «Мои боты» → «Диагностика» и нажать «Проверить подключение», чтобы эти настройки применились в Telegram.</div>
    </StepCard>
  );
}
