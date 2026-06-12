"use client";

// PATH: packages/shared-logic/src/hooks/useReferralConfig.ts
// Admin-controlled referral settings from appConfig/referralConfig — the
// shared half of the referral brain. Per-user fields (referralCode,
// referralCount, referralCoinsEarned) live on users/{uid}, which both
// platforms already subscribe to via their profile listeners.
//
// NOTE: The interface is named SharedReferralConfig (not ReferralConfig)
// to avoid an export* collision with types/referral.ts in index.ts.
//
// Phase 2 note: mobile hooks/useReferral.ts additionally computes
// nextMilestone — once that file is shared with me, the milestone logic
// moves here so mobile's ReferralCard can switch over without behavior change.

import { useEffect, useState } from "react";
import { doc, getDoc, getFirestore } from "firebase/firestore";

export interface SharedReferralConfig {
  isActive?: boolean;
  referrerCoins?: number;
  refereeCoins?: number;
  giftEnabled?: boolean;
  giftLabel?: string;
  [key: string]: any;
}

export function useReferralConfig() {
  const [config, setConfig] = useState<SharedReferralConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore();
    getDoc(doc(db, "appConfig", "referralConfig"))
      .then((snap) =>
        setConfig(snap.exists() ? (snap.data() as SharedReferralConfig) : null)
      )
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}