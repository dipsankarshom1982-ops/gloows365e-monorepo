// hooks/useVCoins.ts

import { auth, db } from "@/lib/firebase";
import { VCoinTransaction } from "@/services/vCoinsService";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";

interface UseVCoinsReturn {
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
    let unsubUser: (() => void) | null = null;
    let unsubTx: (() => void) | null   = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      // clean up previous listeners
      if (unsubUser) { unsubUser(); unsubUser = null; }
      if (unsubTx)   { unsubTx();   unsubTx   = null; }

      if (!user) {
        setBalance(null);
        setLifetimeEarned(0);
        setLifetimeSpent(0);
        setTransactions([]);
        setLoading(false);
        return;
      }

      // ── Balance / lifetime fields ─────────────────────────────────────────
      unsubUser = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (!snap.exists()) { setLoading(false); return; }
          const d = snap.data();
          setBalance(d.vCoinsBalance ?? 0);
          setLifetimeEarned(d.vCoinsLifetimeEarned ?? 0);
          setLifetimeSpent(d.vCoinsLifetimeSpent ?? 0);
          setLoading(false);
        },
        (err) => {
          console.error("[useVCoins] user snapshot error:", err);
          setError("Failed to load balance");
          setLoading(false);
        }
      );

      // ── Transactions ──────────────────────────────────────────────────────
      const txQuery = query(
        collection(db, "users", user.uid, "vCoinTransactions"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      unsubTx = onSnapshot(
        txQuery,
        (snap) => {
          const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VCoinTransaction));
          setTransactions(txs);
        },
        (err) => {
          console.error("[useVCoins] transactions snapshot error:", err);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
      if (unsubTx)   unsubTx();
    };
  }, []);

  // ── thisMonthEarned — computed from transaction list ─────────────────────
  const monthStart = getMonthStart();
  const thisMonthEarned = transactions.reduce((sum, tx) => {
    if (tx.type !== "CREDIT" || tx.status !== "SUCCESS") return sum;
    const ts = tx.createdAt?.toDate?.();
    if (!ts || ts < monthStart) return sum;
    return sum + tx.amount;
  }, 0);

  return {
    balance,
    lifetimeEarned,
    lifetimeSpent,
    thisMonthEarned,
    transactions,
    loading,
    error,
  };
}
