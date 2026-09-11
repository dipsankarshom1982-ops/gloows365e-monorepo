"use client";

// packages/shared-logic/src/hooks/useTutorCreditsBalance.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub Phase 4 — a student's own tutorCredits/{uid} balance +
// ledger, the currency that funds Instant Help per-minute billing. Same
// two-listener (balance doc + transactions subcollection) shape as
// useVCoins.ts, just pointed at tutorCredits/{uid} instead of
// users/{uid}/vCoinTransactions.

import {
  collection, doc, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedAuth, getSharedDb } from "../lib/firebaseConfig";
import type { TutorCreditTransaction } from "../types/tutorCredits";

export interface UseTutorCreditsBalanceReturn {
  balance: number | null;
  lifetimePurchased: number;
  lifetimeSpent: number;
  transactions: TutorCreditTransaction[];
  loading: boolean;
}

export function useTutorCreditsBalance(): UseTutorCreditsBalanceReturn {
  const [balance, setBalance]                     = useState<number | null>(null);
  const [lifetimePurchased, setLifetimePurchased]  = useState(0);
  const [lifetimeSpent, setLifetimeSpent]          = useState(0);
  const [transactions, setTransactions]            = useState<TutorCreditTransaction[]>([]);
  const [loading, setLoading]                      = useState(true);

  useEffect(() => {
    const auth = getSharedAuth();
    const db   = getSharedDb();

    let unsubBal: (() => void) | null = null;
    let unsubTx:  (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      unsubBal?.(); unsubBal = null;
      unsubTx?.();  unsubTx  = null;

      if (!user) {
        setBalance(null); setLifetimePurchased(0);
        setLifetimeSpent(0); setTransactions([]);
        setLoading(false);
        return;
      }

      unsubBal = onSnapshot(doc(db, "tutorCredits", user.uid), (snap) => {
        const d = snap.data();
        setBalance(d?.balance ?? 0);
        setLifetimePurchased(d?.lifetimePurchased ?? 0);
        setLifetimeSpent(d?.lifetimeSpent ?? 0);
        setLoading(false);
      }, (err) => {
        console.error("[useTutorCreditsBalance]", err);
        setLoading(false);
      });

      unsubTx = onSnapshot(
        query(
          collection(db, "tutorCredits", user.uid, "transactions"),
          orderBy("createdAt", "desc"),
          limit(50)
        ),
        (snap) => setTransactions(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorCreditTransaction))
        )
      );
    });

    return () => { unsubAuth(); unsubBal?.(); unsubTx?.(); };
  }, []);

  return { balance, lifetimePurchased, lifetimeSpent, transactions, loading };
}
