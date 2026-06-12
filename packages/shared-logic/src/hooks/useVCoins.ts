"use client";

// packages/shared-logic/src/hooks/useVCoins.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// Pure React hooks + Firestore. Zero platform-specific dependencies.

import {
  collection, doc, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedAuth, getSharedDb } from "../lib/firebaseConfig";
import type { VCoinTransaction } from "../types/vcoins";

export interface UseVCoinsReturn {
  balance: number | null;
  lifetimeEarned: number;
  lifetimeSpent: number;
  thisMonthEarned: number;
  transactions: VCoinTransaction[];
  loading: boolean;
  error: string | null;
}

function getMonthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function useVCoins(): UseVCoinsReturn {
  const [balance, setBalance]               = useState<number | null>(null);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [lifetimeSpent, setLifetimeSpent]   = useState(0);
  const [transactions, setTransactions]     = useState<VCoinTransaction[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  useEffect(() => {
    const auth = getSharedAuth();
    const db   = getSharedDb();

    let unsubUser: (() => void) | null = null;
    let unsubTx:   (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      unsubUser?.(); unsubUser = null;
      unsubTx?.();   unsubTx   = null;

      if (!user) {
        setBalance(null); setLifetimeEarned(0);
        setLifetimeSpent(0); setTransactions([]);
        setLoading(false);
        return;
      }

      unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (!snap.exists()) { setLoading(false); return; }
        const d = snap.data();
        setBalance(d.vCoinsBalance ?? 0);
        setLifetimeEarned(d.vCoinsLifetimeEarned ?? 0);
        setLifetimeSpent(d.vCoinsLifetimeSpent ?? 0);
        setLoading(false);
      }, (err) => {
        console.error("[useVCoins]", err);
        setError("Failed to load balance");
        setLoading(false);
      });

      unsubTx = onSnapshot(
        query(
          collection(db, "users", user.uid, "vCoinTransactions"),
          orderBy("createdAt", "desc"),
          limit(50)
        ),
        (snap) => setTransactions(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as VCoinTransaction))
        )
      );
    });

    return () => { unsubAuth(); unsubUser?.(); unsubTx?.(); };
  }, []);

  const monthStart = getMonthStart();
  const thisMonthEarned = transactions.reduce((sum, tx) => {
    if (tx.type !== "CREDIT" || tx.status !== "SUCCESS") return sum;
    const ts = tx.createdAt?.toDate?.();
    if (!ts || ts < monthStart) return sum;
    return sum + tx.amount;
  }, 0);

  return { balance, lifetimeEarned, lifetimeSpent, thisMonthEarned, transactions, loading, error };
}