// PATH: lib/rewardService.ts
// Changes:
//  • giveCoins now calls claimVCoinReward Cloud Function instead of writing
//    the old `coins` field directly to Firestore.
//  • activityId "story_view" = 2 V-Coins, max 20/day (matches ACTIVITIES catalogue)
//  • Old direct Firestore transaction writing `coins` field is removed entirely.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

const claimVCoinRewardCF = httpsCallable<
  { activityId: string; referenceId?: string },
  { success: boolean; coinsAwarded: number }
>(functions, "claimVCoinReward");

/**
 * Award V-Coins for a story click/view.
 * Called from storyActions.ts — replaces old direct `coins` field write.
 *
 * @param userId     - not needed by the CF (uses auth context), kept for API compat
 * @param _coins     - ignored; coin amount is now controlled server-side per activityId
 * @param storyId    - used as referenceId to prevent double-awarding the same story
 */
export const giveCoins = async (
  userId: string,
  _coins: number,
  storyId?: string
): Promise<void> => {
  try {
    await claimVCoinRewardCF({
      activityId:  "story_view",
      referenceId: storyId ?? userId,
    });
  } catch (e: any) {
    // "already-exists" = already claimed this story today — silent
    // "resource-exhausted" = daily limit (20/day) reached — silent
    if (e?.code !== "already-exists" && e?.code !== "resource-exhausted") {
      console.warn("[rewardService] giveCoins failed:", e?.message);
    }
  }
};
