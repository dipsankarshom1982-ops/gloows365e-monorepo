import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";

export const trackActivity = async (
  userId: string,
  storyId: string,
  type: "view" | "click" | "conversion"
) => {
  await addDoc(collection(db, "user_story_activity"), {
    userId,
    storyId,
    type,
    timestamp: Date.now(),
  });
};