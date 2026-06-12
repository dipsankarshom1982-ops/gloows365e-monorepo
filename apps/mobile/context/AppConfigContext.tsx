/**
 * context/AppConfigContext.tsx — FIXED
 *
 * Tester bypass:
 *   - Normal users  → only isEnabled==true modules shown (admin controlled)
 *   - Testers/admins → ALL modules shown regardless of isEnabled flag
 *
 * How it works:
 *   - Reads studentProfile.role from StudentProfileContext
 *   - If role=="tester" or "admin": fetches ALL appModules (no isEnabled filter)
 *     and forces isEnabled=true on every one before passing to consumers
 *   - Everyone else: same as before — only isEnabled==true modules
 *
 * This fixes the tab bar — disabled tabs now show for testers.
 * Also fixes any other useAppConfig() consumers (drawer, etc).
 */

import { useStudentProfile } from "@/context/StudentProfileContext";
import { db } from "@/lib/firebase";
import type { AppModule, SubscriptionPlan } from "@/services/appConfigService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection, getDocs, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";

const CACHE_VERSION     = "v2";
const CACHE_KEY_MODULES = `appConfig_modules_${CACHE_VERSION}`;
const CACHE_KEY_PLANS   = `appConfig_plans_${CACHE_VERSION}`;

type AppConfigContextType = {
  modules:       AppModule[];
  plans:         SubscriptionPlan[];
  configLoading: boolean;
};

const AppConfigContext = createContext<AppConfigContextType>({
  modules:       [],
  plans:         [],
  configLoading: true,
});

export const useAppConfig = () => useContext(AppConfigContext);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const { studentProfile } = useStudentProfile();

  const [modules,       setModules]       = useState<AppModule[]>([]);
  const [plans,         setPlans]         = useState<SubscriptionPlan[]>([]);
  const [modulesReady,  setModulesReady]  = useState(false);
  const [plansReady,    setPlansReady]    = useState(false);

  const configLoading = !modulesReady || !plansReady;

  // Is this user a tester or admin?
  const isTester =
    studentProfile?.role === "tester" ||
    studentProfile?.role === "admin";

  useEffect(() => {
    // Seed UI from versioned cache
    Promise.all([
      AsyncStorage.getItem(CACHE_KEY_MODULES),
      AsyncStorage.getItem(CACHE_KEY_PLANS),
    ]).then(([cachedMods, cachedPlans]) => {
      if (cachedMods)  setModules(JSON.parse(cachedMods));
      if (cachedPlans) setPlans(JSON.parse(cachedPlans));
    }).catch(() => {});

    // ── appModules listener ───────────────────────────────────────────────────
    let unsubModules: (() => void);

    if (isTester) {
      // Tester: fetch ALL modules (no isEnabled filter), force all enabled
      unsubModules = onSnapshot(
        query(collection(db, "appModules"), orderBy("order", "asc")),
        (snap) => {
          const fresh = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            isEnabled: true,   // force all ON for tester
          } as AppModule));
          setModules(fresh);
          setModulesReady(true);
          AsyncStorage.setItem(CACHE_KEY_MODULES, JSON.stringify(fresh)).catch(() => {});
        },
        async () => {
          // Fallback: getDocs without orderBy
          try {
            const snap = await getDocs(collection(db, "appModules"));
            const fresh = snap.docs
              .map((d) => ({ id: d.id, ...d.data(), isEnabled: true } as AppModule))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setModules(fresh);
            AsyncStorage.setItem(CACHE_KEY_MODULES, JSON.stringify(fresh)).catch(() => {});
          } catch {}
          setModulesReady(true);
        }
      );
    } else {
      // Normal user: only enabled modules
      unsubModules = onSnapshot(
        query(
          collection(db, "appModules"),
          where("isEnabled", "==", true),
          orderBy("order", "asc")
        ),
        (snap) => {
          const fresh = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppModule));
          setModules(fresh);
          setModulesReady(true);
          AsyncStorage.setItem(CACHE_KEY_MODULES, JSON.stringify(fresh)).catch(() => {});
        },
        async () => {
          // Composite index not ready — fallback to client-side filter
          try {
            const snap = await getDocs(
              query(collection(db, "appModules"), where("isEnabled", "==", true))
            );
            const fresh = snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as AppModule))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setModules(fresh);
            AsyncStorage.setItem(CACHE_KEY_MODULES, JSON.stringify(fresh)).catch(() => {});
          } catch {}
          setModulesReady(true);
        }
      );
    }

    // ── subscriptionPlans listener ────────────────────────────────────────────
    const unsubPlans = onSnapshot(
      query(
        collection(db, "subscriptionPlans"),
        where("isActive", "==", true),
        orderBy("order", "asc")
      ),
      (snap) => {
        const fresh = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubscriptionPlan));
        setPlans(fresh);
        setPlansReady(true);
        AsyncStorage.setItem(CACHE_KEY_PLANS, JSON.stringify(fresh)).catch(() => {});
      },
      async () => {
        try {
          const snap = await getDocs(
            query(collection(db, "subscriptionPlans"), where("isActive", "==", true))
          );
          const fresh = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as SubscriptionPlan))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setPlans(fresh);
          AsyncStorage.setItem(CACHE_KEY_PLANS, JSON.stringify(fresh)).catch(() => {});
        } catch {}
        setPlansReady(true);
      }
    );

    return () => {
      unsubModules();
      unsubPlans();
    };
  }, [isTester]); // re-subscribe when tester status changes (login/logout)

  return (
    <AppConfigContext.Provider value={{ modules, plans, configLoading }}>
      {children}
    </AppConfigContext.Provider>
  );
}