"use client";

// packages/shared-logic/src/hooks/usePayoutRequests.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub Phase 5 — a tutor's own payout request history/status, and
// their saved payout (bank/UPI) details. Same onSnapshot-driven shape as
// useInstantHelp.ts/useTutorEarnings.ts — no polling, no manual refresh.

import {
  collection, doc, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { PayoutRequest, TutorPayoutDetails } from "../types/payout";

export interface UsePayoutRequestsReturn {
  requests: PayoutRequest[];
  loading: boolean;
}

export function usePayoutRequests(
  tutorUid: string | null | undefined
): UsePayoutRequestsReturn {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!tutorUid) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "payoutRequests"),
        where("tutorUid", "==", tutorUid),
        orderBy("requestedAt", "desc")
      ),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayoutRequest)));
        setLoading(false);
      },
      (err) => {
        console.error("[usePayoutRequests]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [tutorUid]);

  return { requests, loading };
}

export interface UseTutorPayoutDetailsReturn {
  details: TutorPayoutDetails | null;
  loading: boolean;
}

export function useTutorPayoutDetails(
  tutorUid: string | null | undefined
): UseTutorPayoutDetailsReturn {
  const [details, setDetails] = useState<TutorPayoutDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tutorUid) {
      setDetails(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      doc(db, "tutorPayoutDetails", tutorUid),
      (snap) => {
        setDetails(snap.exists() ? ({ tutorUid, ...snap.data() } as TutorPayoutDetails) : null);
        setLoading(false);
      },
      (err) => {
        console.error("[useTutorPayoutDetails]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [tutorUid]);

  return { details, loading };
}
