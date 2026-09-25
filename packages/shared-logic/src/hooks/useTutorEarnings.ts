"use client";

// packages/shared-logic/src/hooks/useTutorEarnings.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub Phase 4 — a tutor's own tutorEarnings/{uid} balance + ledger,
// credited by functions/src/instantHelp.ts's settleInstantHelpSession() as
// Instant Help sessions get billed. Same shape as useTutorCreditsBalance.ts.

import {
  collection, doc, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedAuth, getSharedDb } from "../lib/firebaseConfig";
import type { TutorEarningsTransaction } from "../types/tutorCredits";

export interface UseTutorEarningsReturn {
  balance: number | null;
  lifetimeEarned: number;
  transactions: TutorEarningsTransaction[];
  loading: boolean;
}

export function useTutorEarnings(): UseTutorEarningsReturn {
  const [balance, setBalance]               = useState<number | null>(null);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [transactions, setTransactions]     = useState<TutorEarningsTransaction[]>([]);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    const auth = getSharedAuth();
    const db   = getSharedDb();

    let unsubBal: (() => void) | null = null;
    let unsubTx:  (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      unsubBal?.(); unsubBal = null;
      unsubTx?.();  unsubTx  = null;

      if (!user) {
        setBalance(null); setLifetimeEarned(0); setTransactions([]);
        setLoading(false);
        return;
      }

      unsubBal = onSnapshot(doc(db, "tutorEarnings", user.uid), (snap) => {
        const d = snap.data();
        setBalance(d?.balance ?? 0);
        setLifetimeEarned(d?.lifetimeEarned ?? 0);
        setLoading(false);
      }, (err) => {
        console.error("[useTutorEarnings]", err);
        setLoading(false);
      });

      unsubTx = onSnapshot(
        query(
          collection(db, "tutorEarnings", user.uid, "transactions"),
          orderBy("createdAt", "desc"),
          limit(50)
        ),
        (snap) => setTransactions(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorEarningsTransaction))
        )
      );
    });

    return () => { unsubAuth(); unsubBal?.(); unsubTx?.(); };
  }, []);

  return { balance, lifetimeEarned, transactions, loading };
}
