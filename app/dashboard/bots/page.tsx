import Link from "next/link";
import Topbar from "@/components/Topbar";
import { IconPlus, IconBot } from "@/components/icons";

export default function BotsListPage() {
  return (
    <>
      <Topbar crumbs={["Основной проект", "Smartbot AI"]} />
      <div className="content">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>
              Список AI-ботов
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              Обучите бота на данных компании, подключите каналы и отвечайте клиентам
              24/7.
            </p>
          </div>
          <Link href="/dashboard/bots/1" className="btn btn-primary">
            <IconPlus className="ico" /> Создать AI бота
          </Link>
        </div>

        <Link href="/dashboard/bots/1" className="card" style={cardStyle}>
          <div className="bot-avatar" style={{ width: 44, height: 44, fontSize: 20 }}>
            🤖
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Smartbot AI</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Модель: ChatGPT 4o mini · Цель: Проконсультировать
            </div>
          </div>
          <span className="badge badge-new">активен</span>
        </Link>
      </div>
    </>
  );
}

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 16,
  maxWidth: 620,
  cursor: "pointer",
};
