// PATH: apps/web/src/hooks/useRewardedAd.ts
// Direct port of mobile's hooks/useRewardedAd.ts — pure React logic, no
// platform-specific APIs.
//
// NOTE: as of this port, mobile defines this hook (and RewardedAdModal)
// but doesn't actually render/consume them from any screen yet — the
// rewarded-ad-for-V-Coins loop is fully built end-to-end (this hook, the
// modal component, and the claimAdReward Cloud Function with its daily
// cap) but not yet surfaced to users on either platform. Porting it here
// for parity; wiring it into an actual screen is a separate product
// decision, not a bug fix.

import { useCallback, useEffect, useState } from "react";
import { claimReward, getAdsForModule, recordWatchComplete } from "@/services/adService";
import type { Ad } from "@/lib/ads/types";

interface UseRewardedAdResult {
  rewardedAd: Ad | null;
  loading: boolean;
  isVisible: boolean;
  showRewardedAd: () => void;
  hideRewardedAd: () => void;
  onWatchComplete: () => Promise<{ coins: number; message: string } | null>;
  lastReward: { coins: number; message: string } | null;
}

export function useRewardedAd(module: string, classLevel = "all"): UseRewardedAdResult {
  const [rewardedAd, setRewardedAd] = useState<Ad | null>(null);
  const [loading, setLoading]       = useState(true);
  const [isVisible, setIsVisible]   = useState(false);
  const [lastReward, setLastReward] = useState<{ coins: number; message: string } | null>(null);

  useEffect(() => {
    getAdsForModule(module, classLevel, "rewarded", 1).then((ads) => {
      setRewardedAd(ads[0] ?? null);
      setLoading(false);
    });
  }, [module, classLevel]);

  const showRewardedAd = useCallback(() => {
    if (rewardedAd) setIsVisible(true);
  }, [rewardedAd]);

  const hideRewardedAd = useCallback(() => {
    setIsVisible(false);
  }, []);

  const onWatchComplete = useCallback(async () => {
    if (!rewardedAd) return null;
    try {
      await recordWatchComplete(rewardedAd.id, module);
      const result = await claimReward(rewardedAd.id);
      setLastReward(result);
      return result;
    } catch {
      return null;
    }
  }, [rewardedAd, module]);

  return {
    rewardedAd,
    loading,
    isVisible,
    showRewardedAd,
    hideRewardedAd,
    onWatchComplete,
    lastReward,
  };
}
