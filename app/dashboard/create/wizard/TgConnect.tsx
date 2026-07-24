"use client";

import { useState } from "react";

export type TgInfo = { username: string; name: string; tokenMask: string };

const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "🤖";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}

export default function TgConnect({
  connected,
  onConnected,
  onDisconnect,
}: {
  connected: TgInfo | null;
  onConnected: (info: TgInfo) => void;
  onDisconnect: () => void;
}) {
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [error, setError] = useState("");

  const validFormat = TOKEN_RE.test(token.trim());

  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setToken(t.trim());
    } catch {}
  }

  async function connect() {
    if (status === "checking" || !validFormat) return;
    setStatus("checking");
    setError("");
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Не удалось подключить бота. Проверьте токен и попробуйте снова.");
      // Токен в состоянии не храним — оставляем только публичные данные и маску.
      setToken("");
      setStatus("idle");
      onConnected({ username: data.bot.username, name: data.bot.name, tokenMask: data.tokenMask });
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Не удалось подключить бота. Проверьте токен и попробуйте снова.");
    }
  }

  // Успешное подключение.
  if (connected) {
    return (
      <div className="tgc tgc--ok">
        <div className="tgc-ok">
          <span className="tgc-ava">{initials(connected.name)}</span>
          <div className="tgc-ok__info">
            <div className="tgc-ok__title">✅ Бот {connected.username ? "@" + connected.username : connected.name} успешно подключён</div>
            <div className="tgc-ok__sub">{connected.name} · токен {connected.tokenMask}</div>
          </div>
        </div>
        <div className="tgc-ok__actions">
          <button className="btn btn-sm" type="button" onClick={onDisconnect}>Заменить токен</button>
          <button className="user-act del" type="button" onClick={onDisconnect}>Отключить бота</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tgc">
      <div className="tgc__title">🔌 Подключение бота</div>
      <label className="pw-label" style={{ marginTop: 6 }}>Токен Telegram-бота</label>
      <div className="tgc-field">
        <input
          className="input tgc-input"
          type={show ? "text" : "password"}
          value={token}
          onChange={(e) => { setToken(e.target.value); if (status === "error") setStatus("idle"); }}
          placeholder="123456789:AA..."
          autoComplete="off"
          spellCheck={false}
        />
        <button className="tgc-eye" type="button" onClick={() => setShow((v) => !v)} title={show ? "Скрыть" : "Показать"}>
          {show ? "🙈" : "👁"}
        </button>
        <button className="btn btn-sm tgc-paste" type="button" onClick={paste}>Вставить</button>
      </div>
      <div className="tgc-hint">🔒 Токен можно получить у @BotFather. Не передавайте его посторонним.</div>

      {status === "error" && (
        <div className="tgc-msg tgc-msg--err">⚠ {error}</div>
      )}

      <button
        className="btn btn-primary tgc-connect"
        type="button"
        onClick={connect}
        disabled={!validFormat || status === "checking"}
      >
        {status === "checking" ? (
          <><span className="tgc-spin" /> Проверяем подключение…</>
        ) : (
          "Проверить и подключить"
        )}
      </button>
    </div>
  );
}
