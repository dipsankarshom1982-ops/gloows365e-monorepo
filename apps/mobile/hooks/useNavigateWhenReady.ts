// PATH: apps/mobile/hooks/useNavigateWhenReady.ts
//
// Binds lib/navGuard.ts's navigateWhenReady() to expo-router's root
// navigation container, so guard redirects wait until the Root Layout's
// navigator is mounted instead of throwing (see lib/navGuard.ts).
//
// Usage inside a guard's effect — return the cancel function:
//   useEffect(() => {
//     if (state !== "blocked") return;
//     return navigateWhenReady(() => router.replace("/login"));
//   }, [state, navigateWhenReady]);

import { useCallback } from "react";
import { useNavigationContainerRef } from "expo-router";
import { navigateWhenReady as runWhenReady } from "@/lib/navGuard";

export function useNavigateWhenReady(): (navigate: () => void) => () => void {
  const navigationRef = useNavigationContainerRef();
  return useCallback(
    (navigate: () => void) =>
      runWhenReady(() => navigationRef.isReady(), navigate, {
        onGiveUp: () => console.warn("[navGuard] navigator never became ready; redirect dropped"),
      }),
    [navigationRef]
  );
}
