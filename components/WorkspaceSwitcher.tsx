"use client";

import { useEffect, useRef, useState } from "react";

type Workspace = { company: string; subdomain: string };

export default function WorkspaceSwitcher() {
  const [ws, setWs] = useState<Workspace>({
    company: "Основной кабинет",
    subdomain: "cabinet",
  });
  const [openCab, setOpenCab] = useState(false);
  const [openProj, setOpenProj] = useState(false);
  const [project, setProject] = useState("Основной проект");
  const [projects, setProjects] = useState(["Основной проект"]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sb_workspace");
      if (raw) setWs(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenCab(false);
        setOpenProj(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function addProject() {
    const name = prompt("Название нового проекта");
    if (name && name.trim()) {
      const p = name.trim();
      setProjects((arr) => [...arr, p]);
      setProject(p);
      setOpenProj(false);
    }
  }

  return (
    <div className="ws" ref={ref}>
      <button className="ws__btn" onClick={() => { setOpenCab((v) => !v); setOpenProj(false); }}>
        <span className="home">⌂</span>
        {ws.company}
        <span className="ws__caret">▾</span>
      </button>
      {openCab && (
        <div className="ws__menu">
          <div className="ws__item" style={{ color: "var(--violet-600)" }}>
            {ws.company} <span>✓</span>
          </div>
          <div className="ws__item add" onClick={() => alert("Демо: создание нового кабинета")}>
            + Добавить кабинет
          </div>
        </div>
      )}

      <span className="crumbs sep">›</span>

      <button className="ws__btn" onClick={() => { setOpenProj((v) => !v); setOpenCab(false); }}>
        {project}
        <span className="ws__caret">▾</span>
      </button>
      {openProj && (
        <div className="ws__menu" style={{ left: "auto" }}>
          {projects.map((p) => (
            <div
              key={p}
              className="ws__item"
              onClick={() => { setProject(p); setOpenProj(false); }}
            >
              {p} {p === project && <span>✓</span>}
            </div>
          ))}
          <div className="ws__item add" onClick={addProject}>
            + Создать проект
          </div>
        </div>
      )}
    </div>
  );
}
