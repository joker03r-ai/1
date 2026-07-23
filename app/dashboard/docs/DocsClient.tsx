"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";

const TOC = [
  { id: "intro", label: "О сервисе" },
  { id: "quickstart", label: "Быстрый старт" },
  { id: "map", label: "Разделы кабинета" },
  { id: "editor", label: "Конструктор сценариев" },
  { id: "ai", label: "Сборка сценария ИИ" },
  { id: "recipes", label: "Готовые рецепты" },
  { id: "payments", label: "Оплата и интеграции" },
  { id: "channels", label: "Каналы" },
  { id: "parser", label: "Парсер пользователей" },
  { id: "settings", label: "Подключение и настройка" },
  { id: "faq", label: "Частые вопросы" },
];

const PAY_STEPS: { name: string; emoji: string; steps: string[] }[] = [
  {
    name: "ЮKassa",
    emoji: "💳",
    steps: [
      "ЛК ЮKassa → «Настройки» → «Магазин»: скопируйте shopId.",
      "Раздел «API-ключи» → выпустите секретный ключ (live для боевых платежей).",
      "Интеграции → ЮKassa → «Подключить» → вставьте shopId и секретный ключ → «Сохранить и подключить».",
    ],
  },
  {
    name: "Telegram Payments",
    emoji: "✈️",
    steps: [
      "@BotFather → /mybots → ваш бот → Payments.",
      "Подключите провайдера (например ЮKassa) и скопируйте токен провайдера.",
      "Интеграции → Telegram Payments → вставьте токен провайдера.",
    ],
  },
  {
    name: "ЮMoney / Qiwi / Тинькофф / Prodamus",
    emoji: "🧾",
    steps: [
      "В личном кабинете сервиса выпустите API-токен / секретный ключ.",
      "Интеграции → нужный сервис → «Подключить» → вставьте данные из подсказки в окне.",
    ],
  },
];

const STEPS = [
  {
    n: 1,
    title: "Создайте бота",
    body: "Откройте раздел «BotPilot AI» → «Создать бота». Задайте имя и подключите канал (Telegram, VK). Токен бота берётся у @BotFather в Telegram — вставьте его на вкладке «Каналы».",
    link: { href: "/dashboard/bots", label: "К ботам" },
  },
  {
    n: 2,
    title: "Обучите бота",
    body: "На вкладке «Обучение» дайте боту инструкцию — кто он, чем помогает, как отвечает. Добавьте базу знаний (частые вопросы, услуги, цены). Бот будет отвечать в этом стиле.",
    link: { href: "/dashboard/bots", label: "Инструкция и обучение" },
  },
  {
    n: 3,
    title: "Соберите сценарий",
    body: "Раздел «Сценарии» → «Создать». Соберите диалог из блоков в визуальном редакторе или нажмите «✨ Собрать ИИ» и опишите бота словами — схема соберётся сама.",
    link: { href: "/dashboard/scenarios", label: "К сценариям" },
  },
  {
    n: 4,
    title: "Настройте заявки и оплату",
    body: "Добавьте менеджеров (кому падают заявки), переменные (что сохранять о клиенте) и подключите интеграции — Google Таблицы, ЮKassa и другие платёжные системы.",
    link: { href: "/dashboard/integrations", label: "К интеграциям" },
  },
  {
    n: 5,
    title: "Опубликуйте",
    body: "В редакторе нажмите «Опубликовать». Бот начнёт работать в подключённых каналах по вашему сценарию. Изменения публикуются той же кнопкой.",
    link: { href: "/dashboard/scenarios", label: "Опубликовать" },
  },
  {
    n: 6,
    title: "Следите за результатами",
    body: "Раздел «Статистика» покажет метки событий и график по дням. «Пользователи» — кто написал боту и что о них известно. «Рассылки» — массовые сообщения по базе.",
    link: { href: "/dashboard/stats", label: "К статистике" },
  },
];

