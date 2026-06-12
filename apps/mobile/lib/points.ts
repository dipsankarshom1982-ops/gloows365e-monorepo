import { db } from "@/lib/firebase";
import { doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";

export const addPoints = async (userId: string, pts: number) => {
  const ref = doc(db, "users", userId);

  await updateDoc(ref, {
    totalPoints: increment(pts),
    dailyPoints: increment(pts),
    weeklyPoints: increment(pts),
    monthlyPoints: increment(pts),
    yearlyPoints: increment(pts),
    updatedAt: serverTimestamp(),
  });
};