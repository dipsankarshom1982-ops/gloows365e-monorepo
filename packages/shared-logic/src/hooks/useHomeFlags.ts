"use client";

// PATH: packages/shared-logic/src/hooks/useHomeFlags.ts
// Live listener on featureFlags/homeSection — the single source of truth for
// which home sections render, on BOTH mobile and web.
//
// defaultValue controls what missing keys mean:
//   - web passes true  (missing key → section visible; `?? false` silently
//     hides sections from everyone — learned the hard way)
//   - mobile's FeatureFlagsContext historically used false; during Phase 2
//     migration mobile can pass false to preserve its exact behavior, then
//     we align both on true once the admin FeatureControl doc has all keys.

import { useCallback, useEffect, useState } from "react";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";

export interface HomeFlagsResult {
  /** Check a single section key, e.g. homeSection("stories") */
  homeSection: (key: string) => boolean;
  /** Raw flags doc — useful as a memo/extraData dependency */
  homeFlags: Record<string, boolean>;
  loading: boolean;
}

export function useHomeFlags(defaultValue: boolean = true): HomeFlagsResult {
  const [homeFlags, setHomeFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore();
    const unsub = onSnapshot(
      doc(db, "featureFlags", "homeSection"),
      (snap) => {
        setHomeFlags(snap.exists() ? (snap.data() as Record<string, boolean>) : {});
        setLoading(false);
      },
      () => {
        setHomeFlags({});
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const homeSection = useCallback(
    (key: string) => homeFlags[key] ?? defaultValue,
    [homeFlags, defaultValue]
  );

  return { homeSection, homeFlags, loading };
}
