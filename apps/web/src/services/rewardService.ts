// PATH: apps/web/src/services/rewardService.ts
// Direct port of mobile's lib/rewardService.ts. Calls the same
// claimVCoinReward Cloud Function (functions/src/vcoins.ts) — coin amount
// and daily caps are controlled server-side per activityId, not here.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

const claimVCoinRewardCF = httpsCallable<
  { activityId: string; referenceId?: string },
  { success: boolean; coinsAwarded: number }
>(functions, "claimVCoinReward");

/**
 * Award V-Coins for a story click/view.
 * Called from storyActions.ts.
 *
 * @param userId   - not needed by the CF (uses auth context), kept for API compat
 * @param _coins   - ignored; coin amount is controlled server-side per activityId
 * @param storyId  - used as referenceId to prevent double-awarding the same story
 */
export const giveCoins = async (
  userId: string,
  _coins: number,
  storyId?: string
): Promise<void> => {
  try {
    await claimVCoinRewardCF({
      activityId: "story_view",
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
