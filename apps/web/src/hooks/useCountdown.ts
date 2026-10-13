"use client";

// PATH: apps/web/src/hooks/useCountdown.ts
// Live-ticking countdown to a target timestamp — updates every second via
// setInterval, same pattern as contest/quiz/page.tsx's per-question timer.
//
// Takes a plain epoch-ms number (not a Date) so the effect's dependency is
// stable across re-renders — a fresh `new Date(...)` is never referentially
// equal to the last one, which would otherwise restart the interval (and
// visibly stutter the countdown) on every parent re-render.

import { useEffect, useState } from "react";

export function useCountdown(targetMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs == null) return null;
  return Math.max(0, targetMs - now);
}

// "2d 5h", "5h 12m", "12m 34s", "34s" — coarsens to the two most significant
// units once you're a day+ out, and drops to seconds only in the final minute.
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// "1d 4h 32m", "0d 6h 05m" — always shows days/hours/minutes together
// (never collapses), for the "starting within 2 days" countdown badge where
// seeing the day count matters even once it's down to single-digit hours.
export function formatCountdownDHM(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const d = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = totalMinutes % 60;
  return `${d}d ${h}h ${String(m).padStart(2, "0")}m`;
}
