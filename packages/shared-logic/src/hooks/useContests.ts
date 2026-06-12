"use client";

// PATH: packages/shared-logic/src/hooks/useContests.ts
// Contest fetching + the status-derivation helpers from mobile
// VidyaStarPreviewSection.tsx. Status is ALWAYS derived from start/end
// timestamps — never stored in Firestore (project rule).
//
// ⚠️ Collection name "contests" is inferred — verify against the mobile
// hooks/useContests.ts and correct here if it differs. This is the single
// place it would ever need changing.

import { useEffect, useState } from "react";
import { collection, getDocs, getFirestore } from "firebase/firestore";

export interface ContestItem {
  id: string;
  title?: string;
  prizePool?: string;
  startTime?: any;
  endTime?: any;
  startDate?: any;
  endDate?: any;
  description?: string;
  order?: number;
  isFeatured?: boolean;
  lessonStatus?: string;
  bannerMeta?: {
    emoji?: string;
    tagline?: string;
    gradientStart?: string;
    gradientEnd?: string;
  };
  [key: string]: any;
}

export type ContestStatus = "live" | "upcoming" | "ended";

export function parseFirestoreDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

export function getContestStatus(item: ContestItem): ContestStatus {
  const now = new Date();
  const start = parseFirestoreDate(item.startTime ?? item.startDate);
  const end = parseFirestoreDate(item.endTime ?? item.endDate);
  if (end && end < now) return "ended";
  if (start && start <= now && (!end || end > now)) return "live";
  return "upcoming";
}

/** Featured first, then admin order — same sort as the mobile preview. */
export function sortContests(list: ContestItem[]): ContestItem[] {
  return [...list].sort((a, b) => {
    if ((b.isFeatured ? 1 : 0) !== (a.isFeatured ? 1 : 0))
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    return (a.order ?? 99) - (b.order ?? 99);
  });
}

export function useContests() {
  const [contests, setContests] = useState<ContestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const db = getFirestore();
    getDocs(collection(db, "contests"))
      .then((snap) =>
        setContests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
      )
      .catch(() => {
        setContests([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return { contests, loading, error };
}
