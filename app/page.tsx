import Link from "next/link";

const FEATURES = [
  {
    icon: "🧠",
    title: "AI-бот на ваших данных",
    text: "Обучите бота на описании компании, товарах и PDF — он отвечает клиентам 24/7 по вашей базе знаний.",
  },
  {
    icon: "💬",
    title: "Все мессенджеры сразу",
    text: "Telegram, ВКонтакте, WhatsApp, MAX, Jivo и виджет на сайт — один бот работает во всех каналах параллельно.",
  },
  {
    icon: "🧩",
    title: "Конструктор сценариев",
    text: "Собирайте диалоги из блоков без кода: условия, действия, переменные, приём оплаты и интеграции.",
  },
  {
    icon: "📈",
    title: "Продажи и заявки",
    text: "Бот консультирует, собирает контакты и передаёт горячих клиентов менеджеру или в CRM.",
  },
  {
    icon: "🔌",
    title: "Интеграции",
    text: "amoCRM, GetCourse, Google Таблицы, HTTP-запросы и email — подключайте бота к своим системам.",
  },
  {
    icon: "🎧",
    title: "Забота о клиенте",
    text: "Стоп-слово переводит диалог на оператора, а наша поддержка помогает с настройкой ежедневно.",
  },
];

export default function Landing() {
  return (
    <div className="lp">
      <nav className="lp__nav">
        <div className="lp__brand">
          <span className="brand-logo">🤖</span> Smartbot Pro
        </div>
        <div className="lp__nav-links">
          <a href="#features">Возможности</a>
          <a href="#features">Тарифы</a>
          <a href="#features">Кейсы</a>
          <Link href="/dashboard/bots">Документация</Link>
        </div>
        <div className="lp__nav-spacer" />
        <Link href="/auth" className="btn">Войти</Link>
        <Link href="/auth?mode=register" className="btn btn-primary">
          Попробовать бесплатно
        </Link>
      </nav>

      <header className="lp__hero">
        <span className="lp__eyebrow">✨ Бесплатный период 1 неделя — все возможности</span>
        <h1 className="lp__title">
          Платформа для автоматизации <span className="grad">маркетинга, продаж</span> и
          клиентского сервиса
        </h1>
        <p className="lp__sub">
          Создавайте AI-ботов любой сложности и общайтесь с клиентами сразу во всех
          популярных мессенджерах. Без кода — за один вечер.
        </p>
        <div className="lp__cta">
          <Link href="/auth?mode=register" className="btn btn-primary btn-lg">
            Попробовать бесплатно
          </Link>
          <Link href="/dashboard/bots" className="btn btn-lg">
            Смотреть демо кабинета
          </Link>
        </div>
        <div className="lp__trial">
          Без карты · <b>7 дней</b> полного доступа · отмена в один клик
        </div>
      </header>

      <section className="lp__preview">
        <div className="lp__window">
          <div className="lp__window-bar">
            <span className="lp__dot" style={{ background: "#ff5f57" }} />
            <span className="lp__dot" style={{ background: "#febc2e" }} />
            <span className="lp__dot" style={{ background: "#28c840" }} />
          </div>
          <div className="lp__win-body">
            <div className="lp__win-side">
              {["Smartbot AI", "Сценарии", "Nocode Cloud", "Рассылки", "Чаты", "Статистика"].map(
                (t, i) => (
                  <div className={`li${i === 0 ? " on" : ""}`} key={t}>
                    <span>{["🤖", "🧩", "☁️", "✈️", "💬", "📊"][i]}</span> {t}
                  </div>
                )
              )}
            </div>
            <div className="lp__win-main">
              <div className="lp__skel" style={{ height: 22, width: 200, marginBottom: 16 }} />
              <div className="lp__skel" style={{ height: 90, marginBottom: 12 }} />
              <div className="lp__skel" style={{ height: 44, width: "60%", marginBottom: 12 }} />
              <div className="lp__skel" style={{ height: 44, width: "80%" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="lp__features" id="features">
        <h2>Всё, чтобы бот приносил заявки</h2>
        <p className="lead">
          От обучения на ваших данных до интеграций с CRM — Smartbot Pro закрывает весь
          цикл общения с клиентом.
        </p>
        <div className="lp__grid">
          {FEATURES.map((f) => (
            <div className="feat" key={f.title}>
              <div className="feat__ico">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp__band">
        <div className="lp__band-inner">
          <h2>Запустите AI-бота уже сегодня</h2>
          <p>Регистрация занимает минуту. Первая неделя — бесплатно, со всеми функциями.</p>
          <Link href="/auth?mode=register" className="btn btn-white btn-lg">
            Создать бесплатно
          </Link>
        </div>
      </section>

      <footer className="lp__foot">
        © {new Date().getFullYear()} Smartbot Pro · Платформа автоматизации маркетинга,
        продаж и клиентского сервиса
      </footer>
    </div>
  );
}
