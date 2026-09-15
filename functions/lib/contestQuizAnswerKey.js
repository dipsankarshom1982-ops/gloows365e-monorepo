"use strict";
// PATH: functions/src/contestQuizAnswerKey.ts
//
// Shared quiz-answer-key extraction/sanitization logic, used by both:
//   - contestLesson.ts (splits a freshly-generated lesson's answers out,
//     and lazily backfills contests/{id}/lessonAnswers/{language} for
//     historical lessons the first time they're re-opened)
//   - submitVidyastarContestQuiz.ts (falls back to deriving the answer key
//     directly from a historical lessons/{language} doc, server-side only,
//     when no lessonAnswers doc has been backfilled for it yet)
//
// Pulled into its own module so both call sites share the exact same
// "invalid correctAnswerIndex -> default to 0, with a warning" defensive
// handling, rather than two copies drifting apart.
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveAnswerKey = deriveAnswerKey;
exports.sanitizeQuizForClient = sanitizeQuizForClient;
exports.quizLooksUnsplit = quizLooksUnsplit;
function deriveAnswerKey(rawQuiz, context) {
    return rawQuiz.map((q, i) => {
        const optionCount = Array.isArray(q?.options) ? q.options.length : 0;
        let correctAnswerIndex = Number(q?.correctAnswerIndex);
        // validateLessonJson only checks question/options shape, not that
        // correctAnswerIndex is a valid in-range integer — Gemini has no hard
        // guarantee here. A malformed index would otherwise make every
        // submitted answer to this question silently unscoreable-as-correct.
        if (!Number.isInteger(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex >= optionCount) {
            console.warn(`${context}: quiz[${i}] has an invalid correctAnswerIndex (${q?.correctAnswerIndex}) for ${optionCount} options — defaulting to 0`);
            correctAnswerIndex = 0;
        }
        return { correctAnswerIndex, explanation: typeof q?.explanation === "string" ? q.explanation : "" };
    });
}
function sanitizeQuizForClient(rawQuiz) {
    return rawQuiz.map((q) => ({
        question: q?.question ?? "",
        options: Array.isArray(q?.options) ? q.options : [],
        difficulty: q?.difficulty,
        concept: q?.concept,
    }));
}
// True for a lesson doc's raw quiz array that still carries embedded
// answers — i.e. was generated before the public/private split shipped.
// A backfilled/freshly-generated public quiz never has this field at all.
function quizLooksUnsplit(rawQuiz) {
    return Array.isArray(rawQuiz) && rawQuiz.some((q) => q?.correctAnswerIndex !== undefined);
}
//# sourceMappingURL=contestQuizAnswerKey.js.map