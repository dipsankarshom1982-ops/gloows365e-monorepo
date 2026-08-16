"use client";

// packages/shared-logic/src/hooks/useTutorStudents.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// Pure React hooks + Firestore. Zero platform-specific dependencies.
//
// Wraps the one tutorStudents list query (own roster, newest-added-first)
// so the dashboard's "Active Students" count and the students list screen
// share exactly one onSnapshot listener shape instead of each
// re-implementing the same query.

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { TutorStudent } from "../types/tutorStudent";

export interface UseTutorStudentsReturn {
  students: TutorStudent[];
  loading: boolean;
}

export function useTutorStudents(tutorId: string | null | undefined): UseTutorStudentsReturn {
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!tutorId) {
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
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorStudent)));
        setLoading(false);
      },
      (err) => {
        console.error("[useTutorStudents]", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [tutorId]);

  return { students, loading };
}
