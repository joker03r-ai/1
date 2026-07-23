"use client";

import { useEffect, useState } from "react";
import { IconGear } from "./icons";
import { useEsc } from "@/lib/useEsc";
import { ACCENTS, Accent, Lang, loadAccent, saveAccent, loadLang, saveLang } from "@/lib/appPrefs";
import { t } from "@/lib/i18n";

export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState<Accent>("violet");
  const [lang, setLang] = useState<Lang>("ru");

  useEffect(() => {
    setAccent(loadAccent());
    setLang(loadLang());
  }, []);
  useEsc(open, () => setOpen(false));

  function pickAccent(a: Accent) {
    setAccent(a);
    saveAccent(a);
  }
  function pickLang(l: Lang) {
    setLang(l);
    saveLang(l);
    // Перезагружаем, чтобы навигация и надписи применились сразу.
    setTimeout(() => location.reload(), 150);
  }

  return (
    <>
      <button className="topbar-icon-btn" onClick={() => setOpen(true)} aria-label={t("settings.title", lang)} title={t("settings.title", lang)}>
        <IconGear className="ico" />
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal__head">
              <b>⚙ {t("settings.title", lang)}</b>
              <button className="fn__x dark" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="set-label">{t("settings.theme", lang)}</div>
            <div className="set-accents">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  className={`set-accent${accent === a.id ? " on" : ""}`}
                  onClick={() => pickAccent(a.id)}
                  title={a.label}
                >
                  <span className="set-accent__dot" style={{ background: a.color }}>
                    {accent === a.id && "✓"}
                  </span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>

            <div className="set-label" style={{ marginTop: 18 }}>{t("settings.language", lang)}</div>
            <div className="set-lang">
              <button className={`set-lang__btn${lang === "ru" ? " on" : ""}`} onClick={() => pickLang("ru")}>🇷🇺 Русский</button>
              <button className={`set-lang__btn${lang === "en" ? " on" : ""}`} onClick={() => pickLang("en")}>🇬🇧 English</button>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => setOpen(false)}>{t("settings.done", lang)}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
