"use client";

import { BotConfig, BotGoal } from "@/lib/types";
import { AI_MODELS } from "@/lib/models";
import { useState } from "react";

export default function BotTraining({
  bot,
  onChange,
  onSaved,
}: {
  bot: BotConfig;
  onChange: (b: BotConfig) => void;
  onSaved?: () => void;
}) {
  const [siteInput, setSiteInput] = useState("");
  const set = <K extends keyof BotConfig>(k: K, v: BotConfig[K]) =>
    onChange({ ...bot, [k]: v });

  function addSite() {
    const s = siteInput.trim();
    if (!s) return;
    set("sites", [...bot.sites, s]);
    setSiteInput("");
  }

  return (
    <div className="card" style={{ padding: 22 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Задайте настройки AI-бота</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Заполните бриф о компании и товарах — это база знаний, на которой бот будет
        отвечать клиентам.
      </p>

      <div className="field">
        <label className="label">Название AI-бота</label>
        <input
          className="input"
          value={bot.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>

      <div className="field">
        <label className="label">Модель AI</label>
        <select
          className="select"
          value={bot.modelId}
          onChange={(e) => set("modelId", e.target.value)}
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label">Цель AI-бота</label>
        <div className="seg">
          {(["consult", "get_phone"] as BotGoal[]).map((g) => (
            <button
              key={g}
              className={bot.goal === g ? "on" : ""}
              onClick={() => set("goal", g)}
              type="button"
            >
              {g === "consult" ? "Проконсультировать" : "Получить телефон"}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label">База знаний о компании и товарах</label>
        <textarea
          className="textarea"
          style={{ minHeight: 130 }}
          placeholder="Опишите, чем занимается компания, товары/услуги, частые вопросы и ответы…"
          value={bot.knowledge}
          onChange={(e) => set("knowledge", e.target.value)}
        />
        <div className="hint">
          Без таблиц, картинок и нумерованных списков — только текст, как в примере
          BotPilot.
        </div>
      </div>

      <div className="field">
        <label className="label">Инструкция по ведению диалога</label>
        <textarea
          className="textarea"
          placeholder="Как бот должен общаться: тон, ограничения, что делать при незнании ответа…"
          value={bot.instruction}
          onChange={(e) => set("instruction", e.target.value)}
        />
      </div>

      <div className="field">
        <label className="label">Дополнительный контекст</label>
        <textarea
          className="textarea"
          style={{ minHeight: 70 }}
          placeholder="Доп. данные к сайту и документам (необязательно)"
          value={bot.extraContext}
          onChange={(e) => set("extraContext", e.target.value)}
        />
      </div>

      <div className="field">
        <label className="label">Сайты для обучения</label>
        <div className="row">
          <input
            className="input"
            placeholder="Введите url"
            value={siteInput}
            onChange={(e) => setSiteInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSite())}
          />
          <button className="btn" type="button" onClick={addSite}>
            Обучить сайт
          </button>
        </div>
        {bot.sites.length > 0 && (
          <div className="pill-list">
            {bot.sites.map((s, i) => (
              <span className="pill" key={i}>
                {s}
                <button
                  onClick={() =>
                    set(
                      "sites",
                      bot.sites.filter((_, idx) => idx !== i)
                    )
                  }
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label className="label">Документы</label>
        <div className="file-drop">
          Используйте файлы в формате PDF, не более 10 Мб.
          <br />
          <span style={{ color: "var(--violet-600)", fontWeight: 600 }}>
            + Загрузить документ
          </span>
        </div>
      </div>

      <div
        className="row"
        style={{ justifyContent: "space-between", marginTop: 8, marginBottom: 18 }}
      >
        <div>
          <div className="label" style={{ marginBottom: 2 }}>
            Отображать источники
          </div>
          <div className="hint" style={{ marginTop: 0 }}>
            Клиенты будут видеть, из каких материалов взят ответ.
          </div>
        </div>
        <button
          className="toggle"
          data-on={bot.showSources}
          onClick={() => set("showSources", !bot.showSources)}
          aria-label="Отображать источники"
          type="button"
        />
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
        <button className="btn btn-primary" type="button" onClick={onSaved}>
          Сохранить
        </button>
        <button className="btn btn-blue" type="button" onClick={onSaved}>
          Подключить к боту
        </button>
      </div>
    </div>
  );
}
