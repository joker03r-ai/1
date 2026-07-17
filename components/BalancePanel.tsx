"use client";

import { AI_MODELS } from "@/lib/models";
import { BotConfig } from "@/lib/types";

function badgeClass(b?: string) {
  if (b === "Новинка") return "badge badge-new";
  if (b === "Хит") return "badge badge-hit";
  return "badge badge-cheap";
}

export default function BalancePanel({ bot }: { bot: BotConfig }) {
  return (
    <div>
      <div className="info-note">
        <span>ℹ️</span>
        <span>
          Обратите внимание: Smartbot AI тарифицируется отдельно от основной подписки
          на использование платформы. За каждый ответ бота с баланса кабинета
          списываются средства.
        </span>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div className="muted" style={{ fontSize: 13 }}>Баланс</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>0 ₽</div>
        </div>
        <button className="btn btn-primary">Пополнить баланс</button>
      </div>

      <div className="section-title" style={{ marginTop: 8 }}>Выбранная модель</div>
      <div className="table-wrap">
        <table className="tariff">
          <thead>
            <tr>
              <th>Модель</th>
              <th>Описание</th>
              <th>Входящие</th>
              <th>Исходящие</th>
              <th>Кэшированные</th>
            </tr>
          </thead>
          <tbody>
            {AI_MODELS.map((m) => {
              const selected = m.id === bot.modelId;
              return (
                <tr
                  key={m.id}
                  style={selected ? { background: "var(--violet-050)" } : undefined}
                >
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mdl">{m.name}</span>
                      {m.badge && <span className={badgeClass(m.badge)}>{m.badge}</span>}
                      {selected && <span className="badge badge-cheap">выбрана</span>}
                    </div>
                  </td>
                  <td style={{ maxWidth: 280, color: "var(--ink-soft)" }}>
                    {m.description}
                  </td>
                  <td className="price">{m.price.incoming} ₽</td>
                  <td className="price">{m.price.outgoing} ₽</td>
                  <td className="price">{m.price.cached} ₽</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hint" style={{ marginTop: 10 }}>
        Цены указаны за 1 млн токенов. Стоимость ответа зависит от выбранной модели и
        количества затраченных токенов.
      </div>

      <div className="section-title">История списаний</div>
      <div className="card" style={{ padding: 16 }}>
        <div className="muted">Затрат на ответы бота в режиме AI пока нет.</div>
      </div>
    </div>
  );
}