const SECTIONS = [
  { icon: "🤖", name: "BotPilot AI", href: "/dashboard/bots", desc: "Создание ботов, инструкция, обучение, каналы и баланс." },
  { icon: "🔀", name: "Сценарии", href: "/dashboard/scenarios", desc: "Визуальный конструктор диалогов и сборка через ИИ." },
  { icon: "☁️", name: "Nocode Cloud", href: "/dashboard/nocode", desc: "Готовые облачные модули без кода." },
  { icon: "📨", name: "Рассылки", href: "/dashboard/mailings", desc: "Массовые сообщения по сегментам аудитории." },
  { icon: "💬", name: "Чаты", href: "/dashboard/chats", desc: "Живые диалоги с пользователями." },
  { icon: "👥", name: "Пользователи", href: "/dashboard/users", desc: "База контактов и их переменные." },
  { icon: "🛍️", name: "Магазины", href: "/dashboard/shops", desc: "Товары и приём платежей в боте." },
  { icon: "📊", name: "Статистика", href: "/dashboard/stats", desc: "Метки событий и графики по дням." },
  { icon: "🔌", name: "Интеграции", href: "/dashboard/integrations", desc: "Платёжные системы, CRM, Google Таблицы." },
  { icon: "📡", name: "Каналы", href: "/dashboard/channels", desc: "Подключение бота к Telegram, VK, WhatsApp, Instagram и др." },
  { icon: "🎯", name: "Парсер пользователей", href: "/dashboard/user-parser", desc: "Сбор базы аудитории из открытых Telegram-чатов с фильтрами." },
];

const BLOCKS = [
  { g: "События", items: [
    ["▶ Старт", "Начало диалога — команда /start или первое сообщение."],
    ["💬 Комментарий", "Срабатывает на новый комментарий под постом."],
    ["✉ Сообщение", "Триггер по фразе пользователя (равно / похоже / содержит)."],
  ]},
  { g: "Действия", items: [
    ["➤ Ответ", "Отправить сообщение, добавить кнопки и ветвление."],
    ["✔ Обработать", "Сохранить ответ в переменную с проверкой формата (телефон, email)."],
    ["{x} Переменная", "Установить или изменить значение (можно с арифметикой)."],
    ["🔔 Уведомление", "Внутреннее уведомление о событии."],
    ["🧑 Менеджеру", "Отправить заявку менеджеру в чат/канал."],
    ["📗 Google Табл.", "Добавить строку в Google Таблицу."],
    ["📈 Статистика", "Записать метку события в статистику."],
    ["🎲 Рандом", "Случайная ветка по заданным процентам."],
    ["🤖 BotPilot AI", "Передать диалог AI-боту (ответ по базе знаний)."],
  ]},
  { g: "Логика", items: [
    ["🔒 Подписка", "Проверка подписки на канал: два выхода — подписан / нет."],
    ["◈ Условие", "Ветвление по значению (равно, больше, меньше, содержит)."],
  ]},
];

const AI_EXAMPLES = [
  "бот, который собирает заявки на вебинар и пишет менеджеру",
  "бот отвечает на частые вопросы по базе знаний",
  "тест из 3 вопросов с подсчётом баллов",
  "выдаёт лид-магнит за подписку на канал",
];

const RECIPES = [
  ["📝 Сбор заявок", "Спрашивает контакт, проверяет формат, шлёт менеджеру и в Google Таблицу."],
  ["🎓 Запись на вебинар", "Регистрация, сохранение в таблицу, напоминания."],
  ["❓ Ответы на вопросы", "Бот отвечает на частые вопросы автоматически."],
  ["🎁 Лид-магнит за подписку", "Проверяет подписку и выдаёт бонус."],
  ["🧮 Тест с баллами", "Вопросы с кнопками и подсчётом результата."],
  ["💬 Игра в комментариях", "Реагирует на комментарии под постом."],
];

