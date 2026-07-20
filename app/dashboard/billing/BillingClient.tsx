"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { PLANS, COMPARE, PlanId, Plan, loadPlan, setPlan, fmtRub } from "@/lib/billing";

export default function BillingClient() {
  const [annual, setAnnual] = useState(true);
  const [plan, setCur] = useState<PlanId>("free");
  const [toast, setToast] = useState("");

  useEffect(() => setCur(loadPlan()), []);

  function choose(p: Plan) {
    setPlan(p.id);
    setCur(p.id);
    setToast(`Тариф «${p.name}» выбран`);
    setTimeout(() => setToast(""), 2600);
  }

  const cell = (v: string | boolean) =>
    v === true ? <span className="cmp-yes">✓</span> : v === false ? <span className="cmp-no">—</span> : <span>{v}</span>;

  return (
    <>
      <Topbar crumbs={["Основной проект", "Тарифы"]} />
      <div className="content" style={{ maxWidth: 1180 }}>
        <div className="bill-hero">
          <div>
            <h1 className="h1" style={{ marginBottom: 4 }}>Тарифы</h1>
            <p className="muted" style={{ margin: 0 }}>
              Сейчас активен пробный период — все функции открыты 7 дней. Выберите план,
              чтобы продолжить без ограничений.
            </p>
          </div>
          <div className="bill-toggle">
            <button className={!annual ? "on" : ""} onClick={() => setAnnual(false)}>Помесячно</button>
            <button className={annual ? "on" : ""} onClick={() => setAnnual(true)}>
              На год <span className="bill-save">−20%</span>
            </button>
          </div>
        </div>

        <div className="bill-grid">
          {PLANS.map((p) => {
            const price = annual ? p.annual : p.monthly;
            const isCur = plan === p.id;
            return (
              <div key={p.id} className={`bill-card${p.popular ? " popular" : ""}${isCur ? " current" : ""}`}>
                {p.popular && <div className="bill-badge">Популярный</div>}
                <div className="bill-card__emoji">{p.emoji}</div>
                <div className="bill-card__name">{p.name}</div>
                <div className="bill-card__tag">{p.tagline}</div>
                <div className="bill-price">
                  <span className="bill-price__num">{fmtRub(price)}</span>
                  {price > 0 && <span className="bill-price__per">/мес</span>}
                </div>
                <div className="bill-price__note">
                  {price === 0 ? "навсегда" : annual ? `при оплате за год · ${fmtRub(price * 12)}` : "при помесячной оплате"}
                </div>
                <button
                  className={`btn ${isCur ? "" : p.popular ? "btn-ai" : "btn-primary"}`}
                  style={{ width: "100%", marginBottom: 14 }}
                  disabled={isCur}
                  onClick={() => choose(p)}
                >
                  {isCur ? "Текущий план" : price === 0 ? "Остаться на бесплатном" : "Выбрать план"}
                </button>
                <ul className="bill-feats">
                  {p.highlights.map((h) => (
                    <li key={h}><span className="bill-check">✓</span> {h}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="section-title">Сравнение возможностей</div>
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Возможность</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={plan === p.id ? "cur" : ""}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.feature}>
                  <td className="cmp-feature">{row.feature}</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className={plan === p.id ? "cur" : ""}>{cell(row.values[p.id])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bill-faq">
          <div className="section-title">Частые вопросы</div>
          <details className="docs-q"><summary>Можно ли сменить тариф позже?</summary><p>Да, в любой момент. При переходе на старший тариф доплата рассчитывается пропорционально остатку периода.</p></details>
          <details className="docs-q"><summary>Что будет после пробного периода?</summary><p>Кабинет продолжит работать на бесплатном тарифе с базовыми лимитами. Платные функции отключатся, данные сохранятся.</p></details>
          <details className="docs-q"><summary>Как оплатить?</summary><p>Картой или по счёту для юрлиц. Платёжные системы подключаются в разделе «Интеграции».</p></details>
        </div>
      </div>

      {toast && <div className="bill-toast">✓ {toast}</div>}
    </>
  );
}
