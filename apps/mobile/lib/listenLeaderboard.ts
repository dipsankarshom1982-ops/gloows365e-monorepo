import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { addRanking } from "@/lib/rankUtils";

let prevRanks: any = {};

export const listenLeaderboard = (
  tab: string,
  cb: (data: any[]) => void
) => {
  const q = query(
    collection(db, `leaderboards/${tab}/country`),
    orderBy("points", "desc"),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    const raw = snap.docs.map((d) => d.data());
    const ranked = addRanking(raw, prevRanks);

    prevRanks = {};
    ranked.forEach((u) => {
      prevRanks[u.userId] = u.rank;
    });

    cb(ranked);
  });
};
