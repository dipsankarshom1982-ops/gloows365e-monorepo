"use client";

// packages/shared-logic/src/hooks/useTutorConversations.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub messaging phase — a student's or tutor's own conversation
// list, most-recently-active first. `role` picks which side of
// tutorConversations/{id} to filter on — a given uid is only ever one
// role in this app (separate student/tutor Auth pools, see
// functions/src/tutorMessaging.ts's header comment), so this never needs
// to query both fields at once.

import {
  collection, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { TutorConversation } from "../types/conversation";

export interface UseTutorConversationsReturn {
  conversations: TutorConversation[];
  loading: boolean;
}

export function useTutorConversations(
  uid: string | null | undefined,
  role: "student" | "tutor"
): UseTutorConversationsReturn {
  const [conversations, setConversations] = useState<TutorConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getSharedDb();
    const field = role === "student" ? "studentUid" : "tutorUid";
    const unsub = onSnapshot(
      query(collection(db, "tutorConversations"), where(field, "==", uid), orderBy("updatedAt", "desc")),
      (snap) => {
        setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorConversation)));
        setLoading(false);
      },
      (err) => {
        console.error("[useTutorConversations]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, role]);

  return { conversations, loading };
}
