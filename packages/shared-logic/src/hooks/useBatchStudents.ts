"use client";

// packages/shared-logic/src/hooks/useBatchStudents.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// The array-contains query for "which of my students are in this
// batch" — used by both the batch detail screen (read-only list) and
// the assign screen (to derive each row's checked state live, so a
// write immediately reflects without local draft state).

import {
  collection, onSnapshot, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { TutorStudent } from "../types/tutorStudent";

export interface UseBatchStudentsReturn {
  students: TutorStudent[];
  loading: boolean;
}

export function useBatchStudents(
  tutorId: string | null | undefined,
  batchId: string | null | undefined
): UseBatchStudentsReturn {
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!tutorId || !batchId) {
      setStudents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "tutorStudents"),
        where("tutorId", "==", tutorId),
        where("batchIds", "array-contains", batchId)
      ),
      (snap) => {
        setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorStudent)));
        setLoading(false);
      },
      (err) => {
        console.error("[useBatchStudents]", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [tutorId, batchId]);

  return { students, loading };
}
