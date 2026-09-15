"use client";

// PATH: apps/web/src/hooks/useVCoins.ts
// Exact mirror of mobile hooks/useVCoins.ts
// Reads: users/{uid}.vCoinsBalance (NOT students/{uid})
// Also reads users/{uid}/vCoinTransactions subcollection
//
// FIX (bug report — "all updated v-coins must be shown in drawer and
// v-coins page properly"): there are two separate, disconnected balance
// fields on users/{uid} in this app:
//   - vCoinsBalance — written by services/vCoinsService.ts's creditVCoins(),
//     used for reel/video watches, contest entries, the registration
//     welcome bonus, etc.
//   - vCoins        — written by a separate backend Cloud Function,
//     claimVCoinReward (functions/src/vcoins.ts, not in this repo), used
//     by the Daily Streak Quiz feature.
// Nothing ever reconciles them — a student who only ever played the Daily
// Streak Quiz would have vCoins > 0 and vCoinsBalance == 0, and this hook
// used to read vCoinsBalance alone, so Wallet/AppHeader showed 0 for them.
// Conversely Drawer.tsx used to read vCoins alone and would show 0 for
// coins earned any other way. Since these are genuinely separate pools
// (nothing debits from both at once), the correct total to display
// everywhere is the sum of both. Drawer.tsx and daily-streak-quiz/page.tsx
// (which don't use this hook) apply the same sum — see FIX comments there.

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

export interface VCoinTransaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  description: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  createdAt: { toDate?: () => Date } | null;
}

interface UseVCoinsReturn {
  balance: number | null;
  lifetimeEarned: number;
  lifetimeSpent: number;
  thisMonthEarned: number;
  transactions: VCoinTransaction[];
  loading: boolean;
  error: string | null;
}

export function useVCoins(): UseVCoinsReturn {
  const [balance,        setBalance]        = useState<number | null>(null);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [lifetimeSpent,  setLifetimeSpent]  = useState(0);
  const [transactions,   setTransactions]   = useState<VCoinTransaction[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  // Bumped to force fresh onSnapshot subscriptions — see the
  // visibility-regain effect below.
  const [reloadTick,     setReloadTick]     = useState(0);

  useEffect(() => {
    const auth = getAuth();
    const db   = getFirestore();
    let unsubUser: (() => void) | null = null;
    let unsubTx:   (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubUser?.(); unsubUser = null;
      unsubTx?.();   unsubTx   = null;

      if (!user) {
        setBalance(null); setLifetimeEarned(0);
        setLifetimeSpent(0); setTransactions([]);
        setLoading(false); return;
      }

      // Balance from users/{uid} — same as mobile
      unsubUser = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (!snap.exists()) { setLoading(false); return; }
          const d = snap.data();
          // Sum both pools — see FIX comment at top of file.
          setBalance((d.vCoinsBalance ?? 0) + (d.vCoins ?? 0));
          setLifetimeEarned(d.vCoinsLifetimeEarned ?? 0);
          setLifetimeSpent(d.vCoinsLifetimeSpent ?? 0);
          setLoading(false);
        },
        (err) => { setError("Failed to load balance"); setLoading(false); console.error(err); }
      );

      // Transactions subcollection
      unsubTx = onSnapshot(
        query(
          collection(db, "users", user.uid, "vCoinTransactions"),
          orderBy("createdAt", "desc"),
          limit(50)
        ),
        (snap) => {
          setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VCoinTransaction)));
        },
        (err) => console.error("[useVCoins] tx error:", err)
      );
    });

    return () => { unsubAuth(); unsubUser?.(); unsubTx?.(); };
  }, [reloadTick]);

  // FIX (bug report — "close app, reopen — v-coins don't load", same class
  // of issue as reels/stories): onSnapshot listeners reconnect on their own
  // after an ordinary network blip, but a long-lived connection can go
  // stale after the browser tab sits backgrounded for a while (mobile OS
  // suspending timers/sockets) without ever firing an error — it just
  // stops delivering updates, and the balance stays stuck on whatever it
  // last was (or null, if it was still loading when the tab was
  // backgrounded). Tearing down and re-subscribing fresh listeners when the
  // tab becomes visible again is a cheap recovery path. Guarded to only
  // fire when the balance genuinely never loaded, so this isn't
  // refetching on every ordinary tab switch.
  useEffect(() => {
    const handleVisible = () => {
      if (!document.hidden && balance === null && !loading) {
        setReloadTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [balance, loading]);

  const monthStart = (() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  })();

  const thisMonthEarned = transactions.reduce((sum, tx) => {
    if (tx.type !== "CREDIT" || tx.status !== "SUCCESS") return sum;
    const ts = tx.createdAt?.toDate?.();
    if (!ts || ts < monthStart) return sum;
    return sum + tx.amount;
  }, 0);

  return { balance, lifetimeEarned, lifetimeSpent, thisMonthEarned, transactions, loading, error };
}