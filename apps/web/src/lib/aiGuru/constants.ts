// PATH: apps/web/src/lib/aiGuru/constants.ts
// Mirror of apps/mobile/lib/aiGuru/constants.ts — same values, same shapes,
// so setup/content/dashboard pages on web match mobile behaviour exactly.

export const BOARDS = [
  "CBSE", "ICSE", "State Board",
  "Tripura Board", "West Bengal Board", "Assam Board", "Other",
];

export const CLASSES = Array.from({ length: 7 }, (_, i) => String(i + 6)); // "6" to "12"

export const SUBJECTS = [
  "Computer", "Science", "Math", "English",
  "Social Science", "Hindi", "Bengali", "Other",
];

export const SUBJECT_ICONS: Record<string, string> = {
  Computer: "💻", Science: "🔬", Math: "🔢", English: "📖",
  "Social Science": "🌍", Hindi: "🇮🇳", Bengali: "🅱️", Other: "📚",
};

// Lesson-generation language options — matches the app's full 12-language
// UI support (see SUPPORTED_LANGUAGES in lib/i18n.ts), not the narrower
// 4-language list mobile's setup screen shipped with. Rural and urban
// students across India should be able to generate lessons in their own
// language, not just English/Hindi/Bengali/Assamese.
//
// FIX (consolidation): added Urdu here, and updated exam-simulator/page.tsx
// to import this list instead of keeping its own local copy — that local
// copy had Urdu but was otherwise missing nothing this list didn't already
// have, so adding it here (the one place every other AI Guru screen reads
// from) means exam-simulator no longer needs a separate list at all, and
// Urdu becomes available for lesson generation + SkillGuru + Ask, not just
// exams.
export const LANGUAGES = [
  "English", "Hindi", "Bengali", "Assamese", "Marathi", "Gujarati",
  "Tamil", "Telugu", "Kannada", "Malayalam", "Punjabi", "Odia", "Urdu",
];

export const DIFFICULTIES = ["Easy", "Standard", "Exam Level"] as const;

export const DIFFICULTY_DESC: Record<string, string> = {
  Easy: "Simple words, basic concepts",
  Standard: "Balanced depth, board level",
  "Exam Level": "Deep explanations, exam tips",
};

export const LESSON_STYLES = [
  "Story Mode",
  "Simple Explanation",
  "Exam Preparation",
  "Practical Mode",
  "Fun Game Mode",
] as const;

export const LESSON_STYLE_DESC: Record<string, { emoji: string; desc: string }> = {
  "Story Mode":         { emoji: "📖", desc: "Learn through a story adventure" },
  "Simple Explanation": { emoji: "🧑‍🏫", desc: "Clear, step-by-step teaching" },
  "Exam Preparation":   { emoji: "🎯", desc: "Exam-focused with tips & tricks" },
  "Practical Mode":     { emoji: "🔧", desc: "Hands-on activities & real use" },
  "Fun Game Mode":      { emoji: "🎮", desc: "Gamified learning with XP" },
};

export const FREE_DAILY_LESSONS   = 1;
export const FREE_DAILY_FOLLOWUPS = 5;
export const FREE_DAILY_ASK       = 1;

export const XP_PER_CORRECT: Record<string, number> = {
  easy: 10, medium: 15, hard: 20,
};

export const CLOUD_FUNCTION_URL =
  (process.env.NEXT_PUBLIC_CLOUD_FUNCTION_URL as string) ?? "";
