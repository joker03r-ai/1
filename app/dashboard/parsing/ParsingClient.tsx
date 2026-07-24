"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { IconSpark } from "@/components/icons";
import {
  ParseConfig, ParseMaterial, ParseRun,
  PARSE_SOURCES, PARSE_FREQ, DEFAULT_PARSE,
  loadConfig, saveConfig, loadFound, saveFound, loadHistory, saveHistory, runParse,
} from "@/lib/parsing";
import { addDrafts } from "@/lib/content";

const KIND_ICON: Record<ParseMaterial["kind"], string> = { chat: "💬", post: "📄", account: "👤" };
const KIND_LABEL: Record<ParseMaterial["kind"], string> = { chat: "Чат", post: "Пост", account: "Аккаунт" };

export default function ParsingClient() {
  const router = useRouter();
  const [cfg, setCfg] = useState<ParseConfig>(DEFAULT_PARSE);
  const [found, setFound] = useState<ParseMaterial[]>([]);
  const [history, setHistory] = useState<ParseRun[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    setCfg(loadConfig());
    setFound(loadFound());
    setHistory(loadHistory());
  }, []);

  function patch(p: Partial<ParseConfig>) {
    setCfg((prev) => { const next = { ...prev, ...p }; saveConfig(next); return next; });
  }
  function toggleSource(s: string) {
    patch({ sources: cfg.sources.includes(s) ? cfg.sources.filter((x) => x !== s) : [...cfg.sources, s] });
  }

  function start() {
    const res = runParse(cfg);
    setFound(res); saveFound(res);
    setSel(res.map((m) => m.id));
    const run: ParseRun = { id: "r_" + Date.now(), at: Date.now(), keywords: cfg.keywords || "—", source: cfg.sources[0] || "—", count: res.length };
    const hist = [run, ...history].slice(0, 20);
    setHistory(hist); saveHistory(hist);
    setNote(`Найдено материалов: ${res.length}`);
  }

  const chosen = found.filter((m) => sel.includes(m.id));

  function saveToDrafts(go: boolean) {
    const list = (chosen.length ? chosen : found);
    if (!list.length) { setNote("Сначала запустите парсинг."); return; }
    addDrafts(list.map((m) => ({ text: m.text, type: "Текст" })), "Парсинг");
    if (go) router.push("/dashboard/content?tab=drafts");
    else setNote(`Сохранено в черновики: ${list.length}. Открыть раздел «Контент» → «Черновики».`);
  }

  function toggleSel(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Парсинг"]} />
      <div className="content" style={{ maxWidth: 1080 }}>
        <div className="sec-head">
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Парсинг аудитории и контента</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Соберите чаты, посты и аккаунты по вашей нише. Найденные материалы сохраняются в «Черновики»,
              где из них создаётся контент. Здесь ничего не публикуется автоматически.
            </p>
          </div>
        </div>

        <div className="pr-flow">Парсинг → <b>Черновики</b> → Создание контента → Календарь → Публикация</div>

        <div className="pr-grid">
          {/* Настройки парсинга */}
          <div className="card pr-card">
            <div className="pr-card__t">🔍 Настройка сбора</div>

            <label className="pw-label">Источники и каналы</label>
            <div className="pw-chips">
              {PARSE_SOURCES.map((s) => (
                <button key={s} className={`pw-chip${cfg.sources.includes(s) ? " on" : ""}`} onClick={() => toggleSource(s)} type="button">
                  {cfg.sources.includes(s) ? "✓ " : "+ "}{s}
                </button>
              ))}
            </div>

            <label className="pw-label" style={{ marginTop: 14 }}>Ключевые слова и фильтры</label>
            <input className="input" value={cfg.keywords} onChange={(e) => patch({ keywords: e.target.value })} placeholder="крипто, трейдинг, инвестиции…" />
            <label className="pw-check"><input type="checkbox" checked={cfg.excludeBots} onChange={(e) => patch({ excludeBots: e.target.checked })} /> Исключить ботов и удалённые аккаунты</label>
            <label className="pw-check"><input type="checkbox" checked={cfg.dedup} onChange={(e) => patch({ dedup: e.target.checked })} /> Убирать дубликаты</label>

            <label className="pw-label" style={{ marginTop: 14 }}>Частота сбора</label>
            <select className="select" value={cfg.frequency} onChange={(e) => patch({ frequency: e.target.value })} style={{ maxWidth: 240 }}>
              {PARSE_FREQ.map((f) => <option key={f}>{f}</option>)}
            </select>

            <div className="pw-row" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={start} type="button">🔍 Запустить парсинг</button>
            </div>
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

        {/* Предпросмотр найденного */}
        <div className="card pr-card" style={{ marginTop: 16 }}>
          <div className="pr-found__head">
            <div className="pr-card__t" style={{ margin: 0 }}>Найденные публикации {found.length > 0 && `· ${found.length}`}</div>
            {found.length > 0 && (
              <button className="btn-link" type="button" onClick={() => setSel(sel.length === found.length ? [] : found.map((m) => m.id))}>
                {sel.length === found.length ? "Снять выделение" : "Выбрать все"}
              </button>
            )}
          </div>

          {found.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
              Задайте источники и ключевые слова, затем нажмите «Запустить парсинг» — здесь появится предпросмотр найденных материалов.
            </div>
          ) : (
            <>
              <div className="pr-found__grid">
                {found.map((m) => (
                  <label key={m.id} className={`pr-mat${sel.includes(m.id) ? " on" : ""}`}>
                    <input type="checkbox" checked={sel.includes(m.id)} onChange={() => toggleSel(m.id)} />
                    <span className="pr-mat__ico">{KIND_ICON[m.kind]}</span>
                    <div className="pr-mat__body">
                      <b>{m.title}</b>
                      <span className="muted">{KIND_LABEL[m.kind]} · {m.meta}</span>
                      <span className="pr-mat__text">{m.text}</span>
                    </div>
                  </label>
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
      </div>
    </>
  );
}
