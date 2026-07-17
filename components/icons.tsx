// Простые линейные SVG-иконки (без внешних зависимостей).
import React from "react";

type P = { className?: string };
const base = (path: React.ReactNode, vb = "0 0 24 24") => (p: P) =>
  (
    <svg
      className={p.className ?? "ico"}
      viewBox={vb}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );

export const IconBot = base(
  <>
    <rect x="4" y="7" width="16" height="12" rx="3" />
    <path d="M12 7V4M9 13h.01M15 13h.01M2 12h2M20 12h2" />
  </>
);
export const IconFlow = base(
  <>
    <rect x="3" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="16" width="7" height="5" rx="1.5" />
    <path d="M6.5 8v4a2 2 0 0 0 2 2h6a2 2 0 0 1 2 2v.5" />
  </>
);
export const IconCloud = base(
  <path d="M6 18a4 4 0 0 1 .6-7.96A5.5 5.5 0 0 1 17.5 10 3.5 3.5 0 0 1 17 18H6z" />
);
export const IconSend = base(
  <>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </>
);
export const IconChat = base(
  <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
);
export const IconUsers = base(
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
  </>
);
export const IconStore = base(
  <>
    <path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6" />
  </>
);
export const IconChart = base(
  <>
    <path d="M3 3v18h18" />
    <path d="M7 15l3-3 3 2 4-5" />
  </>
);
export const IconPlug = base(
  <>
    <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5" />
  </>
);
export const IconDoc = base(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h6" />
  </>
);
export const IconMail = base(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </>
);
export const IconChevron = base(<path d="M9 18l6-6-6-6" />);
export const IconGlobe = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
  </>
);
export const IconGear = base(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.6H10.4l-.3 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.6h3.2l.3-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z" />
  </>
);
export const IconPlus = base(<path d="M12 5v14M5 12h14" />);
