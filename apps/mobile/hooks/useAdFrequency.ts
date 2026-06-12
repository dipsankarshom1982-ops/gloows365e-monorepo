import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AD_FREQUENCY, STORAGE_KEYS } from "@/lib/ads/constants";

interface UseAdFrequencyResult {
  canShowAd: () => boolean;
  recordAdShown: (adId: string) => void;
  sessionCount: number;
  resetSession: () => void;
}

export function useAdFrequency(): UseAdFrequencyResult {
  const [sessionCount, setSessionCount] = useState(0);
  const lastShownAtRef = useRef<number>(0);
  const isInitialized  = useRef(false);

  useEffect(() => {
    // Restore session count from storage (persists within same day session)
    AsyncStorage.getItem(STORAGE_KEYS.sessionAdCount).then((val) => {
      const count = parseInt(val ?? "0", 10);
      setSessionCount(isNaN(count) ? 0 : count);
    });
    AsyncStorage.getItem(STORAGE_KEYS.lastAdShownAt).then((val) => {
      lastShownAtRef.current = parseInt(val ?? "0", 10);
    });
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

  const recordAdShown = useCallback((adId: string) => {
    const now = Date.now();
    lastShownAtRef.current = now;
    setSessionCount((prev) => {
      const next = prev + 1;
      AsyncStorage.setItem(STORAGE_KEYS.sessionAdCount, String(next));
      return next;
    });
    AsyncStorage.setItem(STORAGE_KEYS.lastAdShownAt, String(now));
  }, []);

  const resetSession = useCallback(() => {
    setSessionCount(0);
    lastShownAtRef.current = 0;
    AsyncStorage.removeItem(STORAGE_KEYS.sessionAdCount);
    AsyncStorage.removeItem(STORAGE_KEYS.lastAdShownAt);
  }, []);

  return { canShowAd, recordAdShown, sessionCount, resetSession };
}
