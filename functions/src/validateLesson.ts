export function validateLessonJson(data: any): void {
  if (!data || typeof data !== "object") {
    throw new Error("AI returned invalid JSON structure");
  }

  const required = ["lessonTitle", "shortIntro", "scenes", "quiz", "flashcards", "keyConcepts", "quickRevisionNotes"];
  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!Array.isArray(data.scenes) || data.scenes.length < 5) {
    throw new Error(`Expected at least 5 scenes, got ${data.scenes?.length ?? 0}`);
  }
  if (!Array.isArray(data.quiz) || data.quiz.length < 5) {
    throw new Error(`Expected at least 5 quiz questions, got ${data.quiz?.length ?? 0}`);
  }
  if (!Array.isArray(data.flashcards) || data.flashcards.length < 5) {
    throw new Error(`Expected at least 5 flashcards, got ${data.flashcards?.length ?? 0}`);
  }
  if (!Array.isArray(data.keyConcepts) || data.keyConcepts.length < 3) {
    throw new Error(`Expected at least 3 key concepts, got ${data.keyConcepts?.length ?? 0}`);
  }

  // Validate each quiz question has required fields
  for (const q of data.quiz) {
    if (!q.question || !Array.isArray(q.options) || q.options.length < 2) {
      throw new Error("Invalid quiz question structure");
    }
  }
}
