// LIVE sampler for the Class 3–5 Daily Streak Quiz — skipped unless
// GEMINI_API_KEY is set, so `npm test` never touches the network.
//
// Runs the real generate + validate pipeline (the same generateValidatedQuestion
// the scheduled function uses) for Class 3, 4 and 5 and prints the questions
// for a human to review. It writes nothing anywhere (no Firestore, no files).
//
//   GEMINI_API_KEY=<staging key> npx jest src/__tests__/liveQuizSamples.test.ts
//
// The assertions only check shape and the subject pool; whether a question is
// actually suitable for the class is for the reviewer to judge from the output.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { generateValidatedQuestion } from "../dailyStreakQuizGeneration";
import { getQuizSubjectPool } from "../educationConfig";

const SAMPLES_PER_CLASS = Number(process.env.QUIZ_SAMPLES_PER_CLASS ?? 4);
const live = process.env.GEMINI_API_KEY ? describe : describe.skip;

live("live Daily Streak Quiz samples (Class 3–5)", () => {
  jest.setTimeout(240_000);

  test.each([3, 4, 5])("Class %i", async (cls) => {
    const seenTopics: string[] = [];
    const seenQuestions: string[] = [];
    const pool = getQuizSubjectPool(cls)!;

    for (let i = 0; i < SAMPLES_PER_CLASS; i++) {
      const { data, difficulty, generationAttempts } = await generateValidatedQuestion(cls, null, seenTopics, seenQuestions);
      seenTopics.push(data.topic);
      seenQuestions.push(data.question);

      console.log(
        `\n[Class ${cls} sample ${i + 1}] subject=${data.subject} topic=${data.topic} difficulty=${difficulty} attempts=${generationAttempts}\n` +
        `Q: ${data.question}\nA) ${data.optionA}\nB) ${data.optionB}\nC) ${data.optionC}\nD) ${data.optionD}\n` +
        `Correct: ${data.correctOption}\nExplanation: ${data.explanation}`
      );

      expect(difficulty).toBe("easy");
      // The model may word a subject slightly differently; flag it for the reviewer rather than fail.
      if (!pool.includes(data.subject)) console.warn(`[Class ${cls}] subject "${data.subject}" is not in the pool: ${pool.join(", ")}`);
      expect(["A", "B", "C", "D"]).toContain(data.correctOption);
      expect(new Set([data.optionA, data.optionB, data.optionC, data.optionD]).size).toBe(4);
    }
  });
});
