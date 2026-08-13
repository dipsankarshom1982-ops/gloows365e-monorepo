import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export const useContests = () => {
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "contests"),
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          // FIX (bug report — Join Now/Reserve Spot always says "Contest
          // closed"): admin's CreateContest.tsx defaults new contests to
          // isActive: false ("Active (visible to students)", off until
          // explicitly toggled), and the join Cloud Function correctly
          // rejects joining any contest with isActive === false. This list
          // had no such filter, so still-draft contests showed up looking
          // live/upcoming (purely from date fields) with a fully working
          // Join Now button that could never actually succeed. Matches the
          // Cloud Function's own check exactly — isActive !== false, not
          // === true, so contests from before this field existed (no
          // isActive at all) still show, same as they always did.
          .filter((c: any) => c.isActive !== false);
        setContests(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { contests, loading, error };
};