"use client";

import { useEffect, useState } from "react";
import { IconGear } from "./icons";
import { useEsc } from "@/lib/useEsc";
import {
  ACCENTS, Accent, Theme, THEMES, FontColor, Density, GradIntensity, isThemeDark,
  loadAccent, saveAccent, loadTheme, saveTheme, loadHue, saveHue,
  loadFontColor, saveFontColor, loadDensity, saveDensity, loadGrad, saveGrad, loadAnim, saveAnim,
  LOGO_COLORS, LogoColor, loadLogo, saveLogo,
} from "@/lib/appPrefs";
import { t } from "@/lib/i18n";

const FONTS: { id: FontColor; label: string }[] = [
  { id: "black", label: "Чёрный" },
  { id: "gray", label: "Тёмно-серый" },
  { id: "white", label: "Белый" },
];
const GRADS: { id: GradIntensity; label: string }[] = [
  { id: "off", label: "Выкл" },
  { id: "soft", label: "Мягко" },
  { id: "normal", label: "Ярко" },
];

export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState<Accent>("violet");
  const [theme, setTheme] = useState<Theme>("light");
  const [hue, setHue] = useState(265);
  const [font, setFont] = useState<FontColor>("black");
  const [logo, setLogo] = useState<LogoColor>("violet");
  const [density, setDensity] = useState<Density>("standard");
  const [grad, setGrad] = useState<GradIntensity>("normal");
  const [anim, setAnim] = useState(true);

  useEffect(() => {
    setAccent(loadAccent()); setTheme(loadTheme()); setHue(loadHue());
    setFont(loadFontColor()); setDensity(loadDensity()); setGrad(loadGrad()); setAnim(loadAnim()); setLogo(loadLogo());
  }, []);
  useEsc(open, () => setOpen(false));

  function pickTheme(v: Theme) { setTheme(v); saveTheme(v); if (font === "white" && !isThemeDark(v)) { setFont("black"); saveFontColor("black"); } else { saveFontColor(font); } }
  function pickFont(v: FontColor) { setFont(v); saveFontColor(v); }
  const themeDark = isThemeDark(theme);

  return (
    <>
      <button className="topbar-icon-btn" onClick={() => setOpen(true)} aria-label={t("settings.title")} title="Внешний вид">
        <IconGear className="ico" />
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal appr" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal__head">
              <b>🎨 Внешний вид</b>
              <button className="fn__x dark" onClick={() => setOpen(false)}>✕</button>
            </div>

            {/* Темы */}
            <div className="set-label">Тема оформления</div>
            <div className="set-themes">
              {THEMES.map((th) => (
                <button key={th.id} className={`set-theme t-${th.id}${theme === th.id ? " on" : ""}`} onClick={() => pickTheme(th.id)} type="button">
                  <span className="set-theme__pv"><i /><i /><b /></span>
                  <span className="set-theme__l">{th.label}</span>
                </button>
              ))}
            </div>

            {/* Цвет шрифта */}
            <div className="set-label" style={{ marginTop: 16 }}>Цвет шрифта</div>
            <div className="set-seg">
              {FONTS.map((f) => {
                const disabled = f.id === "white" && !themeDark;
                return (
                  <button key={f.id} className={`set-seg__b${font === f.id ? " on" : ""}`} disabled={disabled} onClick={() => pickFont(f.id)} type="button" title={disabled ? "Белый доступен в тёмных темах" : ""}>{f.label}</button>
                );
              })}
            </div>
            {font === "white" && !themeDark && <div className="hint" style={{ marginTop: 6 }}>Белый шрифт доступен только в тёмных темах — на светлом фоне применён чёрный.</div>}

            {/* Акцент */}
            <div className="set-label" style={{ marginTop: 16 }}>Акцентный цвет</div>
            <div className="set-accents">
              {ACCENTS.map((a) => (
                <button key={a.id} className={`set-accent${accent === a.id ? " on" : ""}`} onClick={() => { setAccent(a.id); saveAccent(a.id); }} title={a.label}>
                  <span className="set-accent__dot" style={{ background: a.color }}>{accent === a.id && "✓"}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
            <div className="set-hue" style={{ marginTop: 10 }}>
              <span className="set-hue__swatch" style={{ background: `hsl(${hue} 72% 55%)` }}>{accent === "custom" && "✓"}</span>
              <input className="set-hue__range" type="range" min={0} max={360} value={hue} onChange={(e) => { const h = Number(e.target.value); setHue(h); setAccent("custom"); saveHue(h); }} aria-label="Свой оттенок" />
            </div>

            {/* Цвет логотипа */}
            <div className="set-label" style={{ marginTop: 16 }}>Цвет логотипа</div>
            <div className="set-logos">
              {LOGO_COLORS.map((l) => (
                <button key={l.id} className={`set-logo${logo === l.id ? " on" : ""}`} onClick={() => { setLogo(l.id); saveLogo(l.id); }} title={l.label} type="button">
                  <span className="set-logo__mark" style={{ background: l.grad }}>
                    <svg viewBox="0 0 24 24" aria-hidden><path d="M20.6 3.4 3.7 11c-.75.34-.68 1.43.1 1.66l4.53 1.35 1.35 4.53c.23.78 1.32.85 1.66.1L20.6 3.4z" fill="#fff" /></svg>
                    {logo === l.id && <i className="set-logo__ok">✓</i>}
                  </span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>

            {/* Плотность */}
            <div className="set-label" style={{ marginTop: 16 }}>Плотность интерфейса</div>
            <div className="set-seg">
              <button className={`set-seg__b${density === "standard" ? " on" : ""}`} onClick={() => { setDensity("standard"); saveDensity("standard"); }} type="button">Стандартная</button>
              <button className={`set-seg__b${density === "compact" ? " on" : ""}`} onClick={() => { setDensity("compact"); saveDensity("compact"); }} type="button">Компактная</button>
            </div>

            {/* Градиенты */}
            <div className="set-label" style={{ marginTop: 16 }}>Интенсивность градиентов</div>
            <div className="set-seg">
              {GRADS.map((g) => (
                <button key={g.id} className={`set-seg__b${grad === g.id ? " on" : ""}`} onClick={() => { setGrad(g.id); saveGrad(g.id); }} type="button">{g.label}</button>
              ))}
            </div>

            {/* Анимации */}
            <label className="set-switch" style={{ marginTop: 16 }}>
              <span><b>Анимация интерфейса</b><span className="set-switch__hint">Плавные появления и свечения. Отключите, если отвлекает.</span></span>
              <span className="sw"><input type="checkbox" checked={anim} onChange={() => { const v = !anim; setAnim(v); saveAnim(v); }} /><span className="sw__t" /></span>
            </label>

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-primary" onClick={() => setOpen(false)}>{t("settings.done")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
