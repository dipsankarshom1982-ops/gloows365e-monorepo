// PATH: lib/storyActions.ts
// Uses unified StoryDoc from lib/story.ts (no more type mismatch).
// Removed trackActivity (activityService doesn't exist).

import * as Linking from "expo-linking";
import { router } from "expo-router";
import { StoryDoc } from "@/lib/story";
import { giveCoins } from "@/lib/rewardService";

export interface StoryUser {
  id: string;
}

export const handleStoryAction = async (
  story: StoryDoc,
  user: StoryUser
): Promise<void> => {
  // Award V-Coins for story click/view
  if (story.reward?.type === "click" || story.reward?.type === "view") {
    await giveCoins(user.id, story.reward.coins ?? 0, story.id);
  }

  // Handle CTA navigation
  if (!story.cta?.link) return;

  if (story.cta.actionType === "external") {
    Linking.openURL(story.cta.link).catch(() => {});
  } else {
    router.push(story.cta.link as any);
  }
};
