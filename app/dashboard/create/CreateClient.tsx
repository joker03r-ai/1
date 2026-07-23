"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { IconSpark, IconFlow } from "@/components/icons";

type Mode = "ai" | "manual";

export default function CreateClient() {
  const router = useRouter();
  // По умолчанию выбран быстрый режим с ИИ (для новичков).
  const [mode, setMode] = useState<Mode>("ai");

  function start() {
    // Быстрый режим ведёт в пошаговый мастер; ручной — в визуальный редактор.
    if (mode === "ai") router.push("/dashboard/create/wizard");
    else router.push("/dashboard/scenarios");
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Создать бота"]} />
      <div className="content">
        <div className="create-head">
          <h1 className="h1" style={{ marginBottom: 6 }}>Создать бота</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
            Выберите, как удобнее собрать бота. Новичкам советуем быстрый режим — система
            задаст несколько простых вопросов и соберёт всё сама.
          </p>
        </div>

        <div className="create-modes">
          <button
            className={`create-mode${mode === "ai" ? " on" : ""}`}
            onClick={() => setMode("ai")}
            type="button"
          >
            <span className="create-mode__badge">Рекомендуем</span>
            <span className="create-mode__ico"><IconSpark className="ico" /></span>
            <span className="create-mode__title">Быстро с помощью ИИ</span>
            <span className="create-mode__desc">
              Ответьте на несколько вопросов — система сама создаст структуру, сценарий,
              тексты, кнопки и ИИ-ассистента.
            </span>
            <ul className="create-mode__list">
              <li>Подходит новичкам</li>
              <li>Готовый бот за пару минут</li>
              <li>Можно доработать вручную позже</li>
            </ul>
          </button>

          <button
            className={`create-mode${mode === "manual" ? " on" : ""}`}
            onClick={() => setMode("manual")}
            type="button"
          >
            <span className="create-mode__ico gray"><IconFlow className="ico" /></span>
            <span className="create-mode__title">Настроить вручную</span>
            <span className="create-mode__desc">
              Откроется визуальный редактор со всеми блоками и настройками — полный контроль
              над каждым шагом диалога.
            </span>
            <ul className="create-mode__list">
              <li>Для опытных пользователей</li>
              <li>Все блоки и условия</li>
              <li>Точная настройка логики</li>
            </ul>
          </button>
        </div>

        <div className="create-foot">
          <button className="btn btn-primary btn-lg" onClick={start}>
            {mode === "ai" ? "Продолжить с ИИ →" : "Открыть редактор →"}
          </button>
        </div>
      </div>
    </>
  );
}
