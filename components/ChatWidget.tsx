"use client";

import { useEffect, useRef, useState } from "react";
import { BotConfig } from "@/lib/types";

type Msg = { role: "user" | "assistant" | "system"; content: string };

const FREE_LIMIT = 100;

export default function ChatWidget({ bot }: { bot: BotConfig }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Здравствуйте! Я ${bot.name}. Задайте вопрос — я на связи.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Счётчик бесплатных тестовых сообщений (как в оригинале — 100 шт.).
  useEffect(() => {
    const v = Number(localStorage.getItem("sb_used") || "0");
    setUsed(v);
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const remaining = Math.max(0, FREE_LIMIT - used);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (remaining <= 0) return;

    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history);
    setInput("");
    setLoading(true);

    const nextUsed = used + 1;
    setUsed(nextUsed);
    localStorage.setItem("sb_used", String(nextUsed));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bot,
          history: history
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
        if (data.source === "operator") {
          setMessages((m) => [
            ...m,
            { role: "system", content: "🟢 Диалог передан оператору" },
          ]);
        }
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Извините, произошла ошибка. Попробуйте ещё раз." },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Не удалось связаться с сервером." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetCounter() {
    setUsed(0);
    localStorage.setItem("sb_used", "0");
  }

  return (
    <div className="chat">
      <div className="chat__head">
        <div className="bot-avatar">🤖</div>
        <div>
          <div className="chat__title">{bot.name}</div>
          <div className="chat__status">в сети</div>
        </div>
      </div>

      <div className="chat__body" ref={bodyRef}>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === "assistant" ? "bot" : m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="msg bot">
            <span className="typing">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>

      <div className="counter">
        {remaining > 0 ? (
          <>Осталось тестовых сообщений: {remaining} из {FREE_LIMIT}</>
        ) : (
          <>
            Бесплатные сообщения закончились.{" "}
            <a className="btn-ghost" style={{ cursor: "pointer" }} onClick={resetCounter}>
              Сбросить (демо)
            </a>
          </>
        )}
      </div>

      <div className="chat__foot">
        <textarea
          className="chat__input"
          placeholder="Введите сообщение, чтобы протестировать бота…"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="send-btn"
          onClick={send}
          disabled={loading || !input.trim() || remaining <= 0}
          aria-label="Отправить"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
