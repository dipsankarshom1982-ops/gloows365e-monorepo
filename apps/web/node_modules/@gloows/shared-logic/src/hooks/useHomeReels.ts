"use client";

// PATH: packages/shared-logic/src/hooks/useHomeReels.ts
// Extracted from mobile ShortLearnPreview.tsx / SkillShortPreview:
// posts where postType=="reel", orderBy views desc, limit 30 — single-field
// where() so NO composite index is needed — then client-side filtering on
// isSkillBattle and rejected status, trimmed to 10.

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

export interface HomeReel {
  id: string;
  title?: string;
  thumbnail?: string;
  views?: number;
  isSkillBattle?: boolean;
  status?: string;
  [key: string]: any;
}

export function useHomeReels(battleReels: boolean) {
  const [reels, setReels] = useState<HomeReel[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const db = getFirestore();
      const snap = await getDocs(
        query(
          collection(db, "posts"),
          where("postType", "==", "reel"),
          orderBy("views", "desc"),
          limit(30)
        )
      );
      const data = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(
          (item) =>
            (battleReels
              ? item.isSkillBattle === true
              : item.isSkillBattle !== true) &&
            item.status !== "rejected"
        )
        .slice(0, 10);
      setReels(data);
    } catch {
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [battleReels]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { reels, loading, refetch };
}
