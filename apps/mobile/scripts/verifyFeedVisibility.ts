// PATH: apps/mobile/scripts/verifyFeedVisibility.ts
//
// Regression check for lib/feedVisibility.ts's isPubliclyVisible() — the
// public Skill Battle feed's sole gating logic (see that file's own
// header for the security context). apps/mobile has no Jest/RTL test
// runner installed (confirmed: no "test" script, no jest/testing-library
// dependency in package.json) and adding one is out of scope for this
// fix, so this is a plain, dependency-free assertion script run via
// `npx tsx` — the SAME tool this package already uses for its seed
// scripts (see package.json's "seed:*" entries). Exits non-zero on any
// failure so it can be wired into CI later without further changes.
//
// Run: npx tsx scripts/verifyFeedVisibility.ts

import { isPubliclyVisible } from "../lib/feedVisibility";

let failures = 0;

function expect(description: string, actual: boolean, expected: boolean) {
  if (actual === expected) {
    console.log(`  ✓ ${description}`);
  } else {
    failures++;
    console.error(`  ✗ ${description} — expected ${expected}, got ${actual}`);
  }
}

console.log("Skill Battle public feed visibility — regression matrix\n");

console.log("Skill Battle content (isSkillBattle: true):");
expect("pending is NOT publicly visible",              isPubliclyVisible({ isSkillBattle: true, status: "pending" }),               false);
expect("in_review is NOT publicly visible",             isPubliclyVisible({ isSkillBattle: true, status: "in_review" }),              false);
expect("PENDING_HUMAN_REVIEW is NOT publicly visible",  isPubliclyVisible({ isSkillBattle: true, status: "PENDING_HUMAN_REVIEW" }),   false);
expect("pending_moderation is NOT publicly visible",    isPubliclyVisible({ isSkillBattle: true, status: "pending_moderation" }),     false);
expect("moderation_processing is NOT publicly visible", isPubliclyVisible({ isSkillBattle: true, status: "moderation_processing" }),  false);
expect("rejected is NOT publicly visible",              isPubliclyVisible({ isSkillBattle: true, status: "rejected" }),               false);
expect("removed is NOT publicly visible",               isPubliclyVisible({ isSkillBattle: true, status: "removed" }),                false);
expect("appealed is NOT publicly visible",              isPubliclyVisible({ isSkillBattle: true, status: "appealed" }),               false);
expect("request_changes is NOT publicly visible",       isPubliclyVisible({ isSkillBattle: true, status: "request_changes" }),        false);
expect("an unknown/malformed status is NOT publicly visible", isPubliclyVisible({ isSkillBattle: true, status: "banana" }),           false);
expect("a missing status is NOT publicly visible",      isPubliclyVisible({ isSkillBattle: true, status: undefined }),                false);
expect("a null status is NOT publicly visible",         isPubliclyVisible({ isSkillBattle: true, status: null as unknown as string }), false);
expect("approved IS publicly visible",                  isPubliclyVisible({ isSkillBattle: true, status: "approved" }),               true);
// Case sensitivity — the app's real status vocabulary is lowercase
// ("approved", not "APPROVED"/"Approved"); this must not accidentally
// pass a differently-cased value that was never actually written by
// reviewSkillBattlePost.
expect("a differently-cased 'Approved' is NOT publicly visible (exact match only)", isPubliclyVisible({ isSkillBattle: true, status: "Approved" }), false);

console.log("\nNon-Skill-Battle 'reel' content (isSkillBattle not true — unchanged publication model):");
expect("pending IS visible (existing, unchanged behavior)",  isPubliclyVisible({ isSkillBattle: false, status: "pending" }), true);
expect("approved IS visible",                                 isPubliclyVisible({ isSkillBattle: false, status: "approved" }), true);
expect("rejected is NOT visible",                             isPubliclyVisible({ isSkillBattle: false, status: "rejected" }), false);
expect("missing isSkillBattle field entirely behaves the same as false", isPubliclyVisible({ status: "pending" }), true);

console.log(`\n${failures === 0 ? "✅ All checks passed" : `❌ ${failures} check(s) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
