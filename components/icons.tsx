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
export const IconChannels = base(
  <>
    <path d="M4 9v6M8 7v10M12 5v14M16 8v8M20 10v4" />
  </>
);
export const IconUserParse = base(
  <>
    <circle cx="10" cy="8" r="3.2" />
    <path d="M4 19a6 6 0 0 1 10-3.3" />
    <circle cx="17" cy="16" r="3" />
    <path d="M21 20l-1.8-1.8" />
  </>
);
export const IconHome = base(
  <>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </>
);
export const IconSpark = base(
  <>
    <path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z" />
    <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </>
);
export const IconTeam = base(
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 6.5a3 3 0 0 1 0 5.8" />
    <path d="M17 14.2A6 6 0 0 1 21 20" />
  </>
);
export const IconHelp = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 3.9-2c1.6 1 1 3-.9 3.5-.6.2-1 .8-1 1.5" />
    <path d="M12 17h.01" />
  </>
);

export const IconCalendar = base(
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 3v3M16 3v3" />
  </>
);
export const IconCheck = base(<path d="M4 12.5 9 17.5 20 6.5" />);
export const IconArrowRight = base(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconBook = base(
  <>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
  </>
);
export const IconRocket = base(
  <>
    <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8.9-2 .2-2.8-.8-.7-2-.6-2.7.2z" />
    <path d="M9 12a12 12 0 0 1 8-9c1 4-.5 8-4 11l-3 1-2-2 1-1z" />
    <circle cx="14.5" cy="8.5" r="1.3" />
  </>
);
export const IconLayers = base(
  <>
    <path d="M12 3 3 8l9 5 9-5-9-5z" />
    <path d="M3 13l9 5 9-5M3 18l9 5 9-5" opacity=".55" />
  </>
);
