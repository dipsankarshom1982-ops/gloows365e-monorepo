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
    } catch (e: any) {
      const msg = e?.message ?? "Reward claim failed";
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
