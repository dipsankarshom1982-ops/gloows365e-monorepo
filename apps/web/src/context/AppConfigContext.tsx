"use client";

// PATH: apps/web/src/context/AppConfigContext.tsx

import * as React from "react";
import {
  getFirestore,
  collection, doc, getDocs, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";

export type AppModule = {
  id: string;
  name: string;
  icon: string;
  order: number;
  isEnabled: boolean;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  emoji: string;
  monthlyPrice: number;
  annualPrice: number;
  annualMonthly: number;
  features: string[];
  gradient: [string, string];
  highlight: boolean;
  isActive: boolean;
  order: number;
  module?: string; // "aiGuru" | "seekho" | "discover" — filters plans by product area
};

// AI Guru pay-as-you-go credit packs — coexists with SubscriptionPlan
// above, same Firestore-driven admin-config pattern (see apps/admin/src/
// pages/AiGuruCredits.tsx). Mirrors apps/mobile's CreditPack type exactly.
export type CreditPack = {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  credits: number;
  bonusCredits: number;
  pricePaise: number;
  gradient: [string, string];
  highlight: boolean;
  isActive: boolean;
  order: number;
};

interface CtxType {
  modules: AppModule[];
  plans: SubscriptionPlan[];
  creditPacks: CreditPack[];
  configLoading: boolean;
  /** True once appModules has delivered a snapshot (or its fail-open
   *  fallback) for the CURRENT uid — route gates wait on this instead of
   *  judging the DEFAULT_MODULES placeholder (all enabled). */
  modulesResolved: boolean;
}

const DEFAULT_MODULES: AppModule[] = [
  { id: "home",        name: "Home",        icon: "home",          order: 1, isEnabled: true },
  { id: "ai-guru",     name: "AI Guru",     icon: "school-outline",order: 2, isEnabled: true },
  { id: "shikshahub",  name: "ShikshaHub",  icon: "school",        order: 3, isEnabled: true },
  { id: "skillbattle", name: "Skill Battle",icon: "trophy",        order: 4, isEnabled: true },
  { id: "vidyastar",   name: "VidyaStar",   icon: "star",          order: 5, isEnabled: true },
];

const AppConfigContext = React.createContext<CtxType>({
  modules: DEFAULT_MODULES,
  plans: [],
  creditPacks: [],
  configLoading: false,
  modulesResolved: true,
});

export const useAppConfig = () => React.useContext(AppConfigContext);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useStudentProfile();
  const [modules,       setModules]       = React.useState<AppModule[]>(DEFAULT_MODULES);
  const [plans,         setPlans]         = React.useState<SubscriptionPlan[]>([]);
  const [creditPacks,   setCreditPacks]   = React.useState<CreditPack[]>([]);
  const [configLoading, setConfigLoading] = React.useState(false);
  const [modulesLoadedFor, setModulesLoadedFor] = React.useState<string | null>(null);

  // Tester/admin bypass — role lives on users/{uid}.role, NOT on the
  // students/{uid} profile doc useStudentProfile() reads (that doc is
  // always written role:"student" at signup and never updated — see
  // packages/shared-logic/src/context/FeatureFlagsContext.tsx and
  // apps/mobile/context/AppConfigContext.tsx, which already read
  // users/{uid} for exactly this reason). This used to read
  // studentProfile?.role here, which meant isTester was always false and
  // Learn/Challenge module visibility + subscriptionPlans/aiGuruCreditPacks
  // gating never actually bypassed for testers on web.
  const [isTester, setIsTester] = React.useState(false);

  React.useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setIsTester(false); return; }
    const db = getFirestore();
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

  React.useEffect(() => {
    // ⚠️ Don't fire Firestore queries until Firebase Auth has actually
    // resolved and attached its token to the Firestore client. Doing this
    // right after a sign-in redirect/popup can race the SDK and throw a
    // one-off permission-denied that permanently kills this listener for
    // the session (Firestore does not auto-retry permission-denied). See
    // StudentProfileContext, which correctly waits on onAuthStateChanged.
    if (authLoading) return;
    if (!user) {
      setModules(DEFAULT_MODULES);
      setConfigLoading(false);
      return;
    }

    const db = getFirestore();
    setConfigLoading(true);
    const uid = user.uid;
    // No-op once this run is superseded (user switch / tester flip), so a
    // late fallback can't mark the previous uid's modules as current.
    const markModulesLoaded = () => { if (cancelled) return; setConfigLoading(false); setModulesLoadedFor(uid); };

    let cancelled = false;
    let unsub: (() => void) | null = null;

    // ⚠️ On slower/higher-latency connections (mobile data especially),
    // Firebase Auth reporting "user is ready" client-side can still
    // outrace the ID token actually being attached to Firestore's
    // request pipeline — so even after the authLoading/user gate above,
    // the very first attempt can still get permission-denied. Since
    // Firestore listeners don't auto-retry that error, retry ourselves
    // (forcing a fresh token first) before giving up and showing the
    // fail-open default.
    const attemptSubscribe = (retriesLeft: number) => {
      if (cancelled) return;

      if (isTester) {
        unsub = onSnapshot(
          query(collection(db, "appModules"), orderBy("order", "asc")),
          (snap) => {
            setModules(snap.docs.map((d) => ({ id: d.id, ...d.data(), isEnabled: true } as AppModule)));
            markModulesLoaded();
          },
          async () => {
            if (retriesLeft > 0) {
              try { await user.getIdToken(true); } catch {}
              setTimeout(() => attemptSubscribe(retriesLeft - 1), 1000);
              return;
            }
            try {
              const snap = await getDocs(collection(db, "appModules"));
              setModules(snap.docs
                .map((d) => ({ id: d.id, ...d.data(), isEnabled: true } as AppModule))
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            } catch { setModules(DEFAULT_MODULES); }
            markModulesLoaded();
          }
        );
      } else {
        // Normal user: fetch ALL modules (not just isEnabled==true), leaving
        // the raw isEnabled value intact. Learn/Challenge (app)/learn and
        // (app)/challenge pages use `modules.find(m => m.id === key)
        // ?.isEnabled !== false`, which treats "no doc" as visible on
        // purpose. With the old isEnabled-filtered query a DISABLED module
        // was also simply absent, so it looked identical to "no doc" and
        // stayed visible — disabling it in Admin > App Structure had no
        // effect on web.
        //
        // No orderBy("order") here on purpose: Firestore silently drops any
        // document that lacks the ordered field, and Admin > App Structure
        // creates a module's doc on first toggle as just { name, isEnabled }
        // (no `order`). With orderBy, those docs never reached this client,
        // so the module looked "unconfigured" and stayed visible. Sort
        // client-side instead (missing order sorts as 0).
        unsub = onSnapshot(
          collection(db, "appModules"),
          (snap) => {
            const fresh = snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as AppModule))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setModules(fresh.length > 0 ? fresh : DEFAULT_MODULES);
            markModulesLoaded();
          },
          async () => {
            if (retriesLeft > 0) {
              try { await user.getIdToken(true); } catch {}
              setTimeout(() => attemptSubscribe(retriesLeft - 1), 1000);
              return;
            }
            try {
              const snap = await getDocs(collection(db, "appModules"));
              const fresh = snap.docs
                .map((d) => ({ id: d.id, ...d.data() } as AppModule))
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              setModules(fresh.length > 0 ? fresh : DEFAULT_MODULES);
            } catch { setModules(DEFAULT_MODULES); }
            markModulesLoaded();
          }
        );
      }
    };

    attemptSubscribe(3);

    return () => { cancelled = true; unsub?.(); };
  }, [isTester, user, authLoading]);

  const modulesResolved = !authLoading && (!user || modulesLoadedFor === user.uid);

  // ── subscriptionPlans listener — same collection/shape as mobile,
  // admin-managed, filtered to isActive==true and ordered for display.
  React.useEffect(() => {
    const db = getFirestore();
    const unsubPlans = onSnapshot(
      query(collection(db, "subscriptionPlans"), where("isActive", "==", true), orderBy("order", "asc")),
      (snap) => {
        setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubscriptionPlan)));
      },
      async () => {
        try {
          const snap = await getDocs(query(collection(db, "subscriptionPlans"), where("isActive", "==", true)));
          setPlans(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as SubscriptionPlan))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          );
        } catch { setPlans([]); }
      }
    );
    return () => unsubPlans();
  }, []);

  // ── aiGuruCreditPacks listener — same shape/conventions as
  // subscriptionPlans above; coexists with it, doesn't replace it.
  React.useEffect(() => {
    const db = getFirestore();
    const unsubPacks = onSnapshot(
      query(collection(db, "aiGuruCreditPacks"), where("isActive", "==", true), orderBy("order", "asc")),
      (snap) => {
        setCreditPacks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CreditPack)));
      },
      async () => {
        try {
          const snap = await getDocs(query(collection(db, "aiGuruCreditPacks"), where("isActive", "==", true)));
          setCreditPacks(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as CreditPack))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          );
        } catch { setCreditPacks([]); }
      }
    );
    return () => unsubPacks();
  }, []);

  return (
    <AppConfigContext.Provider value={{ modules, plans, creditPacks, configLoading, modulesResolved }}>
      {children}
    </AppConfigContext.Provider>
  );
}
