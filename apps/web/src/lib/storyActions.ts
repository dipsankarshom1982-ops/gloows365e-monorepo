// PATH: apps/web/src/lib/storyActions.ts
// Port of mobile's lib/storyActions.ts. Same logic (award V-Coins for a
// story click/view, then follow the CTA), adapted for Next.js:
//   - expo-router's global `router` singleton -> a `push` callback passed
//     in by the caller, since next/navigation's useRouter() is hook-only
//     and can't be imported into a plain function the way Expo's can.
//   - Linking.openURL -> window.open (matches the pattern already used
//     for the partner-bar CTA elsewhere in Story.tsx).

import { StoryDoc } from "@/lib/story";
import { giveCoins } from "@/services/rewardService";

export interface StoryUser {
  id: string;
}

export const handleStoryAction = async (
  story: StoryDoc,
  user: StoryUser,
  push: (path: string) => void
): Promise<void> => {
  // Award V-Coins for story click/view
  if (story.reward?.type === "click" || story.reward?.type === "view") {
    await giveCoins(user.id, story.reward.coins ?? 0, story.id);
  }

  // Handle CTA navigation
  if (!story.cta?.link) return;

  if (story.cta.actionType === "external") {
    window.open(story.cta.link, "_blank", "noopener,noreferrer");
  } else {
    push(story.cta.link);
  }
};
