// PATH: apps/web/src/hooks/useAdFrequency.ts
// Port of mobile's hooks/useAdFrequency.ts. Same session-cap + cooldown
// logic; AsyncStorage (mobile) is swapped for localStorage (web), guarded
// against SSR since `window`/`localStorage` don't exist during Next.js's
// server render pass.

import { useCallback, useEffect, useRef, useState } from "react";
import { AD_FREQUENCY, STORAGE_KEYS } from "@/lib/ads/constants";

interface UseAdFrequencyResult {
  canShowAd: () => boolean;
  recordAdShown: (adId: string) => void;
  sessionCount: number;
  resetSession: () => void;
}

const isBrowser = typeof window !== "undefined";

export function useAdFrequency(): UseAdFrequencyResult {
  const [sessionCount, setSessionCount] = useState(0);
  const lastShownAtRef = useRef<number>(0);
  const isInitialized  = useRef(false);

  useEffect(() => {
    if (!isBrowser) return;
    // Restore session count from storage (persists within same tab session)
    const countVal = window.localStorage.getItem(STORAGE_KEYS.sessionAdCount);
    const count = parseInt(countVal ?? "0", 10);
    setSessionCount(isNaN(count) ? 0 : count);

    const lastShownVal = window.localStorage.getItem(STORAGE_KEYS.lastAdShownAt);
    lastShownAtRef.current = parseInt(lastShownVal ?? "0", 10);

    isInitialized.current = true;
  }, []);

  const canShowAd = useCallback((): boolean => {
    // Hard cap: max ads per session
    if (sessionCount >= AD_FREQUENCY.maxPerSession) return false;
    // Cooldown: enforce minimum time gap between ads (~30s based on 6-item feed)
    const now = Date.now();
    const secondsSinceLastAd = (now - lastShownAtRef.current) / 1000;
    if (lastShownAtRef.current > 0 && secondsSinceLastAd < 10) return false;
    return true;
  }, [sessionCount]);

  const recordAdShown = useCallback((_adId: string) => {
    const now = Date.now();
    lastShownAtRef.current = now;
    setSessionCount((prev) => {
      const next = prev + 1;
      if (isBrowser) window.localStorage.setItem(STORAGE_KEYS.sessionAdCount, String(next));
      return next;
    });
    if (isBrowser) window.localStorage.setItem(STORAGE_KEYS.lastAdShownAt, String(now));
  }, []);

  const resetSession = useCallback(() => {
    setSessionCount(0);
    lastShownAtRef.current = 0;
    if (isBrowser) {
      window.localStorage.removeItem(STORAGE_KEYS.sessionAdCount);
      window.localStorage.removeItem(STORAGE_KEYS.lastAdShownAt);
    }
  }, []);

  return { canShowAd, recordAdShown, sessionCount, resetSession };
}
