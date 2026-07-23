"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconSpark, IconChevron } from "@/components/icons";
import { STYLE_LABELS, AssistantStyle, loadAssistant, saveAssistant } from "@/lib/assistant";
import { uid, upsertScenario, Scenario } from "@/lib/scenarios";

type Goal = { id: string; label: string; emoji: string; desc: string; prepares: string[] };
type Tmpl = { id: string; label: string; emoji: string; result: string };

const GOALS: Goal[] = [
  {
    id: "answer",
    label: "Отвечать клиентам",
    emoji: "💬",
    desc: "Например: отвечает на вопросы о ценах, доставке и графике",
    prepares: ["Приветствие", "Частые вопросы", "Ответы по смыслу", "Передача менеджеру"],
  },
  {
    id: "leads",
    label: "Собирать заявки",
    emoji: "📥",
    desc: "Например: спросит имя и телефон и передаст менеджеру",
    prepares: ["Приветствие", "Сбор имени", "Запрос телефона", "Уведомление менеджеру"],
  },
  {
    id: "sell",
    label: "Продавать товары или услуги",
    emoji: "🛒",
    desc: "Например: покажет товар, ответит на вопросы и оформит оплату",
    prepares: ["Каталог/предложение", "Вопросы клиента", "Оформление", "Оплата"],
  },
  {
    id: "booking",
    label: "Записывать на консультацию",
    emoji: "📅",
    desc: "Например: подберёт время и запишет клиента на приём",
    prepares: ["Выбор услуги", "Выбор времени", "Контакт", "Напоминание"],
  },
  {
    id: "ai",
    label: "Консультировать с помощью ИИ",
    emoji: "🤖",
    desc: "Например: ИИ отвечает на вопросы по вашей базе знаний 24/7",
    prepares: ["Приветствие", "Ответы ИИ", "База знаний", "Передача менеджеру"],
  },
  {
    id: "poll",
    label: "Проводить опросы",
    emoji: "📊",
    desc: "Например: задаст серию вопросов и соберёт ответы",
    prepares: ["Вопросы", "Варианты ответов", "Сохранение результата", "Итог"],
  },
  {
    id: "learn",
    label: "Обучать сотрудников",
    emoji: "🎓",
    desc: "Например: проведёт по материалам и проверит знания тестом",
    prepares: ["Материалы", "Шаги обучения", "Тест", "Результат"],
  },
  {
    id: "other",
    label: "Создать другой сценарий",
    emoji: "✨",
    desc: "Соберём структуру под вашу задачу — опишете её на следующих шагах",
    prepares: ["Приветствие", "Ваши шаги", "Действия", "Завершение"],
  },
];

type Platform = { id: string; label: string; emoji: string; time: string; steps: string[] };

const PLATFORMS: Platform[] = [
  {
    id: "tg",
    label: "Telegram",
    emoji: "✈️",
    time: "≈ 2 минуты",
    steps: [
      "Откройте @BotFather в Telegram",
      "Команда /newbot → задайте имя бота",
      "Скопируйте выданный токен",
      "Вставьте токен в разделе «Каналы»",
    ],
  },
  {
    id: "vk",
    label: "ВКонтакте",
    emoji: "🟦",
    time: "≈ 5 минут",
    steps: [
      "Создайте сообщество ВКонтакте",
      "Управление → Работа с API → создайте ключ доступа",
      "Включите Long Poll API (последняя версия)",
      "Вставьте ключ в разделе «Каналы»",
    ],
  },
  {
    id: "wa",
    label: "WhatsApp",
    emoji: "🟢",
    time: "≈ 10 минут",
    steps: [
      "Понадобится WhatsApp Business API (через провайдера)",
      "Получите номер и токен доступа",
      "Укажите их в разделе «Интеграции»",
      "Подтвердите номер по инструкции провайдера",
    ],
  },
  {
    id: "max",
    label: "MAX",
    emoji: "🟣",
    time: "≈ 3 минуты",
    steps: [
      "Создайте бота в мессенджере MAX",
      "Получите токен бота",
      "Вставьте токен в разделе «Каналы»",
      "Проверьте связь тестовым сообщением",
    ],
  },
  {
    id: "site",
    label: "Сайт",
    emoji: "🌐",
    time: "≈ 2 минуты",
    steps: [
      "Откройте раздел «Каналы» → «Виджет для сайта»",
      "Скопируйте код виджета",
      "Вставьте его перед тегом </body> на сайте",
      "Кнопка чата появится в углу страницы",
    ],
  },
  {
    id: "multi",
    label: "Несколько площадок",
    emoji: "🔗",
    time: "по инструкции каждой",
    steps: [
      "Бот работает во всех каналах одновременно",
      "Подключите каждую площадку по её инструкции",
      "Один сценарий — все мессенджеры сразу",
      "Диалоги и клиенты собираются в одном месте",
    ],
  },
];

