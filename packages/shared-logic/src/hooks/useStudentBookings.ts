"use client";

// packages/shared-logic/src/hooks/useStudentBookings.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// Student-side mirror of useTutorBookings.ts: same onSnapshot query shape,
// just scoped by studentUid instead of tutorUid — this is what backs each
// student client's "My Bookings" screen (ShikshaHub Phase 2).

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { Booking } from "../types/booking";

export interface UseStudentBookingsReturn {
  bookings: Booking[];
  loading: boolean;
}

export function useStudentBookings(studentUid: string | null | undefined): UseStudentBookingsReturn {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!studentUid) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "bookings"),
        where("studentUid", "==", studentUid),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
        setLoading(false);
      },
      (err) => {
        console.error("[useStudentBookings]", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [studentUid]);

  return { bookings, loading };
}
