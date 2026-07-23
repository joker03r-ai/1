"use client";

import { useEffect, useState } from "react";
import { IconGear } from "./icons";
import { useEsc } from "@/lib/useEsc";
import { ACCENTS, Accent, Theme, loadAccent, saveAccent, loadTheme, saveTheme } from "@/lib/appPrefs";
import { t } from "@/lib/i18n";

export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState<Accent>("violet");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setAccent(loadAccent());
    setTheme(loadTheme());
  }, []);
  useEsc(open, () => setOpen(false));

  function pickAccent(a: Accent) {
    setAccent(a);
    saveAccent(a);
  }
  function pickTheme(v: Theme) {
    setTheme(v);
    saveTheme(v);
  }

  return (
    <>
      <button className="topbar-icon-btn" onClick={() => setOpen(true)} aria-label={t("settings.title")} title={t("settings.title")}>
        <IconGear className="ico" />
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal__head">
              <b>⚙ {t("settings.title")}</b>
              <button className="fn__x dark" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="set-label">{t("settings.theme")}</div>
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

            <div className="set-label" style={{ marginTop: 18 }}>{t("settings.mode")}</div>
            <div className="set-modes">
              <button className={`set-mode${theme === "light" ? " on" : ""}`} onClick={() => pickTheme("light")}>
                <span className="set-mode__pv light">☀️</span>
                <span>{t("settings.light")}</span>
              </button>
              <button className={`set-mode${theme === "dark" ? " on" : ""}`} onClick={() => pickTheme("dark")}>
                <span className="set-mode__pv dark">🌙</span>
                <span>{t("settings.dark")}</span>
              </button>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => setOpen(false)}>{t("settings.done")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
