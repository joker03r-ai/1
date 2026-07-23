// Дизайнерские иконки платформ для раздела «Каналы».
// Белый глиф на фирменном цвете плитки (цвет задаётся фоном родителя).
import React from "react";

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" aria-hidden>
    {children}
  </svg>
);

const GLYPH: Record<string, React.ReactNode> = {
  telegram: svg(
    <path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.8.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13 1.8 11.5c-1-.3-1-1 .2-1.5L20.6 2.9c.9-.3 1.6.2 1.3 1.4Z" fill="#fff" />
  ),
  whatsapp: svg(
    <>
      <path d="M12 2.5A9.5 9.5 0 0 0 3.7 16.8L2.5 21.5l4.8-1.2A9.5 9.5 0 1 0 12 2.5Z" fill="#fff" opacity=".18" />
      <path d="M12 4a8 8 0 0 0-6.8 12.2l.3.5-.7 2.6 2.7-.7.5.3A8 8 0 1 0 12 4Z" stroke="#fff" strokeWidth="1.6" />
      <path d="M9.2 7.7c.2 0 .5 0 .7.5l.7 1.6c.1.2.1.4-.1.6l-.5.6c-.1.1-.1.3 0 .5.4.8 1.1 1.5 2 1.9.2.1.4.1.5 0l.6-.6c.2-.2.4-.2.6-.1l1.6.7c.4.2.5.4.5.7 0 1.1-1 2-2.1 1.8-3-.3-5.4-2.8-5.6-5.8-.1-1 .8-1.9 1.9-1.9Z" fill="#fff" />
    </>
  ),
  instagram: svg(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.6" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.8" cy="7.2" r="1.1" fill="#fff" />
    </>
  ),
  facebook: svg(
    <path d="M13.2 21v-7.5h2.4l.4-2.9h-2.8V8.8c0-.8.3-1.4 1.5-1.4h1.4V4.8c-.7-.1-1.5-.2-2.3-.2-2.3 0-3.9 1.4-3.9 4v2h-2.5v2.9h2.5V21z" fill="#fff" />
  ),
  web: svg(
    <>
      <circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="1.6" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 2.5 14.7 0 17M12 3.5c-2.5 2.3-2.5 14.7 0 17" stroke="#fff" strokeWidth="1.4" />
    </>
  ),
  avito: svg(
    <>
      <circle cx="7" cy="8" r="2" fill="#fff" />
      <circle cx="17" cy="7" r="1.4" fill="#fff" opacity=".85" />
      <circle cx="16.5" cy="16" r="2.4" fill="#fff" />
      <circle cx="8" cy="16" r="1.6" fill="#fff" opacity=".85" />
    </>
  ),
};

function keyFor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("telegram")) return "telegram";
  if (l.includes("whatsapp")) return "whatsapp";
  if (l.includes("viber")) return "whatsapp";
  if (l.includes("instagram")) return "instagram";
  if (l.includes("facebook")) return "facebook";
  if (l.includes("веб")) return "web";
  if (l.includes("вконтакте")) return "vk";
  if (l.includes("однокласс")) return "ok";
  if (l.includes("avito")) return "avito";
  return "chat";
}

const MONO: Record<string, string> = { vk: "VK", ok: "OK", chat: "•" };

export function ChannelIcon({ label }: { label: string }) {
  const k = keyFor(label);
  if (GLYPH[k]) return <>{GLYPH[k]}</>;
  return <span className="ch-mono">{MONO[k] || label.slice(0, 2).toUpperCase()}</span>;
}
