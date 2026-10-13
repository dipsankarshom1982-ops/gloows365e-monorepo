"use client";

// packages/shared-logic/src/hooks/useTutorReviews.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub Phase 6 — a tutor's public (non-hidden) review list, for the
// marketplace profile page. Same onSnapshot-driven shape as
// useTutorServices.ts.

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { TutorReview } from "../types/review";

export interface UseTutorReviewsReturn {
  reviews: TutorReview[];
  loading: boolean;
}

export function useTutorReviews(tutorUid: string | null | undefined): UseTutorReviewsReturn {
  const [reviews, setReviews] = useState<TutorReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tutorUid) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "tutorReviews"),
        where("tutorUid", "==", tutorUid),
        where("hidden", "==", false),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorReview)));
        setLoading(false);
      },
      (err) => {
        console.error("[useTutorReviews]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [tutorUid]);

  return { reviews, loading };
}
