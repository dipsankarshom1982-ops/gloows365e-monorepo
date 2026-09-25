"use client";

// PATH: apps/web/src/hooks/useUserContests.ts
// Mirrors mobile hooks/useUserContests.ts exactly — collectionGroup query
// across contests/{id}/participant subcollections, filtered by userId.

import { useEffect, useState } from "react";
import { getFirestore, collectionGroup, onSnapshot, query, where } from "firebase/firestore";

export function useUserContests(userId: string) {
  const [joined, setJoined]       = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) return;

    const db = getFirestore();
    const q = query(
      collectionGroup(db, "participant"),
      where("userId", "==", userId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const j: Record<string, boolean> = {};
      const c: Record<string, any>     = {};

      snap.docs.forEach((doc) => {
        const data = doc.data();
        j[data.contestId] = true;
        if (data.completed) c[data.contestId] = data;
      });

      setJoined(j);
      setCompleted(c);
    });

    return () => unsub();
  }, [userId]);

  return { joined, completed };
}
