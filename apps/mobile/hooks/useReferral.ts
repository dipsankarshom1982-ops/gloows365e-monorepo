// ─────────────────────────────────────────────────────────────────────────────
// FILE: hooks/useReferral.ts  (NEW FILE)
// PATH: hooks/useReferral.ts
// ─────────────────────────────────────────────────────────────────────────────

import { auth, db } from "@/lib/firebase";
import {
  DEFAULT_REFERRAL_CONFIG,
  generateReferralCode,
  ReferralConfig,
  ReferralDoc,
  subscribeToMyReferrals,
  subscribeToReferralConfig,
} from "@/services/referralService";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export interface UseReferralReturn {
  // User's own referral info
  referralCode:        string;
  referralCount:       number;
  referralCoinsEarned: number;
  referredBy:          string | null;

  // List of this user's referrals
  referrals:           ReferralDoc[];

  // Admin-controlled config (coin amounts, gifts, etc.)
  config:              ReferralConfig;

  // Next milestone info
  nextMilestone:       { every: number; giftLabel: string; progressCount: number } | null;

  loading:             boolean;
}

export function useReferral(): UseReferralReturn {
  const [referralCode,        setReferralCode]        = useState("");
  const [referralCount,       setReferralCount]       = useState(0);
  const [referralCoinsEarned, setReferralCoinsEarned] = useState(0);
  const [referredBy,          setReferredBy]          = useState<string | null>(null);
  const [referrals,           setReferrals]           = useState<ReferralDoc[]>([]);
  const [config,              setConfig]              = useState<ReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  const [loading,             setLoading]             = useState(true);

  useEffect(() => {
    // Subscribe to admin config
    const unsubConfig = subscribeToReferralConfig(setConfig);

    let unsubUser:     (() => void) | null = null;
    let unsubReferrals:(() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (unsubUser)      { unsubUser();      unsubUser      = null; }
      if (unsubReferrals) { unsubReferrals(); unsubReferrals = null; }

      if (!user) {
        setReferralCode("");
        setReferralCount(0);
        setReferralCoinsEarned(0);
        setReferredBy(null);
        setReferrals([]);
        setLoading(false);
        return;
      }

      // Listen to user doc for referral stats
      unsubUser = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setReferralCode(d.referralCode ?? generateReferralCode(user.uid));
            setReferralCount(d.referralCount ?? 0);
            setReferralCoinsEarned(d.referralCoinsEarned ?? 0);
            setReferredBy(d.referredBy ?? null);
          } else {
            setReferralCode(generateReferralCode(user.uid));
          }
          setLoading(false);
        },
        () => {
          setReferralCode(generateReferralCode(user.uid));
          setLoading(false);
        }
      );

      // Listen to referrals collection for this user
      unsubReferrals = subscribeToMyReferrals(user.uid, setReferrals);
    });

    return () => {
      unsubAuth();
      unsubConfig();
      if (unsubUser)      unsubUser();
      if (unsubReferrals) unsubReferrals();
    };
  }, []);

  // ── Compute next milestone ─────────────────────────────────────────────────
  const nextMilestone = (() => {
    if (!config.milestones?.length) return null;
    // Find the first milestone where the user hasn't yet hit a multiple
    for (const m of config.milestones) {
      const completedMilestones = Math.floor(referralCount / m.every);
      const nextTarget          = (completedMilestones + 1) * m.every;
      const progressCount       = referralCount % m.every;
      return { every: nextTarget, giftLabel: m.giftLabel, progressCount };
    }
    return null;
  })();

  return {
    referralCode,
    referralCount,
    referralCoinsEarned,
    referredBy,
    referrals,
    config,
    nextMilestone,
    loading,
  };
}
