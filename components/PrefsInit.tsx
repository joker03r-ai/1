"use client";

import { useEffect } from "react";
import { applyAccent, loadAccent, loadLang } from "@/lib/appPrefs";

// Применяет сохранённые настройки (цветовая гамма, язык) при загрузке.
export default function PrefsInit() {
  useEffect(() => {
    applyAccent(loadAccent());
    if (typeof document !== "undefined") document.documentElement.lang = loadLang();
  }, []);
  return null;
}
