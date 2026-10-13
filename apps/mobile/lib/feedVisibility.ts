// PATH: apps/mobile/lib/feedVisibility.ts
//
// SECURITY-CRITICAL — public feed moderation gating for Skill Battle
// content. Shared by both reels feed screens (app/reels.tsx and
// app/(drawer)/(tabs)/reels.tsx) so this decision exists in exactly one
// place, testable in isolation from React Native.
//
// A Skill Battle post (isSkillBattle === true) is only ever publicly
// visible once a moderator has actually approved it — functions/src/
// feed.ts's getReelsFeed (the server-authoritative reels Cloud Function)
// already gates on status=="approved" for exactly this reason; these two
// screens query Firestore directly instead of calling that function (see
// their own headers for why) and had drifted out of sync with it,
// letting PENDING/IN_REVIEW/etc. Skill Battle content leak into the
// public feed via a lenient status!="rejected" check. See this
// function's own regression script (feedVisibility.test.ts) for the
// full pass/fail matrix this closes.
//
// A non-Skill-Battle "reel" post's publication model is DELIBERATELY
// UNCHANGED — this file is scoped to Skill Battle content only; that
// collection has no approval workflow of its own today, and giving it
// one is a separate product decision, not part of this fix.
//
// Fails CLOSED: any post missing a clear isSkillBattle/status pairing —
// undefined, null, an unrecognized string — is treated as NOT publicly
// visible when it's a Skill Battle post. The default must be deny.
export interface FeedVisibilityPost {
  isSkillBattle?: boolean;
  status?: string;
}

export function isPubliclyVisible(post: FeedVisibilityPost): boolean {
  if (post.isSkillBattle === true) return post.status === "approved";
  return post.status !== "rejected";
}
