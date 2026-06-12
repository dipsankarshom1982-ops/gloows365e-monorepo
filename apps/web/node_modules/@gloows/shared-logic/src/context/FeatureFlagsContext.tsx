"use client";

// packages/shared-logic/src/context/FeatureFlagsContext.tsx
//
// ✅ Shared — identical behaviour on mobile and web.
// Reads 3 Firestore docs: featureFlags/homeSection, aiGuru, drawerItems

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getSharedDb } from "../lib/firebaseConfig";
import { useStudentProfile } from "./StudentProfileContext";

interface HomeSectionFlags {
  showSkillBattle?: boolean;
  showShortReels?: boolean;
  showLearnFun?: boolean;
  showAiGuru?: boolean;
  showDiscover?: boolean;
  showVidyaStar?: boolean;
}

interface AiGuruFlags {
  photoSolveEnabled?: boolean;
  examSimulatorEnabled?: boolean;
  voiceTutorEnabled?: boolean;
  notebookEnabled?: boolean;
}

interface DrawerItemFlags {
  showWallet?: boolean;
  showReferral?: boolean;
  showLeaderboard?: boolean;
  showRestartEducation?: boolean;
}

interface FeatureFlagsContextType {
  homeFlags: HomeSectionFlags;
  aiGuruFlags: AiGuruFlags;
  drawerFlags: DrawerItemFlags;
  loading: boolean;
  homeSection: (key: keyof HomeSectionFlags) => boolean;
  aiGuruFeature: (key: keyof AiGuruFlags) => boolean;
  drawerItem: (key: keyof DrawerItemFlags) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  homeFlags: {}, aiGuruFlags: {}, drawerFlags: {}, loading: true,
  homeSection: () => true,
  aiGuruFeature: () => true,
  drawerItem: () => true,
});

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { studentProfile } = useStudentProfile();
  const [homeFlags, setHomeFlags]     = useState<HomeSectionFlags>({});
  const [aiGuruFlags, setAiGuruFlags] = useState<AiGuruFlags>({});
  const [drawerFlags, setDrawerFlags] = useState<DrawerItemFlags>({});
  const [loading, setLoading]         = useState(true);

  const isBypass = studentProfile?.role === "admin" || studentProfile?.role === "tester";

  useEffect(() => {
    if (isBypass) { setLoading(false); return; }
    const db = getSharedDb();
    let loaded = 0;
    const check = () => { if (++loaded === 3) setLoading(false); };

    const u1 = onSnapshot(doc(db, "featureFlags", "homeSection"),  (s) => { if (s.exists()) setHomeFlags(s.data() as HomeSectionFlags);   check(); }, check);
    const u2 = onSnapshot(doc(db, "featureFlags", "aiGuru"),       (s) => { if (s.exists()) setAiGuruFlags(s.data() as AiGuruFlags);      check(); }, check);
    const u3 = onSnapshot(doc(db, "featureFlags", "drawerItems"),  (s) => { if (s.exists()) setDrawerFlags(s.data() as DrawerItemFlags);  check(); }, check);

    return () => { u1(); u2(); u3(); };
  }, [isBypass]);

  const homeSection   = (key: keyof HomeSectionFlags)  => isBypass ? true : (homeFlags[key]   ?? true);
  const aiGuruFeature = (key: keyof AiGuruFlags)        => isBypass ? true : (aiGuruFlags[key] ?? true);
  const drawerItem    = (key: keyof DrawerItemFlags)    => isBypass ? true : (drawerFlags[key] ?? true);

  return (
    <FeatureFlagsContext.Provider value={{ homeFlags, aiGuruFlags, drawerFlags, loading, homeSection, aiGuruFeature, drawerItem }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}