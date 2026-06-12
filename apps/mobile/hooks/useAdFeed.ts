import { useCallback, useEffect, useRef, useState } from "react";
import { getAdsForModule } from "@/services/adService";
import type { Ad, AdType } from "@/lib/ads/types";

interface UseAdFeedOptions {
  module: string;
  classLevel?: string;
  adType?: AdType;
  limit?: number;
}

interface UseAdFeedResult {
  ads: Ad[];
  currentAd: Ad | null;
  nextAd: () => void;
  loading: boolean;
  reload: () => void;
}

export function useAdFeed({
  module,
  classLevel = "all",
  adType,
  limit = 5,
}: UseAdFeedOptions): UseAdFeedResult {
  const [ads, setAds]       = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const indexRef            = useRef(0);
  const [currentAd, setCurrentAd] = useState<Ad | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const fetched = await getAdsForModule(module, classLevel, adType, limit);
    setAds(fetched);
    setCurrentAd(fetched[0] ?? null);
    indexRef.current = 0;
    setLoading(false);
  }, [module, classLevel, adType, limit]);

  useEffect(() => { load(); }, [load]);

  const nextAd = useCallback(() => {
    if (ads.length === 0) return;
    indexRef.current = (indexRef.current + 1) % ads.length;
    setCurrentAd(ads[indexRef.current]);
  }, [ads]);

  return { ads, currentAd, nextAd, loading, reload: load };
}
