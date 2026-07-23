"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trialDaysLeft, daysWord, TRIAL_DAYS } from "@/lib/trial";

export default function TrialBadge() {
  const [days, setDays] = useState(TRIAL_DAYS);
  useEffect(() => {
    setDays(trialDaysLeft());
  }, []);

  return (
    <Link href="/dashboard/billing" className={`trial-badge${days === 0 ? " ended" : ""}`}>
      🎁 {days > 0 ? `Пробный период · ${days} ${daysWord(days)}` : "Оформить тариф"}
    </Link>
  );
}
