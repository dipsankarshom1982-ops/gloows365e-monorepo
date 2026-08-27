// PATH: apps/web/src/services/feedbackService.ts
//
// Feedback & Ratings — web service layer. Exact mirror of mobile
// services/feedbackService.ts, adapted to this app's web Firestore import
// style (getFirestore() inline, per services/dailyStreakQuizService.ts).
//
// Direct client reads/writes, no Cloud Function — firestore.rules already
// fully enforces "students can only read/write their own feedback/{uid}
// doc," and there's no scoring/entry-fee-style logic here that needs
// server trust (unlike V-Coins or contest joins).

import { collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, setDoc, where } from "firebase/firestore";

export interface FeedbackFeature {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  isEnabled: boolean;
  order: number;
}

export interface StudentFeedback {
  ratings: Record<string, number>;   // featureId -> 1-5
  suggestion: string;
}

export async function getFeedbackFeatures(): Promise<FeedbackFeature[]> {
  const db = getFirestore();
  const snap = await getDocs(query(collection(db, "feedbackFeatures"), where("isEnabled", "==", true)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as FeedbackFeature))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export async function getMyFeedback(uid: string): Promise<StudentFeedback | null> {
  const db = getFirestore();
  const snap = await getDoc(doc(db, "feedback", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ratings: d.ratings ?? {}, suggestion: d.suggestion ?? "" };
}

// Upsert — always sends the complete current on-screen state of `ratings`
// (not a partial merge into the map itself), so a student can un-rate a
// feature by simply removing it from the form before submitting; the doc
// as a whole is merge:true only so createdAt (set once, below) survives.
export async function submitFeedback(
  uid: string,
  { ratings, suggestion }: StudentFeedback
): Promise<void> {
  const db = getFirestore();
  const existing = await getDoc(doc(db, "feedback", uid));
  await setDoc(
    doc(db, "feedback", uid),
    {
      userId: uid,
      ratings,
      suggestion,
      source: "settings",
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}
