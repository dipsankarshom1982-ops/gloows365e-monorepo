// PATH: hooks/useLearnFun.ts
// Changes:
//  • completeMission no longer increments LearnFunCoins or learnScore
//  • Instead calls claimVCoinReward Cloud Function (activityId: "lesson_complete")
//    so V-Coins are awarded via the single authoritative path (with Redis dedup + yearlyVCoins)
//  • profile.coins now reads from vCoins (users doc) not LearnFunCoins
//  • leaderboard write removed (rank is now derived from vCoinsYear_* not learnScore)
//  • XP + streak + badges still work exactly as before

import { auth, db, functions } from "@/lib/firebase";
import { BADGES, GAMES, getLevelFromXP, SKILL_WORLDS } from "@/lib/learnfun/constants";
import { getMissionForClass } from "@/lib/learnfun/missionData";
import { Badge, DailyMission, LearnFunGame, SkillWorld, StudentLearnFunProfile } from "@/lib/learnfun/types";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useState } from "react";

interface UseLearnFunReturn {
  profile: StudentLearnFunProfile | null;
  todaysMission: DailyMission | null;
  visibleGames: LearnFunGame[];
  skillWorlds: SkillWorld[];
  allBadges: Badge[];
  completeMission: (missionId: string, score: number, badgeEarned?: string) => Promise<void>;
  missionPlayedToday: boolean;
  loading: boolean;
  error: string | null;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Cloud Function callable
const claimVCoinRewardCF = httpsCallable<
  { activityId: string; referenceId?: string },
  { success: boolean; coinsAwarded: number }
>(functions, "claimVCoinReward");

export function useLearnFun(): UseLearnFunReturn {
  const [profile, setProfile]                   = useState<StudentLearnFunProfile | null>(null);
  const [todaysMission, setTodaysMission]       = useState<DailyMission | null>(null);
  const [visibleGames, setVisibleGames]         = useState<LearnFunGame[]>([]);
  const [skillWorlds]                            = useState<SkillWorld[]>(SKILL_WORLDS);
  const [allBadges]                              = useState<Badge[]>(BADGES);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [missionPlayedToday, setMissionPlayedToday] = useState(false);

  const todayStr = getTodayStr();

  // ── Load games ────────────────────────────────────────────────────────────
  const loadGamesForClass = useCallback(async (studentClass: number) => {
    const local = GAMES.filter(
      (g) => g.classRange.includes(studentClass) && g.isActive && !g.isComingSoon
    );
    try {
      const snapshot = await getDocs(collection(db, "LearnFunGames"));
      if (!snapshot.empty) {
        const fromFs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as LearnFunGame))
          .filter(
            (g) =>
              Array.isArray(g.classRange) &&
              g.classRange.includes(studentClass) &&
              g.isActive &&
              !g.isComingSoon &&
              Array.isArray(g.gradientColors)
          );
        setVisibleGames(fromFs.length > 0 ? fromFs : local);
      } else {
        setVisibleGames(local);
      }
    } catch {
      setVisibleGames(local);
    }
  }, []);

  // ── Load today's mission ──────────────────────────────────────────────────
  const loadTodaysMission = useCallback(async (studentClass: number) => {
    try {
      const q = query(
        collection(db, "dailyFunLearnMissions"),
        where("class", "==", studentClass),
        where("date", "==", todayStr)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        setTodaysMission({ id: d.id, ...d.data() } as DailyMission);
      } else {
        setTodaysMission(getMissionForClass(studentClass));
      }
    } catch {
      setTodaysMission(getMissionForClass(studentClass));
    }
  }, [todayStr]);

  // ── Auth-aware real-time profile listener ─────────────────────────────────
  useEffect(() => {
    let unsubSnap: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (unsubSnap) { unsubSnap(); unsubSnap = null; }
      if (!user) { setLoading(false); return; }

      const studentRef = doc(db, "students", user.uid);
      unsubSnap = onSnapshot(
        studentRef,
        (snapshot) => {
          if (!snapshot.exists()) { setLoading(false); return; }

          const data = snapshot.data();
          const xp: number = data.LearnFunXP ?? 0;
          const studentClass = Number(data.class ?? 8);

          setProfile({
            name:                data.name ?? "Student",
            class:               studentClass,
            level:               getLevelFromXP(xp),
            xp,
            // coins now reflects V-Coins balance (read from users doc via useVCoins elsewhere)
            // keeping the field here as 0 so CoinXPBar doesn't break — it will be fed vCoins
            coins:               data.vCoins ?? 0,
            streak:              data.LearnFunStreak ?? 0,
            badges:              data.LearnFunBadges ?? [],
            completedMissionIds: data.LearnFunCompletedMissions ?? [],
            weakSkill:           data.LearnFunWeakSkill ?? undefined,
          });

          setMissionPlayedToday(data.LearnFunLastMissionDate === todayStr);
          loadGamesForClass(studentClass);
          loadTodaysMission(studentClass);
          setLoading(false);
        },
        (err) => {
          console.error("[useLearnFun] snapshot error:", err);
          setError("Failed to load profile");
          setLoading(false);
        }
      );
    });

    return () => { unsubAuth(); if (unsubSnap) unsubSnap(); };
  }, [todayStr, loadGamesForClass, loadTodaysMission]);

  // ── Complete Mission ───────────────────────────────────────────────────────
  const completeMission = useCallback(
    async (missionId: string, score: number, badgeEarned?: string) => {
      const user = auth.currentUser;
      if (!user || !todaysMission) return;

      const earnedXP = Math.round((todaysMission.reward.xp * score) / 100);

      try {
        // 1. Update student XP + streak + badges (NO coins here — V-Coins handled below)
        const studentUpdate: Record<string, unknown> = {
          LearnFunXP:                increment(earnedXP),
          LearnFunStreak:            increment(1),
          LearnFunLastMissionDate:   todayStr,
          LearnFunCompletedMissions: arrayUnion(missionId),
        };
        if (badgeEarned) studentUpdate.LearnFunBadges = arrayUnion(badgeEarned);
        await updateDoc(doc(db, "students", user.uid), studentUpdate);

        // 2. Award V-Coins via Cloud Function (handles dedup + yearlyVCoins + Redis lock)
        //    activityId "lesson_complete" = 10 V-Coins, max 5/day
        //    referenceId = missionId prevents double-awarding same mission
        try {
          await claimVCoinRewardCF({
            activityId:  "lesson_complete",
            referenceId: missionId,
          });
        } catch (vcErr: any) {
          // "already-exists" or "resource-exhausted" = daily limit hit — silent, not an error
          if (vcErr?.code !== "already-exists" && vcErr?.code !== "resource-exhausted") {
            console.warn("[useLearnFun] V-Coin claim failed:", vcErr?.message);
          }
        }

        // 3. Save individual mission progress
        await setDoc(
          doc(db, "studentLearnFunProgress", user.uid, "missions", missionId),
          {
            missionId,
            missionTitle:  todaysMission.missionTitle,
            skill:         todaysMission.skill,
            gameType:      todaysMission.gameType,
            score,
            xpEarned:      earnedXP,
            completedAt:   Timestamp.now(),
            badgeEarned:   badgeEarned ?? null,
            studentClass:  profile?.class ?? 0,
          }
        );
      } catch (err) {
        console.error("[useLearnFun] completeMission error:", err);
      }
    },
    [todaysMission, profile, todayStr]
  );

  return {
    profile,
    todaysMission,
    visibleGames,
    skillWorlds,
    allBadges,
    completeMission,
    missionPlayedToday,
    loading,
    error,
  };
}