export default function DocsClient() {
  const [active, setActive] = useState("intro");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    TOC.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <Topbar crumbs={["Основной проект", "Документация"]} />
      <div className="content">
        <div className="docs-wrap">
          <aside className="docs-toc">
            <div className="docs-toc__title">Содержание</div>
            {TOC.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className={`docs-toc__link${active === t.id ? " active" : ""}`}
              >
                {t.label}
              </a>
            ))}
          </aside>

          <div className="docs-main">
            <section id="intro" className="docs-section">
              <h1 className="h1" style={{ marginBottom: 6 }}>С чего начать</h1>
              <p className="muted" style={{ marginTop: 0, maxWidth: 620 }}>
                BotPilot — конструктор чат-ботов для Telegram и соцсетей: живой AI-бот,
                визуальные сценарии, сбор заявок, оплата и рассылки. Пройдите быстрый
                старт за 6 шагов — и первый бот заработает.
              </p>
              <div className="docs-hero">
                <div className="docs-hero__item"><b>1</b> Создаёте бота и подключаете канал</div>
                <div className="docs-hero__item"><b>2</b> Обучаете его отвечать по делу</div>
                <div className="docs-hero__item"><b>3</b> Собираете сценарий — руками или через ИИ</div>
                <div className="docs-hero__item"><b>4</b> Публикуете и принимаете заявки</div>
              </div>
            </section>

            <section id="quickstart" className="docs-section">
              <div className="section-title">Быстрый старт</div>
              <div className="docs-steps">
                {STEPS.map((s) => (
                  <div className="docs-step" key={s.n}>
                    <div className="docs-step__num">{s.n}</div>
                    <div className="docs-step__body">
                      <div className="docs-step__title">{s.title}</div>
                      <p className="docs-step__text">{s.body}</p>
                      <Link href={s.link.href} className="docs-step__link">
                        {s.link.label} →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="map" className="docs-section">
              <div className="section-title">Разделы кабинета</div>
              <p className="muted" style={{ marginTop: 0 }}>Коротко о том, что где находится.</p>
              <div className="docs-grid">
                {SECTIONS.map((s) => (
                  <Link href={s.href} key={s.name} className="docs-card">
                    <span className="docs-card__ico">{s.icon}</span>
                    <div>
                      <div className="docs-card__name">{s.name}</div>
                      <div className="docs-card__desc">{s.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section id="editor" className="docs-section">
              <div className="section-title">Конструктор сценариев</div>
              <p className="muted" style={{ marginTop: 0, maxWidth: 620 }}>
                Сценарий — это схема из блоков, соединённых стрелками. Блоки берутся
                из палитры сверху; тяните их мышью, соединяйте порты, а кнопка
                <b> «Упорядочить»</b> аккуратно разложит схему сверху вниз.
              </p>
              {BLOCKS.map((grp) => (
                <div key={grp.g} className="docs-blocks">
                  <div className="docs-blocks__group">{grp.g}</div>
                  {grp.items.map(([name, desc]) => (
                    <div className="docs-block-row" key={name}>
                      <span className="docs-block-name">{name}</span>
                      <span className="docs-block-desc">{desc}</span>
                    </div>
                  ))}
                </div>
              ))}
            </section>

            <section id="ai" className="docs-section">
              <div className="section-title">Сборка сценария нейросетью</div>
              <p className="muted" style={{ marginTop: 0, maxWidth: 620 }}>
                В разделе «Сценарии» нажмите <b>«✨ Собрать ИИ»</b> и опишите бота
                простыми словами. Сервис соберёт готовую схему блоков и откроет её в
                редакторе — останется поправить тексты и опубликовать.
              </p>
              <div className="docs-callout">
                Примеры запросов:
                <div className="docs-chips">
                  {AI_EXAMPLES.map((e) => (
                    <span className="docs-chip" key={e}>{e}</span>
                  ))}
                </div>
              </div>
              <p className="muted" style={{ maxWidth: 620 }}>
                С ключом Claude (см. «Подключение и настройка») схему собирает нейросеть.
                Без ключа работает встроенный сборщик по ключевым словам — сервис всегда
                выдаст рабочий черновик.
              </p>
              <Link href="/dashboard/scenarios" className="btn btn-primary" style={{ marginTop: 4, display: "inline-block" }}>
                Открыть сценарии
              </Link>
            </section>

            <section id="recipes" className="docs-section">
              <div className="section-title">Готовые рецепты</div>
              <p className="muted" style={{ marginTop: 0 }}>
                При создании сценария выберите шаблон — он подставит готовую схему,
                которую можно менять под себя.
              </p>
              <div className="docs-grid">
                {RECIPES.map(([name, desc]) => (
                  <div className="docs-card" key={name}>
                    <span className="docs-card__ico">{name.split(" ")[0]}</span>
                    <div>
                      <div className="docs-card__name">{name.replace(/^\S+\s/, "")}</div>
                      <div className="docs-card__desc">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="payments" className="docs-section">
              <div className="section-title">Приём оплаты и интеграции</div>
              <p className="muted" style={{ marginTop: 0, maxWidth: 640 }}>
                Оплата подключается в разделе <b>«Интеграции»</b>. Нажмите «Подключить» у
                нужного сервиса и введите ключи из его личного кабинета — в окне есть
                пошаговая подсказка. После подключения появится галочка «✓ подключено»,
                и в сценарии можно добавлять кнопку оплаты.
              </p>
              {PAY_STEPS.map((p) => (
                <div key={p.name} style={{ marginBottom: 14 }}>
                  <div className="docs-sub">{p.emoji} {p.name}</div>
                  <ol className="docs-oli">
                    {p.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              ))}
              <div className="docs-callout">
                Не подключается платёжка? Проверьте: 1) заполнены оба поля (id и секретный
                ключ), 2) ключ боевой (live), а не тестовый, 3) в поле не попал лишний
                пробел. После «Сохранить и подключить» карточка станет зелёной.
              </div>
              <Link href="/dashboard/integrations" className="btn btn-primary" style={{ display: "inline-block" }}>
                Открыть интеграции
              </Link>
            </section>

            <section id="channels" className="docs-section">
              <div className="section-title">Каналы</div>
              <p className="muted" style={{ marginTop: 0, maxWidth: 640 }}>
                Раздел <b>«Каналы»</b> подключает бота к мессенджерам и соцсетям — не только
                к Telegram. Слева выбираете платформу, вводите токен/ключ, справа появляется
                подключённый канал, которому можно назначить сценарий.
              </p>
              <div className="docs-sub">Способы подключения</div>
              <ol className="docs-oli">
                <li><b>Напрямую</b>: Telegram, ВКонтакте, WhatsApp, Одноклассники, Viber, Avito, Веб-виджет.</li>
                <li><b>Через JivoChat</b>: Telegram, ВКонтакте, Viber, WhatsApp, Instagram, Avito, Facebook, Одноклассники.</li>
                <li><b>Через Wazzup24</b>: WhatsApp (API и обычный), Instagram, Telegram, Avito.</li>
              </ol>
              <p className="docs-p">
                Для Telegram — токен бота от @BotFather; для ВКонтакте — ключ доступа
                сообщества; для коннекторов (JivoChat / Wazzup24) — их API-ключ. У каждого
                канала в списке есть выбор сценария и кнопка «открыть».
              </p>
              <Link href="/dashboard/channels" className="btn btn-primary" style={{ display: "inline-block" }}>
                Открыть «Каналы»
              </Link>
            </section>

            <section id="parser" className="docs-section">
              <div className="section-title">Парсер пользователей</div>
              <p className="muted" style={{ marginTop: 0, maxWidth: 640 }}>
                Раздел <b>«Парсер пользователей»</b> собирает базу аудитории из открытых
                Telegram-чатов: участники с фильтрами по профилю и активности, экспорт в
                CSV / JSON.
              </p>
              <div className="docs-sub">Как пользоваться</div>
              <ol className="docs-oli">
                <li>Войдите по Telegram-аккаунту: api_id и api_hash с <b>my.telegram.org</b> → API development tools, затем телефон → код (и пароль 2FA, если включён).</li>
                <li>Вставьте ссылки на чаты/@username — по одному в строке.</li>
                <li>Задайте лимит участников и фильтры: пропустить ботов / удалённых, только с юзернеймом / фото / Premium.</li>
                <li>«🚀 Запустить парсинг» — соберётся список пользователей. Скопируйте ссылки или выгрузите в CSV / JSON.</li>
              </ol>
              <div className="docs-callout">
                Ограничения: парсинг участников работает только для чатов с <b>открытым</b>
                списком участников. Если список скрыт админом — собрать аудиторию нельзя.
                Вход даёт полный доступ к аккаунту (сессия хранится в браузере). Соблюдайте
                правила Telegram и законы о персональных данных — парсите ответственно.
              </div>
              <Link href="/dashboard/user-parser" className="btn btn-ai" style={{ display: "inline-block" }}>
                Открыть «Парсер пользователей»
              </Link>
            </section>

            <section id="settings" className="docs-section">
              <div className="section-title">Подключение и настройка</div>

              <div className="docs-sub">Токен бота (Telegram)</div>
              <p className="docs-p">
                Откройте <b>@BotFather</b> в Telegram → <code>/newbot</code> → задайте имя.
                Скопируйте выданный токен и вставьте на вкладке «Каналы» вашего бота.
              </p>

              <div className="docs-sub">Ключ нейросети (для AI-ответов и сборки ИИ)</div>
              <p className="docs-p">
                Чтобы бот отвечал через Claude и собирал сценарии нейросетью, задайте
                переменную окружения <code>ANTHROPIC_API_KEY</code>. Без неё сервис
                работает во встроенном режиме (заглушки и сборка по ключевым словам).
              </p>
              <pre className="docs-code">{`ANTHROPIC_API_KEY=sk-ant-...
# необязательно:
ANTHROPIC_MODEL=claude-haiku-4-5-20251001`}</pre>

              <div className="docs-sub">Свой сервер</div>
              <p className="docs-p">
                Сервис разворачивается в Docker. Автодеплой настроен: после коммита в
                рабочую ветку GitHub Actions собирает образ и перезапускает контейнер
                на сервере. Секреты (доступ к серверу и <code>ANTHROPIC_API_KEY</code>)
                хранятся в GitHub → Settings → Secrets. Подробности — в файле
                <b> DEPLOY.md</b> репозитория.
              </p>
              <pre className="docs-code">{`# локальный запуск
npm install
npm run dev        # http://localhost:3000

# продакшн
npm run build
npm run start`}</pre>
            </section>

            <section id="faq" className="docs-section">
              <div className="section-title">Частые вопросы</div>
              <div className="docs-faq">
                <details className="docs-q">
                  <summary>С чего начать, если ничего не настроено?</summary>
                  <p>Создайте бота в «BotPilot AI», подключите Telegram-токен, затем соберите первый сценарий (проще всего через «✨ Собрать ИИ») и нажмите «Опубликовать».</p>
                </details>
                <details className="docs-q">
                  <summary>Нужен ли ключ нейросети?</summary>
                  <p>Нет, для старта не обязателен. Без ключа работает встроенный режим. Ключ включает ответы и сборку сценариев через Claude — качество заметно выше.</p>
                </details>
                <details className="docs-q">
                  <summary>Где хранятся данные?</summary>
                  <p>Настройки кабинета, сценарии и справочники в текущей версии хранятся в браузере (localStorage). Для командной работы данные выносятся на сервер.</p>
                </details>
                <details className="docs-q">
                  <summary>Как принимать оплату?</summary>
                  <p>Подключите платёжную систему в «Интеграциях» (ЮKassa, ЮMoney и др.), затем добавьте в сценарий кнопку оплаты или используйте раздел «Магазины».</p>
                </details>
                <details className="docs-q">
                  <summary>Схема выглядит криво — что делать?</summary>
                  <p>Нажмите «Упорядочить» в редакторе — блоки автоматически разложатся сверху вниз, а ветки выровняются симметрично.</p>
                </details>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
