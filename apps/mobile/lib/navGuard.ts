// PATH: apps/mobile/lib/navGuard.ts
//
// Pure helpers for the mobile route guards (OnboardingGuard, RouteGate,
// useModuleGate, useAiGuruFeatureGate, the (drawer) layout). No React or
// expo-router imports, so scripts/test-nav-guards.ts can exercise them in Node.
//
// Why: the guards redirected straight from useEffect. expo-router throws
// "Attempted to navigate before mounting the Root Layout component" whenever
// router.* runs while navigationRef.isReady() is false — which happens on a
// fresh MainActivity mount (deep link / relaunch) — and the ErrorBoundary then
// replaced the whole app with "Something went wrong" (physical-device QA,
// 2026-10-03). The guards also treated `user === null` as signed out before
// Firebase Auth had restored the session, so a signed-in student could be
// bounced to /login during that same window.

/** expo-router's message when navigation runs before the root navigator mounts. */
export const ROOT_NOT_MOUNTED = /navigate before mounting the Root Layout/;

/** Auth decision for a guard. "loading" = Firebase Auth hasn't reported yet:
 *  render a placeholder, never protected content, and never redirect. */
export type AuthGateState = "loading" | "signed-out" | "signed-in";

export function authGate(authLoading: boolean, signedIn: boolean): AuthGateState {
  if (authLoading) return "loading";
  return signedIn ? "signed-in" : "signed-out";
}

export interface NavigateWhenReadyOptions {
  intervalMs?: number;
  maxWaitMs?: number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
  onGiveUp?: () => void;
}

/**
 * Runs `navigate` once the root navigator is ready. Retries (every
 * `intervalMs`, up to `maxWaitMs`) while `isReady()` is false or `navigate`
 * throws expo-router's not-mounted error; any other error is rethrown.
 * Returns a cancel function — guards return it from useEffect so a pending
 * redirect is dropped when the guard unmounts or its decision changes.
 */
export function navigateWhenReady(isReady: () => boolean, navigate: () => void, opts: NavigateWhenReadyOptions = {}): () => void {
  const {
    intervalMs = 50,
    maxWaitMs = 10000,
    schedule = (fn, ms) => setTimeout(fn, ms),
    cancelSchedule = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    onGiveUp,
  } = opts;
  let cancelled = false;
  let handle: unknown = null;
  let waited = 0;
  const attempt = () => {
    handle = null;
    if (cancelled) return;
    if (isReady()) {
      try {
        navigate();
        return;
      } catch (e) {
        if (!(e instanceof Error) || !ROOT_NOT_MOUNTED.test(e.message)) throw e;
      }
    }
    if (waited >= maxWaitMs) { onGiveUp?.(); return; }
    waited += intervalMs;
    handle = schedule(attempt, intervalMs);
  };
  attempt();
  return () => {
    cancelled = true;
    if (handle !== null) cancelSchedule(handle);
  };
}
