"use client";

// PATH: apps/web/src/context/AppConfigContext.tsx

import * as React from "react";
import {
  getFirestore,
  collection, getDocs, onSnapshot, orderBy, query, where,
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
});

export const useAppConfig = () => React.useContext(AppConfigContext);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const { studentProfile, user, authLoading } = useStudentProfile();
  const [modules,       setModules]       = React.useState<AppModule[]>(DEFAULT_MODULES);
  const [plans,         setPlans]         = React.useState<SubscriptionPlan[]>([]);
  const [creditPacks,   setCreditPacks]   = React.useState<CreditPack[]>([]);
  const [configLoading, setConfigLoading] = React.useState(false);

  const isTester =
    studentProfile?.role === "tester" ||
    studentProfile?.role === "admin";

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
            setConfigLoading(false);
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
            setConfigLoading(false);
          }
        );
      } else {
        unsub = onSnapshot(
          query(collection(db, "appModules"), where("isEnabled", "==", true), orderBy("order", "asc")),
          (snap) => {
            const fresh = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppModule));
            setModules(fresh.length > 0 ? fresh : DEFAULT_MODULES);
            setConfigLoading(false);
          },
          async () => {
            if (retriesLeft > 0) {
              try { await user.getIdToken(true); } catch {}
              setTimeout(() => attemptSubscribe(retriesLeft - 1), 1000);
              return;
            }
            try {
              const snap = await getDocs(
                query(collection(db, "appModules"), where("isEnabled", "==", true))
              );
              const fresh = snap.docs
                .map((d) => ({ id: d.id, ...d.data() } as AppModule))
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              setModules(fresh.length > 0 ? fresh : DEFAULT_MODULES);
            } catch { setModules(DEFAULT_MODULES); }
            setConfigLoading(false);
          }
        );
      }
    };

    attemptSubscribe(3);

    return () => { cancelled = true; unsub?.(); };
  }, [isTester, user, authLoading]);

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
    <AppConfigContext.Provider value={{ modules, plans, creditPacks, configLoading }}>
      {children}
    </AppConfigContext.Provider>
  );
}
