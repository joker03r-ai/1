"use client";

import { useEffect, useRef, useState } from "react";
import { IconGlobe } from "./icons";
import { Lang, loadLang, saveLang } from "@/lib/appPrefs";

const LANGS: { id: Lang; flag: string; label: string }[] = [
  { id: "ru", flag: "🇷🇺", label: "Русский" },
  { id: "en", flag: "🇬🇧", label: "English" },
];

export default function LangSwitcher() {
  const [lang, setLang] = useState<Lang>("ru");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLang(loadLang());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(l: Lang) {
    setOpen(false);
    if (l === lang) return;
    saveLang(l);
    // Перезагружаем, чтобы навигация и надписи применились сразу.
    setTimeout(() => location.reload(), 120);
  }

  const cur = LANGS.find((l) => l.id === lang) || LANGS[0];

  return (
    <div className="lang-switch" ref={ref}>
      <button
        className="topbar-icon-btn lang-switch__btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Язык интерфейса"
        title="Язык интерфейса"
      >
        <IconGlobe className="ico" />
        <span className="lang-switch__code">{cur.id.toUpperCase()}</span>
      </button>
      {open && (
        <div className="lang-switch__menu">
          {LANGS.map((l) => (
            <button
              key={l.id}
              className={`lang-switch__item${l.id === lang ? " on" : ""}`}
              onClick={() => pick(l.id)}
            >
              <span className="lang-switch__flag">{l.flag}</span>
              <span>{l.label}</span>
              {l.id === lang && <span className="lang-switch__check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
