"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark, IconPlus } from "@/components/icons";
import {
  Assistant,
  AssistantStyle,
  STYLE_LABELS,
  KNOWLEDGE_OPTIONS,
  loadAssistant,
  saveAssistant,
} from "@/lib/assistant";
import { Bot, loadBots, getCurrentBotId, setCurrentBotId } from "@/lib/bots";
import { avatarColor } from "@/lib/users";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "🤖";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}

export default function AssistantClient() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState<string>("");
  const [a, setA] = useState<Assistant | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const list = loadBots();
    setBots(list);
    const cur = getCurrentBotId() || list[0]?.id || "";
    setBotId(cur);
    setA(loadAssistant(cur));
  }, []);

  function switchBot(id: string) {
    setBotId(id);
    setCurrentBotId(id);
    setA(loadAssistant(id));
    setSaved(false);
  }

  if (!a) return null;

  function patch(p: Partial<Assistant>) {
    setA((prev) => (prev ? { ...prev, ...p } : prev));
    setSaved(false);
  }
  function save() {
    if (a && botId) saveAssistant(botId, a);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  function toggleKnowledge(k: string) {
    if (!a) return;
    const has = a.knowledge.includes(k);
    patch({ knowledge: has ? a.knowledge.filter((x) => x !== k) : [...a.knowledge, k] });
  }
  function addExample() {
    patch({ examples: [...a!.examples, { q: "", a: "" }] });
  }
  function setExample(i: number, field: "q" | "a", val: string) {
    const next = a!.examples.map((e, idx) => (idx === i ? { ...e, [field]: val } : e));
    patch({ examples: next });
  }
  function removeExample(i: number) {
    patch({ examples: a!.examples.filter((_, idx) => idx !== i) });
  }

  // «Улучшить автоматически»: подставляет разумный шаблон роли и правил.
  function autoImprove() {
    const style = STYLE_LABELS[a!.style].toLowerCase();
    const role =
      `Ты — ${a!.name}, ИИ-ассистент компании. Общайся ${style}. ` +
      `Помогай клиенту: отвечай на вопросы о товарах и услугах, уточняй потребность, ` +
      `предлагай оставить заявку и подсказывай следующий шаг. Если не знаешь ответа — ` +
      `предложи связать с менеджером. Не выдумывай факты, опирайся на базу знаний.`;
    patch({
      role,
      forbidden: a!.forbidden || "Политика, религия, обсуждение конкурентов, обещания гарантий и скидок без согласования.",
    });
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "ИИ-ассистент"]} />
      <div className="content" style={{ maxWidth: 760 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>ИИ-ассистент</h1>
            <p className="muted" style={{ margin: 0 }}>
              Настройте, как ассистент представляется, общается и что знает. Эти правила
              применяются, когда бот отвечает клиентам нейросетью.
            </p>
          </div>
          <button className="btn btn-ai" onClick={autoImprove}>
            <IconSpark className="ico" /> Улучшить автоматически
          </button>
        </div>

        {/* Выбор бота — у каждого бота свой ассистент */}
        <div className="asst-bots">
          <span className="asst-bots__label">Ассистент бота:</span>
          {bots.map((bt) => (
            <button
              key={bt.id}
              className={`asst-bot${bt.id === botId ? " on" : ""}`}
              onClick={() => switchBot(bt.id)}
              type="button"
            >
              <span className="asst-bot__ava" style={{ background: avatarColor(bt.id) }}>{initials(bt.name)}</span>
              <span>{bt.name}</span>
            </button>
          ))}
          <Link href="/dashboard/create" className="asst-bot asst-bot--add">
            <IconPlus className="ico" /> Новый бот
          </Link>
        </div>

        <div className="card asst-card">
          <div className="asst-grid">
            <div className="field">
              <label className="label">Как зовут ассистента?</label>
              <input className="input" value={a.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Анна, Алекс, SmartBot" />
            </div>
            <div className="field">
              <label className="label">Как он должен общаться?</label>
              <select className="select" value={a.style} onChange={(e) => patch({ style: e.target.value as AssistantStyle })}>
                {(Object.keys(STYLE_LABELS) as AssistantStyle[]).map((s) => (
                  <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label">Роль и правила общения</label>
            <textarea
              className="textarea"
              style={{ minHeight: 110 }}
              value={a.role}
              onChange={(e) => patch({ role: e.target.value })}
              placeholder="Опишите, кто такой ассистент и как отвечать. Или нажмите «Улучшить автоматически»."
            />
          </div>

          <div className="field">
            <label className="label">Что ассистент должен знать?</label>
            <div className="asst-know">
              {KNOWLEDGE_OPTIONS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`asst-chip${a.knowledge.includes(k) ? " on" : ""}`}
                  onClick={() => toggleKnowledge(k)}
                >
                  {a.knowledge.includes(k) ? "✓ " : "+ "}{k}
                </button>
              ))}
            </div>
            <div className="hint">Отметьте источники — на сервере ассистент обучится на них.</div>
          </div>

          <div className="field">
            <label className="label">Запрещённые темы</label>
            <textarea
              className="textarea"
              style={{ minHeight: 60 }}
              value={a.forbidden}
              onChange={(e) => patch({ forbidden: e.target.value })}
              placeholder="О чём ассистент не должен говорить"
            />
          </div>

          <div className="field">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label className="label" style={{ margin: 0 }}>Примеры ответов</label>
              <button className="btn btn-sm" onClick={addExample} type="button"><IconPlus className="ico" /> Добавить</button>
            </div>
            {a.examples.length === 0 && (
              <div className="hint" style={{ marginTop: 8 }}>Пары «вопрос → ответ» помогают ассистенту отвечать в нужном стиле.</div>
            )}
            {a.examples.map((e, i) => (
              <div key={i} className="asst-ex">
                <input className="input" value={e.q} onChange={(ev) => setExample(i, "q", ev.target.value)} placeholder="Вопрос клиента" />
                <input className="input" value={e.a} onChange={(ev) => setExample(i, "a", ev.target.value)} placeholder="Ответ ассистента" />
                <button className="asst-ex__x" onClick={() => removeExample(i)} title="Удалить" type="button">✕</button>
              </div>
            ))}
          </div>

          <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            {saved && <span className="muted" style={{ alignSelf: "center", color: "var(--green)" }}>Сохранено ✓</span>}
            <button className="btn btn-primary" onClick={save}>Сохранить ассистента</button>
          </div>
        </div>
      </div>
    </>
  );
}
