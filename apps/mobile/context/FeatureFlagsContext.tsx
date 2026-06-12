// PATH: context/FeatureFlagsContext.tsx

import { useStudentProfile } from "@/context/StudentProfileContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";

// ─── Home section flags ────────────────────────────────────────────────────
const ALL_HOME_FLAGS = {
  stories: true, aiguru: true,
  creator_reels: true,
  skillshorts: true,
  skillbattle: true,
  home_ads: true, vidya_star: true, seekho_preview: true,
  scholarship_ad: true, discover_preview: true, knowledge_hub: true,
  learning: true, feed_posts: true, feed_ads: true,
  referral: true,
};

// ─── AI Guru feature flags ─────────────────────────────────────────────────
const ALL_AI_FLAGS = {
  dashboard: true, vidyaguru: true, generate: true, my_lessons: true,
  revision_reels: true, practice_tests: true, ask_aiguru: true,
  discover: true, subscription: true,
  photo_solve: true, exam_simulator: true, voice_tutor: true,
  notebook: true,
};

// ─── Drawer item flags ─────────────────────────────────────────────────────
// Each key matches the drawer item key used in _layout.tsx drawerItem() calls
const ALL_DRAWER_FLAGS = {
  home:        true,   // Home (always on — can't be hidden)
  leaderboard: true,
  wallet:      true,
  settings:    true,
  dashboard:   true,
  aiguru:      true,
  learnfun:    true,
  language:    true,
  skillboard:  true,
};

// ─── Context type ──────────────────────────────────────────────────────────
type FeatureFlagsContextType = {
  homeSection:  (key: string) => boolean;
  aiGuru:       (key: string) => boolean;
  drawerItem:   (key: string) => boolean;
  homeFlags:    Record<string, boolean>;
  drawerFlags:  Record<string, boolean>;
  isTester:     boolean;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  homeSection:  () => true,
  aiGuru:       () => true,
  drawerItem:   () => true,
  homeFlags:    {},
  drawerFlags:  {},
  isTester:     false,
});

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { studentProfile } = useStudentProfile();

  const [homeFlags,   setHomeFlags]   = useState<Record<string, boolean>>(ALL_HOME_FLAGS);
  const [aiFlags,     setAiFlags]     = useState<Record<string, boolean>>(ALL_AI_FLAGS);
  const [drawerFlags, setDrawerFlags] = useState<Record<string, boolean>>(ALL_DRAWER_FLAGS);

  const isTester = studentProfile?.role === "tester" || studentProfile?.role === "admin";

  useEffect(() => {
    // ── Home section flags ─────────────────────────────────────────────────
    const unsubHome = onSnapshot(
      doc(db, "featureFlags", "homeSection"),
      (snap) => {
        if (snap.exists()) {
          setHomeFlags({ ...ALL_HOME_FLAGS, ...snap.data() });
        } else {
          setDoc(doc(db, "featureFlags", "homeSection"), ALL_HOME_FLAGS).catch(() => {});
          setHomeFlags(ALL_HOME_FLAGS);
        }
      },
      () => setHomeFlags(ALL_HOME_FLAGS)
    );

    // ── AI Guru flags ──────────────────────────────────────────────────────
    const unsubAi = onSnapshot(
      doc(db, "featureFlags", "aiGuru"),
      (snap) => {
        if (snap.exists()) {
          setAiFlags({ ...ALL_AI_FLAGS, ...snap.data() });
        } else {
          setDoc(doc(db, "featureFlags", "aiGuru"), ALL_AI_FLAGS).catch(() => {});
          setAiFlags(ALL_AI_FLAGS);
        }
      },
      () => setAiFlags(ALL_AI_FLAGS)
    );

    // ── Drawer item flags ──────────────────────────────────────────────────
    const unsubDrawer = onSnapshot(
      doc(db, "featureFlags", "drawerItems"),
      (snap) => {
        if (snap.exists()) {
          setDrawerFlags({ ...ALL_DRAWER_FLAGS, ...snap.data() });
        } else {
          setDoc(doc(db, "featureFlags", "drawerItems"), ALL_DRAWER_FLAGS).catch(() => {});
          setDrawerFlags(ALL_DRAWER_FLAGS);
        }
      },
      () => setDrawerFlags(ALL_DRAWER_FLAGS)
    );

    return () => { unsubHome(); unsubAi(); unsubDrawer(); };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{
      homeSection:  (key) => isTester ? true : (homeFlags[key]   ?? true),
      aiGuru:       (key) => isTester ? true : (aiFlags[key]     ?? true),
      drawerItem:   (key) => key === "home" ? true : isTester ? true : (drawerFlags[key] ?? true),
      homeFlags,
      drawerFlags,
      isTester,
    }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}
