import { db } from "@/lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export const syncLeaderboard = async (user: any) => {
  const base = {
    userId: user.id,
    name: user.name,
    avatar: user.avatar,
    class: user.class,

    state: user.state,
    stateCode: user.stateCode,
    district: user.district,
    districtKey: user.districtKey,

    trend: "same",
    isSponsored: false,

    updatedAt: serverTimestamp(),
  };

  // DAILY
  await setDoc(
    doc(db, "leaderboards/daily/country", user.id),
    {
      ...base,
      points: user.dailyPoints,
    },
    { merge: true }
  );

  // WEEKLY
  await setDoc(
    doc(db, "leaderboards/weekly/country", user.id),
    {
      ...base,
      points: user.weeklyPoints,
    },
    { merge: true }
  );

  // MONTHLY
  await setDoc(
    doc(db, "leaderboards/monthly/country", user.id),
    {
      ...base,
      points: user.monthlyPoints,
    },
    { merge: true }
  );

  // YEARLY
  await setDoc(
    doc(db, "leaderboards/yearly/country", user.id),
    {
      ...base,
      points: user.yearlyPoints,
    },
    { merge: true }
  );
};