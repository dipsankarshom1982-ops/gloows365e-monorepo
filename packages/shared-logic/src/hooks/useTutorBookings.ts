"use client";

// packages/shared-logic/src/hooks/useTutorBookings.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// Same shape as useTutorStudents.ts/useTutorBatches.ts: one onSnapshot
// query, owner-scoped via a field (tutorUid) rather than the doc ID,
// mirrored for the "Booking Requests" screen the same way those hooks
// back the Students/Batches lists. Deliberately its own hook, not layered
// onto those — bookings/{id} is intentionally NOT connected to
// tutorStudents/tutorBatches/tutorClasses (see the Phase 1 architecture
// audit: that's a separate private CRM, this is the public-marketplace
// booking relationship).

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { Booking } from "../types/booking";

export interface UseTutorBookingsReturn {
  bookings: Booking[];
  loading: boolean;
}

export function useTutorBookings(tutorUid: string | null | undefined): UseTutorBookingsReturn {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!tutorUid) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "bookings"),
        where("tutorUid", "==", tutorUid),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
        setLoading(false);
      },
      (err) => {
        console.error("[useTutorBookings]", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [tutorUid]);

  return { bookings, loading };
}
