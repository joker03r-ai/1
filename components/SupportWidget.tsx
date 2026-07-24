"use client";

import { useEffect, useRef, useState } from "react";

// Рабочие часы техподдержки: ежедневно 9:00–21:00.
const WORK_START = 9;
const WORK_END = 21;

function isOnline(d = new Date()): boolean {
  const h = d.getHours();
  return h >= WORK_START && h < WORK_END;
}

type Mode = "menu" | "compose" | "sent";

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [online, setOnline] = useState(true);
  const [text, setText] = useState("");

  // Перетаскивание виджета мышью.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const moved = useRef(false);

  // Держим кнопку в пределах экрана — чтобы не «прыгала» и не уезжала за край.
  function clamp(p: { x: number; y: number }): { x: number; y: number } {
    const w = ref.current?.offsetWidth || 56;
    const h = ref.current?.offsetHeight || 56;
    return {
      x: Math.max(6, Math.min(window.innerWidth - w - 6, p.x)),
      y: Math.max(6, Math.min(window.innerHeight - h - 6, p.y)),
    };
  }

  useEffect(() => {
    setOnline(isOnline());
    const t = setInterval(() => setOnline(isOnline()), 60_000);
    try {
      const s = localStorage.getItem("sb_support_pos");
      if (s) setPos(clamp(JSON.parse(s)));
    } catch {}
    // При изменении размера окна возвращаем кнопку в видимую область.
    function onResize() {
      setPos((p) => (p ? clamp(p) : p));
    }
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function onMove(e: PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
    const w = ref.current?.offsetWidth || 56;
    const h = ref.current?.offsetHeight || 56;
    const nx = Math.max(6, Math.min(window.innerWidth - w - 6, drag.current.ox + dx));
    const ny = Math.max(6, Math.min(window.innerHeight - h - 6, drag.current.oy + dy));
    setPos({ x: nx, y: ny });
  }
  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    drag.current = null;
    setPos((p) => {
      if (p) try { localStorage.setItem("sb_support_pos", JSON.stringify(p)); } catch {}
      return p;
    });
    setTimeout(() => (moved.current = false), 0);
  }
  function onDown(e: React.PointerEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    moved.current = false;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: rect.left, oy: rect.top };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function submit() {
    if (!text.trim()) return;
    setMode("sent");
    setText("");
  }

  const openUp = pos ? (typeof window !== "undefined" && pos.y > window.innerHeight / 2) : true;

  return (
    <div
      className={`support${openUp ? " up" : " down"}`}
      ref={ref}
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
    >
      {open && (
        <div className="support__panel" role="dialog" aria-label="Техподдержка BotPilot">
          <div className="support__head" onPointerDown={onDown} style={{ cursor: "grab" }}>
            <button
              className="support__collapse"
              onClick={() => setOpen(false)}
              aria-label="Свернуть"
            >
              ⌄
            </button>
            <div className="support__avatars">
              <span className="sa sa1">🙂</span>
              <span className="sa sa2">👩</span>
            </div>
            <div className="support__title">Команда заботы BotPilot</div>
            <div className="support__subtitle">Мы тут и готовы помочь</div>
          </div>

          <div className="support__body">
            {mode === "menu" && (
              <>
                <div className="support__actions">
                  <button className="support__action" onClick={() => setMode("compose")}>
                    <span className="sa-ico blue">✎</span>
                    <span>Написать</span>
                  </button>
                  <a
                    className="support__action"
                    href="https://t.me/botpilot"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="sa-ico tg">✈</span>
                    <span>Telegram</span>
                  </a>
                </div>

                <a className="support__tip" href="/dashboard/chats">
                  <span className="support__tip-ico">💬</span>
                  <span className="support__tip-txt">
                    <b>Отвечать клиентам вручную</b>
                    <em>Раздел «Чаты» — подключите Telegram и отвечайте сами, когда нужно</em>
                  </span>
                  <span className="support__tip-arr">→</span>
                </a>

                <div className="support__hist-label">
                  <span>История</span>
                </div>
                <div className="support__hist-item">
                  <span className="sa-agent">А</span>
                  <div>
                    <div className="sa-name">Алиса</div>
                    <div className="sa-msg">Какой у вас вопрос?</div>
                  </div>
                  <span className="sa-time">
                    {new Date().toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </>
            )}

            {mode === "compose" && (
              <div className="support__compose">
                <button className="btn-ghost support__back" onClick={() => setMode("menu")}>
                  ← Назад
                </button>
                <div className="sa-name" style={{ marginBottom: 6 }}>
                  Опишите ваш вопрос
                </div>
                <textarea
                  className="textarea"
                  style={{ minHeight: 90 }}
                  placeholder="Ваш вопрос по функционалу или настройке бота…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={submit}
                  disabled={!text.trim()}
                >
                  Отправить вопрос
                </button>
              </div>
            )}

            {mode === "sent" && (
              <div className="support__sent">
                <div className="support__sent-ico">✓</div>
                <div className="sa-name">Вопрос отправлен</div>
                <div className="sa-msg" style={{ marginTop: 4 }}>
                  {online
                    ? "Специалист ответит в ближайшее время."
                    : "Сейчас нерабочее время — ответим в рабочие часы (9:00–21:00). Ответ также придёт на вашу почту."}
                </div>
                <button
                  className="btn"
                  style={{ marginTop: 12 }}
                  onClick={() => setMode("menu")}
                >
                  Готово
                </button>
              </div>
            )}
          </div>

          <div className="support__foot">
            <span className={`support__dot ${online ? "on" : "off"}`} />
            {online
              ? "Онлайн · отвечаем ежедневно 9:00–21:00"
              : "Сейчас офлайн · график 9:00–21:00, оставьте вопрос"}
          </div>
        </div>
      )}

      {!open && online && <span className="support__ring" aria-hidden />}
      <button
        className={`support__launcher${open ? " is-open" : ""}`}
        onPointerDown={onDown}
        onClick={() => {
          if (moved.current) return; // был перетаскиванием, не открываем
          setOpen((v) => !v);
          setMode("menu");
        }}
        aria-label="Техподдержка · перетащите, чтобы переместить"
        title="Перетащите, чтобы переместить"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="support__ic" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="support__ic" aria-hidden><path d="M4 5.6A2.6 2.6 0 0 1 6.6 3h10.8A2.6 2.6 0 0 1 20 5.6v6.8a2.6 2.6 0 0 1-2.6 2.6H9.4L5 19.4V15h-.4A2.6 2.6 0 0 1 4 12.4V5.6Z" fill="currentColor" /><circle cx="9" cy="9" r="1.15" fill="#3b6ef6" /><circle cx="12" cy="9" r="1.15" fill="#3b6ef6" /><circle cx="15" cy="9" r="1.15" fill="#3b6ef6" /></svg>
        )}
        {!open && online && <span className="support__badge" />}
      </button>
    </div>
  );
}
