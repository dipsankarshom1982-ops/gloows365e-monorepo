"use client";

// PATH: apps/web/src/hooks/useContestBanner.ts
//
// Reads the AI-generated per-contest banner theme — a unique
// {emoji, tagline, gradientStart, gradientEnd} per (contest, language),
// generated once by the getContestLesson Cloud Function the first time a
// student in that language opens the contest (functions/src/contestLesson.ts).
//
// This is a plain Firestore READ of the cached doc, not a call to that
// Cloud Function — calling the function would trigger a full Gemini
// generation (lesson + banner) as a side effect of just rendering a list,
// which is exactly the cost the rest of this app avoids. If nobody has
// opened this contest in the viewer's language yet, the doc simply doesn't
// exist (or isn't "completed") and callers fall back to a generic banner.

import { useEffect, useState } from "react";
import { doc, getDoc, getFirestore } from "firebase/firestore";

export interface ContestBanner {
  emoji: string;
  tagline: string;
  gradientStart: string;
  gradientEnd: string;
}

export function useContestBanner(contestId: string | undefined, language: string | undefined): ContestBanner | null {
  const [banner, setBanner] = useState<ContestBanner | null>(null);

  useEffect(() => {
    if (!contestId || !language) return;
    let cancelled = false;
    getDoc(doc(getFirestore(), "contests", contestId, "lessons", language))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const d = snap.data();
        if (d.status === "completed" && d.bannerMeta) setBanner(d.bannerMeta as ContestBanner);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [contestId, language]);

  return banner;
}
