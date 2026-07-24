"use client";

import { useEffect, useState } from "react";
import { useEsc } from "@/lib/useEsc";
import { Lang, loadLang } from "@/lib/appPrefs";
import { t } from "@/lib/i18n";

// Стабильный реферальный код для текущего браузера (демо без бэкенда).
function getRefCode(): string {
  if (typeof window === "undefined") return "botpilot";
  let code = localStorage.getItem("sb_ref_code");
  if (!code) {
    code = "bp" + Math.random().toString(36).slice(2, 8);
    try {
      localStorage.setItem("sb_ref_code", code);
    } catch {}
  }
  return code;
}

export default function SidebarFoot() {
  const [lang, setLang] = useState<Lang>("ru");
  const [partners, setPartners] = useState(false);
  const [order, setOrder] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [ref, setRef] = useState("botpilot");

  useEffect(() => {
    setLang(loadLang());
    setRef(getRefCode());
  }, []);

  useEsc(partners, () => setPartners(false));
  useEsc(order, () => setOrder(false));

  const link = `https://botpilot.app/?ref=${ref}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <div className="sidebar__foot">
        <button className="sf-card sf-card--order" onClick={() => setOrder(true)}>
          <span className="sf-card__ico">🛠</span>
          <span className="sf-card__txt"><b>{t("brand.orderBot", lang)}</b><em>Сделаем под ключ</em></span>
          <span className="sf-card__arr">→</span>
        </button>
        <button className="sf-card sf-card--partners" onClick={() => setPartners(true)}>
          <span className="sf-card__ico">🤝</span>
          <span className="sf-card__txt"><b>{t("brand.partners", lang)}</b><em>Комиссия 30%</em></span>
          <span className="sf-card__badge">30%</span>
        </button>
      </div>

      {partners && (
        <div className="modal-overlay" onClick={() => setPartners(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal__head">
              <b>🤝 {t("partners.title", lang)}</b>
              <button className="fn__x dark" onClick={() => setPartners(false)}>✕</button>
            </div>

            <p className="pt-lead">{t("partners.lead", lang)}</p>

            <div className="set-label">{t("partners.yourLink", lang)}</div>
            <div className="pt-link">
              <input className="pt-link__inp" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn btn-primary pt-link__btn" onClick={copyLink}>
                {copied ? t("partners.copied", lang) : t("partners.copy", lang)}
              </button>
            </div>

            <div className="pt-stats">
              <div className="pt-stat">
                <div className="pt-stat__v">30%</div>
                <div className="pt-stat__l">{t("partners.commission", lang)}</div>
              </div>
              <div className="pt-stat">
                <div className="pt-stat__v">0</div>
                <div className="pt-stat__l">{t("partners.invited", lang)}</div>
              </div>
              <div className="pt-stat">
                <div className="pt-stat__v">0 ₽</div>
                <div className="pt-stat__l">{t("partners.earned", lang)}</div>
              </div>
            </div>

            <div className="set-label" style={{ marginTop: 18 }}>{t("partners.how", lang)}</div>
            <ol className="pt-steps">
              <li>{t("partners.step1", lang)}</li>
              <li>{t("partners.step2", lang)}</li>
              <li>{t("partners.step3", lang)}</li>
            </ol>

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => setPartners(false)}>{t("partners.close", lang)}</button>
            </div>
          </div>
        </div>
      )}

      {order && (
        <div className="modal-overlay" onClick={() => setOrder(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal__head">
              <b>🛠 {t("order.title", lang)}</b>
              <button className="fn__x dark" onClick={() => setOrder(false)}>✕</button>
            </div>

            {orderSent ? (
              <p className="pt-lead" style={{ margin: "18px 0 6px" }}>✅ {t("order.sent", lang)}</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setOrderSent(true);
                  setTimeout(() => {
                    setOrder(false);
                    setOrderSent(false);
                  }, 1600);
                }}
              >
                <p className="pt-lead">{t("order.lead", lang)}</p>
                <input className="pt-inp" required placeholder={t("order.contact", lang)} />
                <textarea className="pt-inp" rows={3} placeholder={t("order.task", lang)} style={{ resize: "vertical" }} />
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="submit" className="btn btn-primary">{t("order.send", lang)}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
