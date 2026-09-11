"use client";

// packages/shared-logic/src/context/FeatureFlagsContext.tsx
//
// ✅ Shared — identical behaviour on mobile and web.
// Reads 3 Firestore docs: featureFlags/homeSection, featureFlags/aiGuru,
// featureFlags/drawerItems. Keys here are plain strings and must match the
// `key`s admins toggle in apps/admin/src/pages/FeatureControl.tsx
// (HOME_SECTIONS / AIGURU_FEATURES / DRAWER_ITEMS) — e.g. "stories",
// "photo_solve", "skillboost". A key missing from a doc defaults to
// enabled (true), same as that admin page's own defaults.
//
// Tester/admin bypass: role lives on users/{uid}.role (set via
// apps/admin/src/pages/Students.tsx' tester toggle), NOT on the
// students/{uid} profile doc that useStudentProfile() reads — so this
// reads users/{uid} directly here, mirroring the same users/{uid} read in
// functions/src/usageCheck.ts's getSubscription(). Reading role off
// studentProfile instead (as this file used to) meant isTester was always
// false and testers/admins never got the bypass.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getSharedDb } from "../lib/firebaseConfig";
import { useStudentProfile } from "./StudentProfileContext";

type FlagMap = Record<string, boolean>;

interface FeatureFlagsContextType {
  homeFlags:   FlagMap;
  aiFlags:     FlagMap;
  drawerFlags: FlagMap;
  loading:     boolean;
  isTester:    boolean;
  homeSection: (key: string) => boolean;
  aiGuru:      (key: string) => boolean;
  drawerItem:  (key: string) => boolean;
}

const alwaysOn = () => true;

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  homeFlags: {}, aiFlags: {}, drawerFlags: {}, loading: true, isTester: false,
  homeSection: alwaysOn, aiGuru: alwaysOn, drawerItem: alwaysOn,
});

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useStudentProfile();
  const [homeFlags, setHomeFlags]     = useState<FlagMap>({});
  const [aiFlags, setAiFlags]         = useState<FlagMap>({});
  const [drawerFlags, setDrawerFlags] = useState<FlagMap>({});
  const [loading, setLoading]         = useState(true);
  const [isTester, setIsTester]       = useState(false);

  // ── Tester/admin bypass — users/{uid}.role ──────────────────────────────
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setIsTester(false); return; }
    const db = getSharedDb();
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const role = snap.exists() ? (snap.data()?.role as string | undefined) : undefined;
        setIsTester(role === "tester" || role === "admin");
      },
      () => setIsTester(false)
    );
    return unsub;
  }, [user?.uid]);

  // ── Flag docs — skipped for testers/admins, who bypass every check below ──
  useEffect(() => {
    if (isTester) { setLoading(false); return; }
    const db = getSharedDb();
    let loaded = 0;
    const check = () => { if (++loaded === 3) setLoading(false); };

    const u1 = onSnapshot(doc(db, "featureFlags", "homeSection"),  (s) => { if (s.exists()) setHomeFlags(s.data() as FlagMap);   check(); }, check);
    const u2 = onSnapshot(doc(db, "featureFlags", "aiGuru"),       (s) => { if (s.exists()) setAiFlags(s.data() as FlagMap);     check(); }, check);
    const u3 = onSnapshot(doc(db, "featureFlags", "drawerItems"),  (s) => { if (s.exists()) setDrawerFlags(s.data() as FlagMap); check(); }, check);

    return () => { u1(); u2(); u3(); };
  }, [isTester]);

  const homeSection = (key: string) => isTester ? true : (homeFlags[key]   ?? true);
  const aiGuru      = (key: string) => isTester ? true : (aiFlags[key]     ?? true);
  const drawerItem  = (key: string) => key === "home" ? true : isTester ? true : (drawerFlags[key] ?? true);

  return (
    <FeatureFlagsContext.Provider value={{ homeFlags, aiFlags, drawerFlags, loading, isTester, homeSection, aiGuru, drawerItem }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}
