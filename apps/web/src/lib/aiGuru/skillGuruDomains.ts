// PATH: apps/web/src/lib/aiGuru/skillGuruDomains.ts
// Mirror of apps/mobile/lib/aiGuru/skillGuruDomains.ts — same skill
// categories and prompts, so the SkillGuru rebuild behaves identically
// on web and mobile.
//
// FEATURE (VidyaGuru → SkillGuru rebuild): VidyaGuru was a generic
// "ask me anything about your studies" tutor — same job as Ask AI Guru,
// just multi-turn. SkillGuru replaces it with a single clear identity:
// a skills coach. It does not answer board-syllabus doubts (that's
// Ask AI Guru's and the Dashboard/lesson tools' job) — it focuses on the
// employability and life skills a student needs alongside their
// academics: building a resume, cracking interviews, communicating with
// confidence, picking up coding/tech skills, and the soft skills
// (teamwork, leadership, time management) that don't get taught in a
// textbook chapter.
//
// NOTE ON BACKEND CONTRACT: the /vidyaguruChat Cloud Function (now
// reused as the SkillGuru backend, since that endpoint isn't part of
// this codebase and can't be renamed here) still receives the same
// {message, conversationHistory, studentName, classLevel, language}
// shape. To keep the model's replies skills-focused without a backend
// change, every outgoing `message` is prefixed with a short, invisible
// skill-context tag naming the active category — see
// buildSkillContextPrefix() below — rather than silently trusting the
// existing tutor prompt to know this is now a skills conversation.

export type SkillCategoryKey =
  | "resume"
  | "interview"
  | "communication"
  | "coding"
  | "softskills";

export interface SkillCategory {
  key:         SkillCategoryKey;
  label:       string;
  emoji:       string;
  color:       string;
  description: string;
  // Sent to the backend as context so the same underlying chat endpoint
  // stays anchored to "skills coaching for <category>" rather than
  // drifting into generic syllabus tutoring.
  contextTag:  string;
  starters:    string[];
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    key: "resume",
    label: "Resume Building",
    emoji: "📄",
    color: "#10b981",
    description: "Build a resume that gets noticed",
    contextTag: "resume and CV building",
    starters: [
      "Help me build a resume — I have no work experience yet",
      "Review my resume bullet points and make them stronger",
      "What should I put in the 'skills' section as a student?",
      "How do I write a resume objective/summary that stands out?",
    ],
  },
  {
    key: "interview",
    label: "Interview Prep",
    emoji: "🎤",
    color: "#0ea5e9",
    description: "Practice and ace your next interview",
    contextTag: "job/internship interview preparation",
    starters: [
      "How do I answer 'Tell me about yourself' in an interview?",
      "Mock interview me for a first job — ask me questions one at a time",
      "What are common interview questions for freshers and how do I answer them?",
      "How do I explain a weakness in an interview without hurting my chances?",
    ],
  },
  {
    key: "communication",
    label: "Communication",
    emoji: "🗣️",
    color: "#7c3aed",
    description: "Speak and write with confidence",
    contextTag: "communication and English-speaking skills",
    starters: [
      "How can I improve my English speaking fluency?",
      "Help me practice a short self-introduction speech",
      "How do I write a clear, polite email to a teacher or recruiter?",
      "Give me tips to reduce nervousness while speaking in public",
    ],
  },
  {
    key: "coding",
    label: "Coding & Tech",
    emoji: "💻",
    color: "#f59e0b",
    description: "Pick up real coding and tech skills",
    contextTag: "coding and technology skills for beginners",
    starters: [
      "I'm a complete beginner — which programming language should I start with?",
      "Explain what a variable and a loop are, with a simple example",
      "Give me a small coding exercise to practice today",
      "What tech skills are useful for a student looking for an internship?",
    ],
  },
  {
    key: "softskills",
    label: "Soft Skills",
    emoji: "🤝",
    color: "#ec4899",
    description: "Teamwork, leadership & time management",
    contextTag: "soft skills, leadership, and time management",
    starters: [
      "How do I become a better team leader in group projects?",
      "How can I manage my study time better with so many subjects?",
      "What's the difference between being assertive and being rude?",
      "How do I handle disagreements with teammates respectfully?",
    ],
  },
];

export function getSkillCategory(key: SkillCategoryKey): SkillCategory {
  return SKILL_CATEGORIES.find((c) => c.key === key) ?? SKILL_CATEGORIES[0];
}

// Builds a short context line prepended to the actual message sent to
// /vidyaguruChat. Kept compact and natural-language so it reads as
// framing, not a leaked system instruction, if it were ever surfaced.
export function buildSkillContextPrefix(category: SkillCategory): string {
  return `[Skill coaching focus: ${category.contextTag}] `;
}

// Board/class-aware greeting — same pattern as the old VidyaGuru
// greeting, but framed around skills coaching rather than syllabus
// tutoring, and no longer mentions a board/class as the primary frame
// since skills coaching isn't board-specific.
export function buildSkillGuruGreeting(
  t: (key: string, fallback: string, vars?: Record<string, any>) => string,
  languageName: string
): string {
  return t(
    "skillGuruGreeting",
    `I'm SkillGuru, your personal AI skills coach. I can help you with your resume, interview prep, communication, coding basics, and soft skills like teamwork and time management. Pick a skill area below or just tell me what you're working on — I can answer in ${languageName} too!`,
    { language: languageName }
  );
}
