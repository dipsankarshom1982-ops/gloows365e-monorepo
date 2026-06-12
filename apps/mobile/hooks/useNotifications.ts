import { db } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

export default function useNotifications(userId: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size); // 🔥 unread count
    });

    return () => unsubscribe();
  }, [userId]);

  return count;
}