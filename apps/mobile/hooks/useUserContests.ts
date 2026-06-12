// hooks/useUserContests.ts

import { db } from "@/lib/firebase";
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

export const useUserContests = (userId: string) => {
  const [joined, setJoined]       = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) return;

    // Collection group query across all contests/{id}/participant subcollections
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
};