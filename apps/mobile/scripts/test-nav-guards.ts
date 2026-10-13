// Regression tests for lib/navGuard.ts (no test runner in apps/mobile — run with
//   npx tsx scripts/test-nav-guards.ts
// ). Exits non-zero on the first failure. Covers the two device-QA defects:
//  - guard redirects must wait for the root navigator instead of throwing
//    "Attempted to navigate before mounting the Root Layout component";
//  - a session that is still restoring must never be treated as signed out.
import { authGate, navigateWhenReady, ROOT_NOT_MOUNTED } from "../lib/navGuard";

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`FAIL ${name}`); process.exit(1); }
  passed++; console.log(`ok   ${name}`);
}
// Deterministic scheduler: queue callbacks, run them on demand.
function fakeClock() {
  const q: (() => void)[] = [];
  return { schedule: (fn: () => void) => { q.push(fn); return q.length; }, cancelSchedule: () => { q.length = 0; }, tick: () => { const f = q.shift(); if (f) f(); }, pending: () => q.length };
}
const NOT_MOUNTED = new Error("Attempted to navigate before mounting the Root Layout component. Ensure the Root Layout component is rendering a Slot, or other navigator on the first render.");

// authGate
check("authGate: restoring session is 'loading', not signed out", authGate(true, false) === "loading");
check("authGate: restoring session with user is still 'loading'", authGate(true, true) === "loading");
check("authGate: resolved, no user → signed-out", authGate(false, false) === "signed-out");
check("authGate: resolved, user → signed-in", authGate(false, true) === "signed-in");
check("ROOT_NOT_MOUNTED matches expo-router's message", ROOT_NOT_MOUNTED.test(NOT_MOUNTED.message));

// navigateWhenReady: ready immediately → navigates once, synchronously
{ let n = 0; const c = fakeClock(); navigateWhenReady(() => true, () => { n++; }, c); check("ready: navigates immediately, once", n === 1 && c.pending() === 0); }

// not ready → waits, navigates when ready
{ let ready = false, n = 0; const c = fakeClock(); navigateWhenReady(() => ready, () => { n++; }, c);
  check("not ready: does not navigate yet", n === 0 && c.pending() === 1);
  c.tick(); check("still not ready: keeps waiting", n === 0 && c.pending() === 1);
  ready = true; c.tick(); check("becomes ready: navigates exactly once", n === 1 && c.pending() === 0); }

// isReady() lies (true) but expo-router still throws not-mounted → retried, never thrown
{ let throwsLeft = 2, n = 0; const c = fakeClock();
  let threw = false;
  try { navigateWhenReady(() => true, () => { if (throwsLeft-- > 0) throw NOT_MOUNTED; n++; }, c); } catch { threw = true; }
  check("not-mounted error is caught (no crash)", !threw && n === 0 && c.pending() === 1);
  c.tick(); c.tick(); check("retries until navigation succeeds", n === 1 && c.pending() === 0); }

// unrelated errors are NOT swallowed
{ const c = fakeClock(); let threw = false;
  try { navigateWhenReady(() => true, () => { throw new Error("boom"); }, c); } catch (e) { threw = (e as Error).message === "boom"; }
  check("other navigation errors are rethrown", threw); }

// cancel drops a pending redirect (guard unmounted / decision changed)
{ let n = 0; const c = fakeClock(); const cancel = navigateWhenReady(() => false, () => { n++; }, c);
  cancel(); c.tick(); check("cancel prevents a pending redirect", n === 0); }

// gives up after maxWaitMs without throwing
{ let gaveUp = false, n = 0; const c = fakeClock();
  navigateWhenReady(() => false, () => { n++; }, { ...c, intervalMs: 50, maxWaitMs: 200, onGiveUp: () => { gaveUp = true; } });
  for (let i = 0; i < 10; i++) c.tick();
  check("gives up after maxWaitMs (no crash, no navigation)", gaveUp && n === 0 && c.pending() === 0); }

console.log(`\n${passed} passed`);
