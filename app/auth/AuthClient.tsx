"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Tab = "login" | "register";
type Step = "auth" | "cabinet";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s_-]/gi, "")
    .trim()
    .replace(/[\s]+/g, "_")
    .slice(0, 24);
}

export default function AuthClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    params.get("mode") === "register" ? "register" : "login"
  );
  const [step, setStep] = useState<Step>("auth");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [subdomain, setSubdomain] = useState("");

  function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "register") {
      setStep("cabinet");
    } else {
      router.push("/dashboard/bots");
    }
  }

  function createCabinet(e: React.FormEvent) {
    e.preventDefault();
    const sub = subdomain || slugify(company) || slugify(email.split("@")[0] || "cabinet");
    try {
      localStorage.setItem(
        "sb_workspace",
        JSON.stringify({ company: company || "Мой кабинет", subdomain: sub })
      );
    } catch {}
    router.push("/dashboard/bots");
  }

  return (
    <div className="auth">
      <div className="auth__promo">
        <Link href="/" className="auth__promo-brand">
          <span className="brand-logo">🤖</span> Smartbot Pro
        </Link>
        <div className="auth__promo-body">
          <h2>Создавайте ботов любой сложности и общайтесь с клиентами</h2>
          <p>
            Сразу во всех популярных мессенджерах: Telegram, ВКонтакте, WhatsApp, MAX и на
            сайте. Первая неделя — бесплатно.
          </p>
          <div className="auth__msgrs">
            <span className="auth__msgr">TG</span>
            <span className="auth__msgr">VK</span>
            <span className="auth__msgr">WA</span>
            <span className="auth__msgr">MAX</span>
          </div>
        </div>
      </div>

      <div className="auth__form-wrap">
        <div className="auth__card">
          {step === "auth" ? (
            <>
              <h1>Добро пожаловать!</h1>
              <p className="muted" style={{ margin: 0 }}>
                Войдите или создайте аккаунт за минуту.
              </p>

              <div className="auth__tabs">
                <button
                  className={`auth__tab${tab === "login" ? " on" : ""}`}
                  onClick={() => setTab("login")}
                >
                  Войти
                </button>
                <button
                  className={`auth__tab${tab === "register" ? " on" : ""}`}
                  onClick={() => setTab("register")}
                >
                  Создать аккаунт
                </button>
              </div>

              <form onSubmit={submitAuth} style={{ marginTop: 14 }}>
                {tab === "register" && (
                  <div className="field">
                    <label className="label">Имя</label>
                    <input
                      className="input"
                      placeholder="Как к вам обращаться"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}
                <div className="field">
                  <label className="label">Почта</label>
                  <input
                    className="input"
                    type="email"
                    required
                    placeholder="you@company.ru"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">Пароль</label>
                  <input
                    className="input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" style={{ width: "100%" }} type="submit">
                  {tab === "register" ? "Продолжить" : "Войти"}
                </button>
              </form>

              <div className="auth__divider">или через</div>
              <div className="auth__social">
                <button className="soc" title="Google" style={{ color: "#ea4335" }}>
                  G
                </button>
                <button className="soc" title="ВКонтакте" style={{ color: "#0077ff" }}>
                  VK
                </button>
                <button className="soc" title="Telegram" style={{ color: "#2aabee" }}>
                  ✈
                </button>
                <button className="soc" title="Elama" style={{ color: "#111" }}>
                  e
                </button>
              </div>
            </>
          ) : (
            <>
              <button className="auth__back" onClick={() => setStep("auth")}>
                ← Назад
              </button>
              <h1>Создание кабинета</h1>
              <p className="muted" style={{ marginTop: 4 }}>
                Вы можете создать уникальную ссылку для перехода в ваш кабинет. Если
                оставить поле пустым, ссылка сгенерируется автоматически.
              </p>

              <form onSubmit={createCabinet} style={{ marginTop: 18 }}>
                <div className="field">
                  <label className="label">Название компании</label>
                  <input
                    className="input"
                    placeholder="KTS_smarttest"
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value);
                      setSubdomain(slugify(e.target.value));
                    }}
                  />
                  <div className="hint">Используется для создания поддомена.</div>
                </div>

                <div className="field">
                  <label className="label">Ссылка на кабинет</label>
                  <div className="suffix-input">
                    <input
                      className="input"
                      placeholder="kts_smarttest"
                      value={subdomain}
                      onChange={(e) => setSubdomain(slugify(e.target.value))}
                    />
                    <span className="suffix">.smartbotpro.ru</span>
                  </div>
                  <div className="hint">
                    Уникальный адрес для перехода в кабинет — он будет в адресной строке
                    браузера.
                  </div>
                </div>

                <button className="btn btn-primary" style={{ width: "100%" }} type="submit">
                  Создать кабинет
                </button>
              </form>
            </>
          )}

          <p
            className="muted"
            style={{ textAlign: "center", marginTop: 22, fontSize: 12 }}
          >
            Продолжая, вы соглашаетесь с условиями сервиса и политикой конфиденциальности.
          </p>
        </div>
      </div>
    </div>
  );
}
