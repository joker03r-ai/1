import { IconGlobe, IconGear, IconChevron } from "./icons";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

export default function Topbar({ crumbs }: { crumbs: string[] }) {
  // Первый элемент («Основной проект») отдаём переключателю кабинета/проекта,
  // остальные показываем как путь до текущей страницы.
  const rest = crumbs.slice(1);
  return (
    <header className="topbar">
      <WorkspaceSwitcher />
      {rest.length > 0 && (
        <div className="crumbs">
          {rest.map((c, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconChevron className="ico sep" />
              {i === rest.length - 1 ? <b>{c}</b> : <span>{c}</span>}
            </span>
          ))}
        </div>
      )}
      <div className="topbar__spacer" />
      <span className="trial-badge">🎁 Пробный период · 7 дней</span>
      <span className="balance-pill">0 ₽</span>
      <IconGlobe className="ico" />
      <IconGear className="ico" />
    </header>
  );
}
