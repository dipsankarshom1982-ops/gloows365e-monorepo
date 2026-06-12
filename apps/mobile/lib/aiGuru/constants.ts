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

export const LANGUAGES = ["English", "Bengali", "Hindi", "Assamese"];

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

export const FREE_DAILY_LESSONS   = 2;
export const FREE_DAILY_FOLLOWUPS = 5;
export const FREE_DAILY_ASK       = 5;

export const XP_PER_CORRECT: Record<string, number> = {
  easy: 10, medium: 15, hard: 20,
};

export const CLOUD_FUNCTION_URL =
  (process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL as string) ?? "";
