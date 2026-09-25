"use client";

// packages/shared-logic/src/hooks/useInstantHelp.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub Phase 4 — live Instant Help matching/session state. Three
// hooks, one per screen role:
//   • useIncomingInstantHelpRequests — tutor's "someone's asking" queue
//   • useMyInstantHelpRequest        — student's own outstanding request
//   • useActiveInstantHelpSession    — either side's live billed session
// All onSnapshot-driven, same shape as useTutorBookings.ts/
// useStudentBookings.ts — no polling, no manual refresh.

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { InstantHelpRequest, InstantHelpSession } from "../types/instantHelp";

export interface UseIncomingInstantHelpRequestsReturn {
  requests: InstantHelpRequest[];
  loading: boolean;
}

// Tutor-side — every "pending" request currently addressed to them. In the
// direct-request matching model (see instantHelp.ts's type header) this is
// normally 0 or 1 at a time (requestInstantHelp refuses to create a second
// one while the tutor already has a pending request or active session),
// but the hook doesn't assume that itself — it just renders whatever's
// there.
export function useIncomingInstantHelpRequests(
  tutorUid: string | null | undefined
): UseIncomingInstantHelpRequestsReturn {
  const [requests, setRequests] = useState<InstantHelpRequest[]>([]);
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
        collection(db, "instantHelpRequests"),
        where("tutorUid", "==", tutorUid),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InstantHelpRequest)));
        setLoading(false);
      },
      (err) => {
        console.error("[useIncomingInstantHelpRequests]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [tutorUid]);

  return { requests, loading };
}

export interface UseMyInstantHelpRequestReturn {
  request: InstantHelpRequest | null;
  loading: boolean;
}

// Student-side — their own most recent "pending" request, so the "waiting
// for a tutor to respond" screen can watch it flip to accepted/declined/
// expired without polling.
export function useMyInstantHelpRequest(
  studentUid: string | null | undefined
): UseMyInstantHelpRequestReturn {
  const [request, setRequest] = useState<InstantHelpRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentUid) {
      setRequest(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "instantHelpRequests"),
        where("studentUid", "==", studentUid),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const first = snap.docs[0];
        setRequest(first ? ({ id: first.id, ...first.data() } as InstantHelpRequest) : null);
        setLoading(false);
      },
      (err) => {
        console.error("[useMyInstantHelpRequest]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [studentUid]);

  return { request, loading };
}

export interface UseActiveInstantHelpSessionReturn {
  session: InstantHelpSession | null;
  loading: boolean;
}

// Either side — the caller's own live "active" session, if any. `role`
// picks which field to scope by since a single Firestore query can't OR
// across studentUid/tutorUid cheaply; callers always know their own role.
export function useActiveInstantHelpSession(
  uid: string | null | undefined,
  role: "student" | "tutor"
): UseActiveInstantHelpSessionReturn {
  const [session, setSession] = useState<InstantHelpSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setSession(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getSharedDb();
    const field = role === "student" ? "studentUid" : "tutorUid";
    const unsub = onSnapshot(
      query(
        collection(db, "instantHelpSessions"),
        where(field, "==", uid),
        where("status", "==", "active"),
        orderBy("startedAt", "desc")
      ),
      (snap) => {
        const first = snap.docs[0];
        setSession(first ? ({ id: first.id, ...first.data() } as InstantHelpSession) : null);
        setLoading(false);
      },
      (err) => {
        console.error("[useActiveInstantHelpSession]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, role]);

  return { session, loading };
}
