"use client";

import { useEffect } from "react";
import { applyAccent, loadAccent, loadLang, applyTheme, loadTheme } from "@/lib/appPrefs";

// Применяет сохранённые настройки (цветовая гамма, тема, язык) при загрузке.
export default function PrefsInit() {
  useEffect(() => {
    applyAccent(loadAccent());
    applyTheme(loadTheme());
    if (typeof document !== "undefined") document.documentElement.lang = loadLang();
  }, []);
  return null;
}
