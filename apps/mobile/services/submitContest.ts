// services/submitContest.ts

import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";

export const submitContest = async (contestId: string, score: number) => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not logged in");

  const userId = user.uid;

  const ref = doc(db, "participant", `${contestId}_${userId}`);

  await updateDoc(ref, {
    score,
    completed: true,
  });

  // 🔥 RANK CALCULATION
  const snap = await getDocs(collection(db, "participant"));

  const list = snap.docs
    .map(d => d.data())
    .filter(c => c.contestId === contestId)
    .sort((a, b) => b.score - a.score);

  const rank = list.findIndex(c => c.userId === userId) + 1;

  await updateDoc(ref, { rank });

  return rank;
};