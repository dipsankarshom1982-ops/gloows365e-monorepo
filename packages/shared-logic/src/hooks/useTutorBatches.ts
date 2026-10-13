"use client";

// packages/shared-logic/src/hooks/useTutorBatches.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// Mirrors useTutorStudents.ts exactly — one onSnapshot list query, no
// callable (plain owner-scoped CRUD, gated by firestore.rules).

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { TutorBatch } from "../types/tutorBatch";

export interface UseTutorBatchesReturn {
  batches: TutorBatch[];
  loading: boolean;
}

export function useTutorBatches(tutorId: string | null | undefined): UseTutorBatchesReturn {
  const [batches, setBatches] = useState<TutorBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) {
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "tutorBatches"),
        where("tutorId", "==", tutorId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorBatch)));
        setLoading(false);
      },
      (err) => {
        console.error("[useTutorBatches]", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [tutorId]);

  return { batches, loading };
}
