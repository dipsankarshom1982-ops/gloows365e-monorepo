// services/joinContest.ts

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const joinContest = async (userId: string, contest: any) => {
  // participant is a subcollection under the contest document
  const ref = doc(db, "contests", contest.id, "participant", userId);

  const snap = await getDoc(ref);
  if (snap.exists()) return true;

  await setDoc(ref, {
    userId,
    contestId: contest.id,
    joinedAt: new Date(),
    score: 0,
    completed: false,
  });

  return true;
};