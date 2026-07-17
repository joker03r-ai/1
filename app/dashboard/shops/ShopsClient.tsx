"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { PAYMENT_PROVIDERS } from "@/lib/integrations";

type Shop = { id: string; name: string; provider: string };

export default function ShopsClient() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState(PAYMENT_PROVIDERS[0]?.id || "");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sb_shops");
      if (raw) setShops(JSON.parse(raw));
    } catch {}
  }, []);

  function save(list: Shop[]) {
    setShops(list);
    try {
      localStorage.setItem("sb_shops", JSON.stringify(list));
    } catch {}
  }

  function create() {
    if (!name.trim()) return;
    save([...shops, { id: "shop_" + Math.random().toString(36).slice(2, 7), name: name.trim(), provider }]);
    setName("");
    setCreating(false);
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Магазины"]} />
      <div className="content">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Магазины</h1>
            <p className="muted" style={{ margin: 0 }}>
              Привяжите платёжный кошелёк, чтобы принимать оплату в боте.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Подключить магазин
          </button>
        </div>

        {shops.length === 0 ? (
          <div className="card scn-empty">
            <div className="scn-empty__ico">🛍️</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>У вас нет привязанных магазинов</div>
            <p className="muted" style={{ maxWidth: 420, margin: 0 }}>
              Подключите магазин с платёжной системой — и добавляйте кнопки оплаты в сценарии.
            </p>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>Подключить магазин</button>
          </div>
        ) : (
          <div className="scn-list">
            {shops.map((s) => {
              const prov = PAYMENT_PROVIDERS.find((p) => p.id === s.provider);
              return (
                <div className="card scn-item" key={s.id}>
                  <span className="intg-ico" style={{ background: prov?.color || "#6c5ce7", width: 40, height: 40 }}>{prov?.emoji || "🛍️"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{prov?.name || s.provider}</div>
                  </div>
                  <span className="scn-badge pub">активен</span>
                  <button className="btn" style={{ padding: "6px 10px" }} onClick={() => save(shops.filter((x) => x.id !== s.id))}>🗑</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <b>Подключение магазина</b>
              <button className="fn__x dark" onClick={() => setCreating(false)}>✕</button>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label className="label">Название магазина</label>
              <input className="input" placeholder="Мой магазин" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="label">Платёжная система</label>
              <select className="select" value={provider} onChange={(e) => setProvider(e.target.value)}>
                {PAYMENT_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button className="btn" onClick={() => setCreating(false)}>Отменить</button>
              <button className="btn btn-primary" onClick={create}>Подключить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
