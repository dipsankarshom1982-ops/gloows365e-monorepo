"use client";

// packages/shared-logic/src/hooks/useTutorClasses.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// Mirrors useTutorBatches.ts exactly — one onSnapshot list query, no
// callable. Ordered soonest-first (startTime asc) — the one list used
// everywhere: the classes list screen, and the dashboard's "Today's
// Classes" stat (client-filtered from this same array against today's
// date bounds, rather than a second range-query index).

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { TutorClass } from "../types/tutorClass";

export interface UseTutorClassesReturn {
  classes: TutorClass[];
  loading: boolean;
}

export function useTutorClasses(tutorId: string | null | undefined): UseTutorClassesReturn {
  const [classes, setClasses] = useState<TutorClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) {
      setClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "tutorClasses"),
        where("tutorId", "==", tutorId),
        orderBy("startTime", "asc")
      ),
      (snap) => {
        setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorClass)));
        setLoading(false);
      },
      (err) => {
        console.error("[useTutorClasses]", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [tutorId]);

  return { classes, loading };
}
