import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

export interface QuizAnswer {
  questionIndex: number;
  selectedIndex: number | null;
  correct: boolean;
  timeTakenSeconds: number;
}

export async function submitContestQuiz(
  contestId: string,
  userId: string,
  answers: QuizAnswer[]
): Promise<{ score: number; rank: number }> {
  const correctAnswers = answers.filter((a) => a.correct).length;

  // Time bonus: up to 5 pts per correct answer, scaling from 5s → 30s
  const timeBonus = answers.reduce((sum, a) => {
    if (!a.correct) return sum;
    const bonus = Math.max(0, Math.floor(5 * (30 - a.timeTakenSeconds) / 25));
    return sum + bonus;
  }, 0);

  const totalScore = correctAnswers * 10 + timeBonus;
  const quizCompletedAt = new Date();

  // Fetch all participants so we can compute accurate ranks in one batch
  const allSnap = await getDocs(collection(db, "contests", contestId, "participant"));

  const participants = allSnap.docs.map((d) => {
    if (d.id === userId) {
      // Use the fresh score for this user
      return { id: d.id, ref: d.ref, score: totalScore, completedAt: quizCompletedAt };
    }
    return {
      id: d.id,
      ref: d.ref,
      score: d.data().score ?? 0,
      completedAt: (d.data().quizCompletedAt?.toDate?.() as Date | undefined) ?? new Date(0),
    };
  });

  // Sort: higher score first; ties broken by earlier completion time
  participants.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.completedAt.getTime() - b.completedAt.getTime()
  );

  const myRank = participants.findIndex((p) => p.id === userId) + 1;

  const batch = writeBatch(db);

  // Write current user's quiz result
  batch.set(
    doc(db, "contests", contestId, "participant", userId),
    {
      answers,
      timeBonus,
      score: totalScore,
      completed: true,
      quizCompletedAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Update everyone's rank
  participants.forEach((p, i) => {
    batch.update(p.ref, { rank: i + 1 });
  });

  await batch.commit();

  return { score: totalScore, rank: myRank };
}