const TEMPLATES: Tmpl[] = [
  { id: "lead", label: "Получение заявки", emoji: "📥", result: "Соберёт имя и телефон, передаст менеджеру" },
  { id: "consult", label: "Консультация клиента", emoji: "💡", result: "Ответит на вопросы и уточнит потребность" },
  { id: "product", label: "Продажа товара", emoji: "🛒", result: "Покажет товар и оформит оплату" },
  { id: "booking", label: "Запись на услугу", emoji: "📅", result: "Подберёт время и запишет клиента" },
  { id: "faq", label: "Ответы на частые вопросы", emoji: "❓", result: "Отвечает на типовые вопросы сам" },
  { id: "qualify", label: "Квалификация клиента", emoji: "🎯", result: "Задаст вопросы и оценит заявку" },
  { id: "support", label: "Поддержка клиентов", emoji: "🛟", result: "Примет обращение и заведёт тикет" },
  { id: "order", label: "Оформление заказа", emoji: "📦", result: "Соберёт заказ и данные доставки" },
  { id: "magnet", label: "Выдача бесплатного материала", emoji: "🎁", result: "Проверит подписку и выдаст бонус" },
  { id: "custom", label: "Индивидуальный сценарий", emoji: "✨", result: "Соберём под вашу задачу" },
];

const STEPS = ["Цель", "Площадка", "О бизнесе", "Сценарий", "Ассистент", "Запуск"];

