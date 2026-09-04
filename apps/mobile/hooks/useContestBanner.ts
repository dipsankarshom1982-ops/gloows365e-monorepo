// PATH: apps/mobile/hooks/useContestBanner.ts
// Mirrors web src/hooks/useContestBanner.ts.
//
// Reads the AI-generated per-contest banner theme — a unique
// {emoji, tagline, gradientStart, gradientEnd} per (contest, language),
// generated once by the getContestLesson Cloud Function the first time a
// student in that language opens the contest (functions/src/contestLesson.ts).
//
// This is a plain Firestore READ, not a call to that Cloud Function —
// calling the function would trigger a full Gemini generation (lesson +
// banner) as a side effect of just rendering a list, which is exactly the
// cost the rest of this app avoids. If nobody has opened this contest in
// the viewer's language yet, the field simply doesn't exist and callers
// fall back to a generic banner.
//
// COMPATIBILITY (VidyaStar Phase 1): this used to read
// contests/{id}/lessons/{language}.bannerMeta directly. Phase 1 locked
// that collection to deny-all (it's where the contest's quiz answer key
// used to live before being split into a separate private doc — see
// contestLesson.ts). bannerMeta itself carries no quiz/answer data, so it's
// now mirrored onto contests/{id}.banners.{language} instead — a doc
// that's always been world-readable to any authenticated user and is
// unaffected by that lockdown.

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

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
    getDoc(doc(db, "contests", contestId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const meta = snap.data()?.banners?.[language];
        if (meta) setBanner(meta as ContestBanner);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [contestId, language]);

  return banner;
}
