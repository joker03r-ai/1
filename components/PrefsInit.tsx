"use client";

import { useEffect } from "react";
import {
  loadLang, applyTheme, loadTheme,
  applyFontColor, loadFontColor, applyDensity, loadDensity,
  applyGrad, loadGrad, applyAnim, loadAnim, watchSystemTheme,
} from "@/lib/appPrefs";

// Применяет сохранённые настройки внешнего вида при загрузке.
// Акцент и цвет логотипа задаются оттенком (ползунком) внутри applyTheme.
export default function PrefsInit() {
  useEffect(() => {
    applyTheme(loadTheme());
    applyFontColor(loadFontColor());
    applyDensity(loadDensity());
    applyGrad(loadGrad());
    applyAnim(loadAnim());
    watchSystemTheme();
    if (typeof document !== "undefined") document.documentElement.lang = loadLang();
  }, []);
  return null;
}
