"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trialDaysLeft, daysWord, TRIAL_DAYS } from "@/lib/trial";

export default function TrialBadge() {
  const [days, setDays] = useState(TRIAL_DAYS);
  useEffect(() => {
    setDays(trialDaysLeft());
  }, []);

  if (days === 0) {
    return (
      <Link href="/dashboard/billing" className="trial-badge ended" title="Выбрать тариф">
        <svg viewBox="0 0 24 24" className="trial-badge__spark" aria-hidden><path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5 10.1 10.9 4.5 9l5.6-1.4L12 2z" fill="currentColor" /></svg>
        Оформить тариф
      </Link>
    );
  }
  const low = days <= 2;
  return (
    <Link href="/dashboard/billing" className={`trial-badge${low ? " low" : ""}`} title="Пробный период — открыть тарифы">
      <span className="trial-badge__ico" aria-hidden>
        <svg viewBox="0 0 24 24"><path d="M12 8v4l2.5 1.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span className="trial-badge__label">Пробный период</span>
      <span className="trial-badge__days">{days} {daysWord(days)}</span>
    </Link>
  );
}
