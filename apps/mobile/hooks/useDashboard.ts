import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

type DashboardType = {
  courses: number;
  streak: number;
  coins: number;
  rank: number;
  currentCourse: string;
  progress: number;
  earnings: number;
};

export default function useDashboard() {
  const [data, setData] = useState<DashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubFirestore: any;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log("❌ User not logged in");
        setLoading(false);
        return;
      }

      try {
        console.log("✅ UID:", user.uid);

        const ref = doc(db, "dashboard", user.uid);

        // 🔥 STEP 1: Ensure document exists (AUTO CREATE)
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          console.log("⚡ Creating dashboard for new user...");

          await setDoc(ref, {
            courses: 0,
            streak: 0,
            coins: 0,
            rank: 0,
            currentCourse: "Start Learning",
            progress: 0,
            earnings: 0,
          });
        }

        // 🔥 STEP 2: Listen to real-time updates
        unsubFirestore = onSnapshot(
          ref,
          (snapshot) => {
            if (snapshot.exists()) {
              setData(snapshot.data() as DashboardType);
            } else {
              setData(null);
            }
            setLoading(false);
          },
          (err) => {
            console.log("🔥 Firestore error:", err);
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err: any) {
        console.log("🔥 Init error:", err);
        setError(err.message);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  return { data, loading, error };
}