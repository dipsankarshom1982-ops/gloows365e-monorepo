import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { getSubscription, loadAllProgressForUser } from "@/services/seekhoFirestore";
import { useSeekhoStore } from "@/store/seekhoStore";
import type { SeekhoCourse, SeekhoSubscription } from "@/lib/seekho/types";

export interface UseSeekhoAccessReturn {
  canAccess: (course: SeekhoCourse) => boolean;
  subscription: SeekhoSubscription | null;
  isPro: boolean;
  isPlus: boolean;
  isFreeUser: boolean;
  loading: boolean;
  showSubscriptionSheet: (course?: SeekhoCourse) => void;
  reload: () => Promise<void>;
}

export function useSeekhoAccess(): UseSeekhoAccessReturn {
  const { user } = useStudentProfile();
  const {
    currentSubscription,
    setSubscription,
    setCourseProgress,
    checkAccess,
  } = useSeekhoStore();

  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const [sub, progress] = await Promise.all([
        getSubscription(user.uid),
        loadAllProgressForUser(user.uid),
      ]);
      setSubscription(sub ? { ...sub, userId: user.uid } : null);
      setCourseProgress(progress);
    } catch (e) {
      console.warn("useSeekhoAccess fetch:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
    // Only re-fetch when user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const canAccess = (course: SeekhoCourse): boolean =>
    checkAccess(course).allowed;

  const showSubscriptionSheet = (course?: SeekhoCourse) => {
    router.push({
      pathname: "/seekho/subscription",
      params: course ? { forClass: String(course.class) } : undefined,
    });
  };

  const plan = currentSubscription?.plan ?? "free";

  return {
    canAccess,
    subscription: currentSubscription,
    isPro: plan === "pro",
    isPlus: plan === "plus",
    isFreeUser: !currentSubscription || plan === "free",
    loading,
    showSubscriptionSheet,
    reload: fetchSubscription,
  };
}
