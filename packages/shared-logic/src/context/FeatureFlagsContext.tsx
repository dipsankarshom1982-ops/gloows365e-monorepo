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
import { isFeatureHiddenForClass } from "../education/classFeatureGates";

type FlagMap = Record<string, boolean>;

interface FeatureFlagsContextType {
  homeFlags:   FlagMap;
  aiFlags:     FlagMap;
  drawerFlags: FlagMap;
  loading:     boolean;
  isTester:    boolean;
  /** False until auth has resolved and the users/{uid}.role snapshot has
   *  arrived — route gates must not redirect before this is true, or a
   *  tester on a hard page load is treated as a normal user for a moment. */
  roleResolved: boolean;
  /** False until the three featureFlags docs have each delivered a first
   *  snapshot (or error) on a listener opened for the CURRENT uid. `loading`
   *  can't be used for this: it goes false once for the signed-out
   *  (permission-denied) listener at mount and never resets on login, so
   *  gates reading it would decide on flags that never loaded. Testers
   *  don't load flags (they bypass them), so this is only meaningful for
   *  normal users — route gates check isTester first. */
  flagsResolved: boolean;
  homeSection: (key: string) => boolean;
  aiGuru:      (key: string) => boolean;
  drawerItem:  (key: string) => boolean;
}

const alwaysOn = () => true;

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  homeFlags: {}, aiFlags: {}, drawerFlags: {}, loading: true, isTester: false, roleResolved: true, flagsResolved: true,
  homeSection: alwaysOn, aiGuru: alwaysOn, drawerItem: alwaysOn,
});

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user, studentProfile, authLoading } = useStudentProfile();
  const [roleLoadedFor, setRoleLoadedFor] = useState<string | null>(null);
  const [flagsLoadedFor, setFlagsLoadedFor] = useState<string | null>(null);
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
    // New uid → never carry the previous user's tester bypass over while this
    // user's role snapshot is in flight (roleResolved is already false in
    // that window; this keeps the feature helpers from bypassing too).
    setIsTester(false);
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const role = snap.exists() ? (snap.data()?.role as string | undefined) : undefined;
        setIsTester(role === "tester" || role === "admin");
        setRoleLoadedFor(uid);
      },
      () => { setIsTester(false); setRoleLoadedFor(uid); }
    );
    return unsub;
  }, [user?.uid]);

  const roleResolved = !authLoading && (!user?.uid || roleLoadedFor === user.uid);
  const flagsResolved = !authLoading && (!user?.uid || flagsLoadedFor === user.uid);

  // ── Flag docs — skipped for testers/admins, who bypass every check below ──
  useEffect(() => {
    if (isTester) { setLoading(false); return; }
    const db = getSharedDb();
    const uid = user?.uid ?? null;
    // Count each doc once — later live snapshots of one doc must not stand
    // in for another doc's first snapshot.
    const arrived = new Set<string>();
    const check = (id: string) => () => {
      arrived.add(id);
      if (arrived.size === 3) { setLoading(false); setFlagsLoadedFor(uid); }
    };
    const onHome   = check("homeSection");
    const onAi     = check("aiGuru");
    const onDrawer = check("drawerItems");

    // A missing doc means "all defaults" — reset rather than keep whatever
    // an earlier listener left in state.
    const u1 = onSnapshot(doc(db, "featureFlags", "homeSection"),  (s) => { setHomeFlags(s.exists() ? s.data() as FlagMap : {});   onHome(); },   onHome);
    const u2 = onSnapshot(doc(db, "featureFlags", "aiGuru"),       (s) => { setAiFlags(s.exists() ? s.data() as FlagMap : {});     onAi(); },     onAi);
    const u3 = onSnapshot(doc(db, "featureFlags", "drawerItems"),  (s) => { setDrawerFlags(s.exists() ? s.data() as FlagMap : {}); onDrawer(); }, onDrawer);

    return () => { u1(); u2(); u3(); };
    // user?.uid: featureFlags/* need an authenticated read. A listener opened while signed out
    // (this provider mounts above the login screens) is rejected with permission-denied and is
    // never retried, so re-subscribe whenever the signed-in user changes.
  }, [isTester, user?.uid]);

  // Class 3–5 never see Discover (a college/career advisor whose server route
  // returns 403 for them). Applied before the tester bypass so a Class 3–5 test
  // account sees the same experience a real Class 3–5 student does.
  const studentClass = studentProfile?.class;
  const homeSection = (key: string) => isFeatureHiddenForClass("homeSection", key, studentClass) ? false : isTester ? true : (homeFlags[key] ?? true);
  const aiGuru      = (key: string) => isFeatureHiddenForClass("aiGuru", key, studentClass)      ? false : isTester ? true : (aiFlags[key]   ?? true);
  const drawerItem  = (key: string) => key === "home" ? true : isTester ? true : (drawerFlags[key] ?? true);

  return (
    <FeatureFlagsContext.Provider value={{ homeFlags, aiFlags, drawerFlags, loading, isTester, roleResolved, flagsResolved, homeSection, aiGuru, drawerItem }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}
