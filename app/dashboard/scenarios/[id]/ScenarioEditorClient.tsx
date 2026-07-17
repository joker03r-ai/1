"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import FlowEditor from "@/components/FlowEditor";
import { Scenario, getScenario } from "@/lib/scenarios";

export default function ScenarioEditorClient() {
  const params = useParams();
  const id = String(params.id);
  const [scenario, setScenario] = useState<Scenario | null | undefined>(undefined);

  useEffect(() => {
    setScenario(getScenario(id) ?? null);
  }, [id]);

  if (scenario === undefined) {
    return (
      <>
        <Topbar crumbs={["Основной проект", "Сценарии", "…"]} />
        <div className="content muted">Загрузка…</div>
      </>
    );
  }

  if (scenario === null) {
    return (
      <>
        <Topbar crumbs={["Основной проект", "Сценарии", "Не найден"]} />
        <div className="content">
          <p className="muted">Сценарий не найден.</p>
          <Link className="btn btn-primary" href="/dashboard/scenarios">
            ← К списку сценариев
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Сценарии", scenario.name]} />
      <FlowEditor initial={scenario} />
    </>
  );
}
