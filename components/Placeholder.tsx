import Topbar from "./Topbar";

export default function Placeholder({
  title,
  crumbs,
}: {
  title: string;
  crumbs: string[];
}) {
  return (
    <>
      <Topbar crumbs={crumbs} />
      <div className="content">
        <h1 className="h1">{title}</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Этот раздел — часть каркаса кабинета. В текущей версии реализованы
          «Smartbot AI» (обучение бота, каналы, баланс) и живой AI-чат. Остальные
          разделы подключим на следующих итерациях.
        </p>
      </div>
    </>
  );
}
