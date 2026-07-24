"use client";

import { useEffect } from "react";
import {
  applyAccent, loadAccent, loadLang, applyTheme, loadTheme,
  applyFontColor, loadFontColor, applyDensity, loadDensity,
  applyGrad, loadGrad, applyAnim, loadAnim, watchSystemTheme,
} from "@/lib/appPrefs";

// Применяет сохранённые настройки внешнего вида при загрузке.
export default function PrefsInit() {
  useEffect(() => {
    applyAccent(loadAccent());
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
