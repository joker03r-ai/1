import { IconChevron } from "./icons";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import SettingsButton from "./SettingsButton";
import LangSwitcher from "./LangSwitcher";
import TrialBadge from "./TrialBadge";

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
      <TrialBadge />
      <span className="balance-pill">0 ₽</span>
      <LangSwitcher />
      <SettingsButton />
    </header>
  );
}
