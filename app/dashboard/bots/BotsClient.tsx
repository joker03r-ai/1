"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { IconPlus } from "@/components/icons";
import { avatarColor } from "@/lib/users";
import {
  Bot,
  BotStatus,
  STATUS_LABELS,
  TgHealth,
  TG_HEALTH,
  botHealth,
  loadBots,
  getCurrentBotId,
  setCurrentBotId,
  updateBot,
  removeBot,
} from "@/lib/bots";
import { loadScenarios, hasStartTrigger, ensureStartScenario, Scenario } from "@/lib/scenarios";

const FILTERS: { id: "all" | BotStatus; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "draft", label: "Черновики" },
  { id: "off", label: "Отключённые" },
];

const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "🤖";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}

function when(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function BotsClient() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cur, setCur] = useState("");
  const [filter, setFilter] = useState<"all" | BotStatus>("all");
  const [confirm, setConfirm] = useState<Bot | null>(null);
  const [openId, setOpenId] = useState<string>("");

  useEffect(() => { refresh(); }, []);

  function refresh() {
    setBots(loadBots());
    setScenarios(loadScenarios());
    setCur(getCurrentBotId());
  }
  function pick(id: string) {
    setCurrentBotId(id);
    setCur(id);
  }
  function remove(bt: Bot) {
    removeBot(bt.id);
    setConfirm(null);
    refresh();
  }

  function hasPublishedStart(b: Bot): boolean {
    return scenarios.some((s) => (s.botId === b.id || s.id === b.scenarioId) && s.published && hasStartTrigger(s));
  }
  function startWelcome(b: Bot): string {
    const s = scenarios.find((x) => (x.botId === b.id || x.id === b.scenarioId) && x.published && hasStartTrigger(x));
    const m = s?.nodes.find((n) => n.kind === "action_message" && n.text);
    return m?.text || "";
  }
  function health(b: Bot): TgHealth {
    return botHealth(b, hasPublishedStart(b));
  }

  const shown = bots.filter((b) => filter === "all" || b.status === filter);

  return (
    <>
      <Topbar crumbs={["Основной проект", "Мои боты"]} />
      <div className="content">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Мои боты · {bots.length}</h1>
            <p className="muted" style={{ margin: 0 }}>
              Обучите бота на данных компании, подключите каналы и отвечайте клиентам 24/7.
              Статус показывает фактическое состояние: подключение, webhook и сценарий /start.
            </p>
          </div>
          <Link href="/dashboard/create" className="btn btn-primary">
            <IconPlus className="ico" /> Создать бота
          </Link>
        </div>

        <div className="seg" style={{ margin: "16px 0" }}>
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? "on" : ""} onClick={() => setFilter(f.id)} type="button">
              {f.label}
            </button>
          ))}
        </div>

        <div className="bots-list">
          {shown.map((bt) => {
            const h = health(bt);
            const meta = TG_HEALTH[h];
            const open = openId === bt.id;
            return (
              <div key={bt.id} className={`bots-card card${bt.id === cur ? " cur" : ""}`}>
                <div className="bots-row">
                  <span className="user-ava" style={{ width: 44, height: 44, fontSize: 15, background: avatarColor(bt.id) }}>
                    {initials(bt.name)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{bt.name}{bt.tgUsername ? ` · @${bt.tgUsername}` : ""}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {[bt.platform, bt.goal].filter(Boolean).join(" · ") || "Бот"}
                    </div>
                  </div>
                  <span className={`tg-badge ${meta.cls}`}><span className="tg-badge__dot">{meta.icon}</span> {meta.label}</span>
                  <button className={`btn btn-sm${open ? " btn-primary" : ""}`} onClick={() => setOpenId(open ? "" : bt.id)} type="button">
                    {open ? "Скрыть" : "Диагностика"}
                  </button>
                  {bt.id === cur ? (
                    <span className="bots-cur">Выбран ✓</span>
                  ) : (
                    <button className="btn btn-sm" onClick={() => pick(bt.id)}>Выбрать</button>
                  )}
                  <button className="user-act del" onClick={() => setConfirm(bt)}>Удалить</button>
                </div>

                {open && <Diagnostics bot={bt} health={h} startPublished={hasPublishedStart(bt)} welcome={startWelcome(bt)} onChange={refresh} />}
              </div>
            );
          })}
          {shown.length === 0 && (
            <div className="muted" style={{ textAlign: "center", padding: 40 }}>
              Ботов в этой категории нет. <Link href="/dashboard/create" style={{ color: "var(--violet-700)", fontWeight: 700 }}>Создать бота →</Link>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__head">
              <b>Удалить бота</b>
              <button className="fn__x dark" onClick={() => setConfirm(null)}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Бот <b>{confirm.name}</b> будет удалён. Его сценарий останется в разделе «Сценарии».
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={() => setConfirm(null)}>Отменить</button>
              <button className="btn btn-danger" onClick={() => remove(confirm)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Диагностика подключения Telegram ---------- */

type Snap = { lastUpdateAt?: number; updates: any[]; errors: { at: number; text: string }[]; webhookUrl?: string };
type Diag = { tokenValid?: boolean; webhookSet?: boolean; receiving?: boolean; inbound?: boolean; mode?: string; webhook?: any; configError?: string; note?: string };

function Diagnostics({ bot, health, startPublished, welcome, onChange }: { bot: Bot; health: TgHealth; startPublished: boolean; welcome: string; onChange: () => void }) {
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [chatId, setChatId] = useState("");
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [snap, setSnap] = useState<Snap>({ updates: [], errors: [] });
  const [cfg, setCfg] = useState<{ baseUrl: string; configured: boolean; https: boolean } | null>(null);

  useEffect(() => { loadSnap(); loadCfg(); /* eslint-disable-next-line */ }, [bot.id]);

  async function loadSnap() {
    try {
      const res = await fetch(`/api/telegram/updates?botId=${encodeURIComponent(bot.id)}`);
      const d = await res.json();
      if (d.ok) setSnap({ lastUpdateAt: d.lastUpdateAt, updates: d.updates || [], errors: d.errors || [], webhookUrl: d.webhookUrl });
    } catch {}
  }
  async function loadCfg() {
    try {
      const d = await (await fetch("/api/telegram/config")).json();
      setCfg({ baseUrl: d.baseUrl || "", configured: !!d.configured, https: !!d.https });
    } catch {}
  }

  // URL webhook формируется из публичного HTTPS-адреса сервера, а не из origin.
  const webhookUrl = cfg?.baseUrl ? `${cfg.baseUrl}/api/telegram/webhook/${bot.id}` : `https://<ваш-домен>/api/telegram/webhook/${bot.id}`;

  async function check() {
    if (checking) return;
    if (!TOKEN_RE.test(token.trim())) {
      setCheckMsg({ ok: false, text: "Введите токен бота (получите у @BotFather)." });
      return;
    }
    setChecking(true);
    setCheckMsg(null);
    try {
      const res = await fetch("/api/telegram/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim(), botId: bot.id, startMessage: welcome }),
      });
      const d = await res.json();
      setDiag(d);
      if (d.tokenValid === false) {
        updateBot(bot.id, { tgConnected: true, tgTokenValid: false, tgLastCheck: Date.now() });
        setCheckMsg({ ok: false, text: d.error || "Токен недействителен." });
      } else if (d.ok) {
        updateBot(bot.id, {
          tgConnected: true, tgTokenValid: true, tgWebhookSet: !!d.receiving,
          tgUsername: d.bot?.username || bot.tgUsername, tgLastCheck: Date.now(),
        });
        setToken("");
        const via = d.mode === "polling" ? "опрос Telegram (polling)" : "webhook";
        // Успех НЕ по факту отправки. Проверяются все звенья цепочки.
        if (!d.receiving) {
          setCheckMsg({ ok: false, text: d.error || d.configError || "Приём сообщений не настроен. Проверьте токен и доступ к Telegram." });
        } else if (!d.inbound) {
          setCheckMsg({ ok: true, text: `Токен и приём (${via}) настроены. Теперь напишите боту /start в Telegram — подтвердим фактический приём сообщения.` });
        } else {
          setCheckMsg({ ok: true, text: `Подключение полностью работает: токен, приём (${via}) и входящие сообщения подтверждены.` });
        }
      } else {
        setCheckMsg({ ok: false, text: d.error || "Не удалось проверить подключение." });
      }
    } catch {
      setCheckMsg({ ok: false, text: "Сервер недоступен. Попробуйте ещё раз." });
    } finally {
      setChecking(false);
      onChange();
      loadSnap();
    }
  }

  async function sendTest() {
    if (sending) return;
    setSending(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId: bot.id, token: token.trim() || undefined, chatId: chatId.trim() }),
      });
      const d = await res.json();
      setTestMsg(d.ok ? { ok: true, text: "Исходящее отправлено. Это проверяет только отправку — приём входящих подтверждается командой /start в Telegram." } : { ok: false, text: d.error || "Не удалось отправить." });
    } catch {
      setTestMsg({ ok: false, text: "Сервер недоступен." });
    } finally {
      setSending(false);
      loadSnap();
    }
  }

  function setupStart() {
    ensureStartScenario(bot.id, bot.name);
    onChange();
  }

  const errors = [...(snap.errors || []), ...((bot.tgErrors || []))].sort((a, b) => b.at - a.at).slice(0, 8);

  return (
    <div className="tgd">
      {/* Чек-лист состояния — проверка успешна только при всех зелёных */}
      <div className="tgd-steps">
        <TgStep ok={bot.tgTokenValid === true} warn={bot.tgTokenValid === undefined} label="Токен действителен" />
        <TgStep ok={bot.tgWebhookSet === true} warn={bot.tgWebhookSet === undefined} label={diag?.mode === "polling" ? "Опрос Telegram запущен" : "Приём сообщений настроен"} />
        <TgStep ok={!!diag?.receiving && !diag?.webhook?.lastError} warn={!diag} label="Telegram без ошибок" />
        <TgStep ok={!!snap.lastUpdateAt} warn={!diag} label="Входящее получено" />
        <TgStep ok={startPublished} label="Сценарий /start опубликован" />
      </div>

      {/* Режим приёма без домена */}
      {cfg && !cfg.configured && (
        <div className="tgd-info">
          ℹ Публичный HTTPS-домен не задан — приём работает через <b>опрос Telegram (polling)</b>, без домена и SSL. Достаточно нажать «Проверить подключение». Для webhook-режима задайте <code>WEBHOOK_BASE_URL=https://api.домен.ru</code> (Nginx/Caddy, 443 → localhost:3000).
        </div>
      )}

      {/* Предупреждение про /start */}
      {!startPublished && (
        <div className="tgd-warn">
          <span>⚠ Базовый сценарий <b>/start</b> не опубликован — бот не ответит на первую команду.</span>
          <button className="btn btn-sm btn-primary" onClick={setupStart} type="button">Настроить /start</button>
        </div>
      )}
      {startPublished && bot.scenarioId && (
        <div className="tgd-line">
          Сценарий /start опубликован. <Link href={`/dashboard/scenarios/${bot.scenarioId}`}>Открыть сценарий →</Link>
        </div>
      )}

      {/* Проверка подключения */}
      <div className="tgd-block">
        <div className="tgd-block__t">Проверить подключение</div>
        <div className="tgd-field">
          <input
            className="input"
            type={show ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Токен бота от @BotFather"
            autoComplete="off"
            spellCheck={false}
            style={{ fontFamily: "ui-monospace, monospace" }}
          />
          <button className="btn btn-sm" type="button" onClick={() => setShow((v) => !v)}>{show ? "🙈" : "👁"}</button>
          <button className="btn btn-sm btn-primary" type="button" onClick={check} disabled={checking}>
            {checking ? "Проверяем…" : "Проверить подключение"}
          </button>
        </div>
        <div className="tgd-hint muted">🔒 Токен уходит только на сервер, не сохраняется в браузере и не показывается целиком. Проверка засчитывается, только когда токен действителен, приём настроен (webhook или polling), Telegram без ошибок и фактически получено входящее сообщение.</div>
        {checkMsg && <div className={`tgd-msg ${checkMsg.ok ? "ok" : "err"}`}>{checkMsg.ok ? "✓ " : "⚠ "}{checkMsg.text}</div>}
        {cfg?.configured
          ? <div className="tgd-line muted">Webhook-адрес: <code>{webhookUrl}</code></div>
          : <div className="tgd-line muted">Приём: <b>опрос Telegram (polling)</b> — домен не требуется.</div>}
      </div>

      {/* Состояние приёма — журнал */}
      <div className="tgd-block">
        <div className="tgd-block__t">Состояние приёма</div>
        <div className="tgd-wh">
          <div className="tgd-wh__row"><span>Режим</span><b>{diag?.mode === "polling" ? "Опрос (polling) — без домена" : diag?.mode === "webhook" ? "Webhook" : "—"}</b></div>
          <div className="tgd-wh__row"><span>Установленный URL</span><b>{diag?.webhook?.url || snap.webhookUrl || "— (ещё не установлен)"}</b></div>
          <div className="tgd-wh__row"><span>pending_update_count</span><b>{diag?.webhook?.pending ?? "—"}</b></div>
          <div className="tgd-wh__row"><span>last_error_message</span><b className={diag?.webhook?.lastError ? "err" : ""}>{diag?.webhook?.lastError || "нет"}</b></div>
          <div className="tgd-wh__row"><span>secret_token</span><b>{diag?.webhook?.hasSecret ? "включён" : "—"}</b></div>
          <div className="tgd-wh__row"><span>Последнее входящее</span><b>{when(snap.lastUpdateAt)}</b></div>
        </div>
      </div>

      {/* Тестовое сообщение */}
      <div className="tgd-block">
        <div className="tgd-block__t">Отправить тестовое сообщение</div>
        <div className="tgd-field">
          <input className="input" value={chatId} onChange={(e) => setChatId(e.target.value.replace(/[^\d-]/g, ""))} placeholder="Ваш Chat ID (узнать: @userinfobot)" inputMode="numeric" />
          <button className="btn btn-sm btn-primary" type="button" onClick={sendTest} disabled={sending}>{sending ? "Отправляем…" : "Отправить тест"}</button>
        </div>
        {testMsg && <div className={`tgd-msg ${testMsg.ok ? "ok" : "err"}`}>{testMsg.ok ? "✓ " : "⚠ "}{testMsg.text}</div>}
      </div>

      {/* Последнее сообщение и журнал */}
      <div className="tgd-grid2">
        <div className="tgd-block">
          <div className="tgd-block__t">Последнее полученное сообщение</div>
          <div className="tgd-last">{when(snap.lastUpdateAt)}</div>
          {snap.updates[0] ? (
            <div className="muted" style={{ fontSize: 12.5 }}>
              {snap.updates[0].isStart ? "/start" : "сообщение"} от {snap.updates[0].from}: «{String(snap.updates[0].text).slice(0, 40)}»
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12.5 }}>Сообщений пока не приходило. Напишите боту <b>/start</b> в Telegram.</div>
          )}
        </div>
        <div className="tgd-block">
          <div className="tgd-block__t">Журнал ошибок</div>
          {errors.length === 0 ? (
            <div className="muted" style={{ fontSize: 12.5 }}>Ошибок нет.</div>
          ) : (
            <ul className="tgd-errs">
              {errors.map((e, i) => (
                <li key={i}><span className="muted">{when(e.at)}</span> — {e.text}</li>
              ))}
            </ul>
          )}
          <button className="btn-link" type="button" onClick={loadSnap} style={{ marginTop: 6 }}>Обновить</button>
        </div>
      </div>
    </div>
  );
}

function TgStep({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  const cls = ok ? "ok" : warn ? "warn" : "err";
  return (
    <div className={`tgd-step ${cls}`}>
      <span className="tgd-step__i">{ok ? "✓" : warn ? "?" : "✕"}</span> {label}
    </div>
  );
}