export default function WizardClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [goal, setGoal] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [biz, setBiz] = useState({ name: "", about: "", products: "", clients: "", contacts: "", schedule: "", site: "" });
  const [tmpl, setTmpl] = useState<string>("");
  const [asstName, setAsstName] = useState("Анна");
  const [asstStyle, setAsstStyle] = useState<AssistantStyle>("friendly");
  const [asstKnows, setAsstKnows] = useState(false);

  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [testInput, setTestInput] = useState("");
  const [testLog, setTestLog] = useState<{ me: boolean; text: string }[]>([]);

  const goalObj = GOALS.find((g) => g.id === goal);
  const platObj = PLATFORMS.find((p) => p.id === platform);
  const tmplObj = TEMPLATES.find((t) => t.id === tmpl);

  const canNext =
    (step === 0 && !!goal) ||
    (step === 1 && !!platform) ||
    (step === 2 && biz.name.trim().length > 0) ||
    (step === 3 && !!tmpl) ||
    step === 4 ||
    step === 5;

  function patchBiz(p: Partial<typeof biz>) {
    setBiz((b) => ({ ...b, ...p }));
  }

  function autoInstructions() {
    setAsstKnows(true);
    saveAssistant({
      ...loadAssistant(),
      name: asstName,
      style: asstStyle,
      role:
        `Ты — ${asstName}, ИИ-ассистент компании «${biz.name || "—"}». ` +
        `Общайся ${STYLE_LABELS[asstStyle].toLowerCase()}. ${biz.about ? "О компании: " + biz.about + ". " : ""}` +
        `${biz.products ? "Товары и услуги: " + biz.products + ". " : ""}Помогай клиенту, отвечай на вопросы, ` +
        `предлагай оставить заявку и подсказывай следующий шаг. Не знаешь ответа — предложи связать с менеджером.`,
    });
  }

  function sendTest() {
    const v = testInput.trim();
    if (!v) return;
    const reply =
      `${asstName}: Здравствуйте! ${biz.name ? `Это ${biz.name}. ` : ""}` +
      `Подскажу по вашему вопросу и помогу оставить заявку. Что именно вас интересует?`;
    setTestLog((l) => [...l, { me: true, text: v }, { me: false, text: reply }]);
    setTestInput("");
  }

  function buildPrompt(): string {
    return [
      `Собери сценарий чат-бота.`,
      goalObj && `Цель: ${goalObj.label}.`,
      platObj && `Площадка: ${platObj.label}.`,
      biz.name && `Компания: ${biz.name}.`,
      biz.about && `Чем занимается: ${biz.about}.`,
      biz.products && `Товары/услуги: ${biz.products}.`,
      biz.clients && `Клиенты: ${biz.clients}.`,
      tmplObj && `Тип сценария: ${tmplObj.label} — ${tmplObj.result}.`,
      `Ассистент по имени ${asstName}, стиль общения: ${STYLE_LABELS[asstStyle]}.`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function launch() {
    if (building) return;
    setBuilding(true);
    setError("");
    // Сохраняем ассистента и бриф.
    autoInstructions();
    try {
      localStorage.setItem("sb_bot_brief", JSON.stringify({ goal, platform, biz, tmpl, asstName, asstStyle, at: Date.now() }));
    } catch {}
    try {
      const res = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt() }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.nodes)) throw new Error(data.error || "bad");
      const s: Scenario = {
        id: uid("s"),
        name: biz.name ? `${biz.name} — ${tmplObj?.label || goalObj?.label || "бот"}` : `Бот: ${tmplObj?.label || goalObj?.label || "сценарий"}`,
        allChannels: true,
        published: false,
        nodes: data.nodes,
        edges: data.edges || [],
        updatedAt: Date.now(),
      };
      upsertScenario(s);
      router.push(`/dashboard/scenarios/${s.id}`);
    } catch {
      // Не удалось собрать через ИИ — ведём в раздел сценариев.
      setBuilding(false);
      setError("Не удалось автоматически собрать сценарий. Откройте раздел «Сценарии» и соберите вручную или повторите.");
    }
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Создать бота", "Мастер"]} />
      <div className="content" style={{ maxWidth: 820 }}>
        {/* Прогресс */}
        <div className="wz-progress">
          {STEPS.map((s, i) => (
            <div key={s} className={`wz-step${i === step ? " on" : ""}${i < step ? " done" : ""}`}>
              <span className="wz-step__dot">{i < step ? "✓" : i + 1}</span>
              <span className="wz-step__label">{s}</span>
            </div>
          ))}
        </div>

        {/* Шаг 1 — цель */}
        {step === 0 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Что должен делать бот?</h1>
            <p className="muted wz-sub">Выберите цель — система автоматически подготовит структуру бота.</p>
            <div className="wz-cards wz-cards--goals">
              {GOALS.map((g) => (
                <button key={g.id} className={`wz-card wz-goal${goal === g.id ? " on" : ""}`} onClick={() => setGoal(g.id)} type="button">
                  <span className="wz-card__emoji">{g.emoji}</span>
                  <span className="wz-goal__body">
                    <span className="wz-card__label">{g.label}</span>
                    <span className="wz-goal__desc">{g.desc}</span>
                  </span>
                  {goal === g.id && <span className="wz-goal__check">✓</span>}
                </button>
              ))}
            </div>

            {goalObj ? (
              <div className="wz-prepare">
                <div className="wz-prepare__head">
                  <span className="wz-prepare__ico"><IconSpark className="ico" /></span>
                  Система подготовит структуру для «{goalObj.label}»:
                </div>
                <div className="wz-prepare__flow">
                  {goalObj.prepares.map((p, i) => (
                    <span key={i} className="wz-prepare__step">
                      {p}
                      {i < goalObj.prepares.length - 1 && <span className="wz-prepare__arr">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="wz-hint">💡 Подсказка: выберите задачу, а система автоматически подготовит структуру бота.</div>
            )}
          </div>
        )}

        {/* Шаг 2 — площадка */}
        {step === 1 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Где будет работать бот?</h1>
            <p className="muted wz-sub">Выберите площадку — покажем простую инструкцию подключения.</p>
            <div className="wz-cards">
              {PLATFORMS.map((p) => (
                <button key={p.id} className={`wz-card${platform === p.id ? " on" : ""}`} onClick={() => setPlatform(p.id)} type="button">
                  <span className="wz-card__emoji">{p.emoji}</span>
                  <span className="wz-card__label">{p.label}</span>
                </button>
              ))}
            </div>

            {platObj ? (
              <div className="wz-connect">
                <div className="wz-connect__head">
                  <span className="wz-connect__emoji">{platObj.emoji}</span>
                  <span>Как подключить «{platObj.label}»</span>
                  <span className="wz-connect__time">{platObj.time}</span>
                </div>
                <ol className="wz-connect__steps">
                  {platObj.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <div className="wz-connect__note">Подключение можно завершить после создания — в разделе «Каналы».</div>
              </div>
            ) : (
              <div className="wz-hint">💡 Подсказка: выберите площадку — покажем пошаговую инструкцию подключения.</div>
            )}
          </div>
        )}

        {/* Шаг 3 — о бизнесе */}
        {step === 2 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Расскажите о бизнесе</h1>
            <p className="muted wz-sub">Чем подробнее — тем точнее бот и ассистент. Обязательно только название.</p>
            <div className="wz-form">
              <div className="field">
                <label className="label">Название компании *</label>
                <input className="input" value={biz.name} onChange={(e) => patchBiz({ name: e.target.value })} placeholder="Например: Студия «Ромашка»" autoFocus />
              </div>
              <div className="wz-form__row">
                <div className="field">
                  <label className="label">Чем занимается</label>
                  <input className="input" value={biz.about} onChange={(e) => patchBiz({ about: e.target.value })} placeholder="Маникюр и уход" />
                </div>
                <div className="field">
                  <label className="label">Товары или услуги</label>
                  <input className="input" value={biz.products} onChange={(e) => patchBiz({ products: e.target.value })} placeholder="Маникюр, педикюр, наращивание" />
                </div>
              </div>
              <div className="wz-form__row">
                <div className="field">
                  <label className="label">Кто клиенты</label>
                  <input className="input" value={biz.clients} onChange={(e) => patchBiz({ clients: e.target.value })} placeholder="Женщины 25–45, район центра" />
                </div>
                <div className="field">
                  <label className="label">График работы</label>
                  <input className="input" value={biz.schedule} onChange={(e) => patchBiz({ schedule: e.target.value })} placeholder="Пн–Сб 10:00–20:00" />
                </div>
              </div>
              <div className="wz-form__row">
                <div className="field">
                  <label className="label">Контакты</label>
                  <input className="input" value={biz.contacts} onChange={(e) => patchBiz({ contacts: e.target.value })} placeholder="+7 900 000-00-00" />
                </div>
                <div className="field">
                  <label className="label">Сайт или соцсети</label>
                  <input className="input" value={biz.site} onChange={(e) => patchBiz({ site: e.target.value })} placeholder="https://…" />
                </div>
              </div>
              <div className="hint">
                💡 На сервере ИИ может проанализировать сайт из поля выше и заполнить описание сам — укажите ссылку.
              </div>
            </div>
          </div>
        )}

        {/* Шаг 4 — сценарий */}
        {step === 3 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Выберите готовый сценарий</h1>
            <p className="muted wz-sub">Его можно доработать в редакторе после создания.</p>
            <div className="wz-tmpls">
              {TEMPLATES.map((t) => (
                <button key={t.id} className={`wz-tmpl${tmpl === t.id ? " on" : ""}`} onClick={() => setTmpl(t.id)} type="button">
                  <span className="wz-tmpl__emoji">{t.emoji}</span>
                  <span>
                    <span className="wz-tmpl__label">{t.label}</span>
                    <span className="wz-tmpl__res">{t.result}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Шаг 5 — ассистент */}
        {step === 4 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Настройте ИИ-ассистента</h1>
            <p className="muted wz-sub">Как его зовут и как он общается. Инструкции создадутся автоматически.</p>
            <div className="wz-form">
              <div className="wz-form__row">
                <div className="field">
                  <label className="label">Как зовут ассистента?</label>
                  <input className="input" value={asstName} onChange={(e) => setAsstName(e.target.value)} placeholder="Анна, Алекс, SmartBot" />
                </div>
                <div className="field">
                  <label className="label">Как он должен общаться?</label>
                  <select className="select" value={asstStyle} onChange={(e) => setAsstStyle(e.target.value as AssistantStyle)}>
                    {(Object.keys(STYLE_LABELS) as AssistantStyle[]).map((s) => (
                      <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn btn-ai" onClick={autoInstructions} type="button">
                <IconSpark className="ico" /> Создать инструкции автоматически
              </button>
              {asstKnows && <div className="hint" style={{ color: "var(--green)" }}>✓ Инструкции и роль ассистента подготовлены.</div>}
            </div>
          </div>
        )}

        {/* Шаг 6 — проверка и запуск */}
        {step === 5 && (
          <div className="wz-panel">
            <h1 className="h1 wz-h1">Проверьте и запустите</h1>
            <p className="muted wz-sub">Готово к запуску. Проверьте параметры и отправьте тестовое сообщение.</p>

            <div className="wz-summary">
              <div className="wz-sum"><span>Задача</span><b>{goalObj?.label || "—"}</b></div>
              <div className="wz-sum"><span>Площадка</span><b>{platObj?.label || "—"}</b></div>
              <div className="wz-sum"><span>Компания</span><b>{biz.name || "—"}</b></div>
              <div className="wz-sum"><span>Сценарий</span><b>{tmplObj?.label || "—"}</b></div>
              <div className="wz-sum"><span>Ассистент</span><b>{asstName} · {STYLE_LABELS[asstStyle]}</b></div>
            </div>

            <div className="wz-preview">
              <div className="wz-preview__head">🤖 Предпросмотр диалога</div>
              <div className="wz-preview__body">
                {testLog.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Напишите сообщение, чтобы увидеть ответ бота.</div>}
                {testLog.map((m, i) => (
                  <div key={i} className={`wz-msg${m.me ? " me" : ""}`}>{m.text}</div>
                ))}
              </div>
              <div className="wz-preview__input">
                <input className="input" value={testInput} onChange={(e) => setTestInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTest()} placeholder="Тестовое сообщение…" />
                <button className="btn" onClick={sendTest} type="button">Отправить</button>
              </div>
            </div>

            <div className="wz-actions">
              <Link href="/dashboard/assistant" className="wz-act">✏️ Исправить ответы</Link>
              <Link href="/dashboard/billing" className="wz-act">🎨 Изменить оформление</Link>
              <Link href="/dashboard/scenarios" className="wz-act">➕ Добавить сценарий</Link>
              <Link href="/dashboard/team" className="wz-act">👤 Подключить менеджера</Link>
            </div>

            {error && <div className="hint" style={{ color: "#ef4444" }}>{error}</div>}
          </div>
        )}

        {/* Навигация */}
        <div className="wz-nav">
          {step > 0 ? (
            <button className="btn" onClick={() => setStep((s) => s - 1)} disabled={building}>← Назад</button>
          ) : (
            <Link href="/dashboard/create" className="btn">← Отмена</Link>
          )}
          <div style={{ flex: 1 }} />
          {step < 5 ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Далее →
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={launch} disabled={building}>
              {building ? "Собираем бота…" : "🚀 Запустить бота"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
