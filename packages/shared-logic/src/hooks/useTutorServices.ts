"use client";

// packages/shared-logic/src/hooks/useTutorServices.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub Phase 3 — a tutor's own service list ("My Services" screen).
// Same onSnapshot-query shape as useTutorBookings.ts, owner-scoped via
// tutorUid rather than the doc ID.

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { TutorService } from "../types/tutorService";

export interface UseTutorServicesReturn {
  services: TutorService[];
  loading: boolean;
}

export function useTutorServices(tutorUid: string | null | undefined): UseTutorServicesReturn {
  const [services, setServices] = useState<TutorService[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!tutorUid) {
      setServices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "tutorServices"),
        where("tutorUid", "==", tutorUid),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorService)));
        setLoading(false);
      },
      (err) => {
        console.error("[useTutorServices]", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [tutorUid]);

  return { services, loading };
}
