import { IconGlobe, IconGear, IconChevron } from "./icons";

export default function Topbar({ crumbs }: { crumbs: string[] }) {
  return (
    <header className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
            {i < crumbs.length - 1 && <IconChevron className="ico sep" />}
          </span>
        ))}
      </div>
      <div className="topbar__spacer" />
      <div className="balance-pill">0 ₽</div>
      <IconGlobe className="ico" />
      <IconGear className="ico" />
    </header>
  );
}
