import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { addRanking } from "@/lib/rankUtils";

// FIX: this previously read leaderboards/{tab}/country, while web's
// Starboard reads leaderboard/{tab}/entries — two completely different
// collections, meaning mobile and web Starboard never showed the same
// data. Standardized on leaderboard/{tab}/entries (the path
// submitContestQuiz.ts already writes contest scores to on both
// platforms) since that's now the actively-fed source.
let prevRanks: any = {};

export const listenLeaderboard = (
  tab: string,
  cb: (data: any[]) => void,
  userClass?: string | null
) => {
  const q = userClass
    ? query(
        collection(db, `leaderboard/${tab}/entries`),
        where("class", "==", userClass),
        orderBy("points", "desc"),
        limit(100)
      )
    : query(
        collection(db, `leaderboard/${tab}/entries`),
        orderBy("points", "desc"),
        limit(100)
      );

  return onSnapshot(
    q,
    (snap) => {
      const raw = snap.docs.map((d) => ({ ...d.data(), userId: d.id }));
      const ranked = addRanking(raw, prevRanks);

      prevRanks = {};
      ranked.forEach((u) => {
        prevRanks[u.userId] = u.rank;
      });

      cb(ranked);
    },
    // Without this, a query failure (e.g. a missing composite index for
    // the class-scoped where+orderBy) silently left `data` at its initial
    // [] — the screen just showed "No data yet for this period" with no
    // trace of why. Logging it doesn't fix the query, but it stops the
    // next version of this bug from being invisible.
    (err) => console.warn("listenLeaderboard query failed:", err)
  );
};
