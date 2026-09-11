/**
 * context/AppConfigContext.tsx — FIXED
 *
 * Tester bypass:
 *   - Normal users  → only isEnabled==true modules shown (admin controlled)
 *   - Testers/admins → ALL modules shown regardless of isEnabled flag
 *
 * How it works:
 *   - Reads role off users/{uid} — NOT studentProfile.role. The tester
 *     toggle in apps/admin/src/pages/Students.tsx writes role to
 *     users/{uid}, while StudentProfileContext (studentProfile) reads a
 *     separate students/{uid} doc that never has role on it. Reading
 *     studentProfile.role here always evaluated to undefined, so testers
 *     never actually got the bypass — see functions/src/usageCheck.ts's
 *     getSubscription() for the same users/{uid} read done server-side.
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
  collection, doc, getDocs, onSnapshot, orderBy, query, where,
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
  const { user } = useStudentProfile();

  const [modules,       setModules]       = useState<AppModule[]>([]);
  const [plans,         setPlans]         = useState<SubscriptionPlan[]>([]);
  const [modulesReady,  setModulesReady]  = useState(false);
  const [plansReady,    setPlansReady]    = useState(false);

  const configLoading = !modulesReady || !plansReady;

  // Is this user a tester or admin? Role lives on users/{uid}, not on the
  // students/{uid} profile doc — see the header comment above.
  const [isTester, setIsTester] = useState(false);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setIsTester(false); return; }
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
