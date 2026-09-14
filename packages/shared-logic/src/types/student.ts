// packages/shared-logic/src/types/student.ts
// Shared StudentProfile type — used by mobile, web, and admin

// Class 11/12 academic stream. Classes 6–10 are always `null` — there is no
// stream concept below Class 11 (see 2026-09-14 architecture update: Daily
// Streak Quiz personalization + future ShikshaBub/CourseHub filtering).
// NOTE: this is intentionally distinct from tutor-side TutorStream
// ("SCIENCE"|"COMMERCE"|"ARTS", different casing, "ARTS" not
// "Arts/Humanities") — matching a student to a tutor's stream later needs an
// explicit map, not a string comparison.
export type StudentStream = "Science" | "Commerce" | "Arts/Humanities";

export const STUDENT_STREAMS: readonly StudentStream[] = ["Science", "Commerce", "Arts/Humanities"];

export type StudentProfile = {
  uid?: string;
  // Auto-assigned, human-readable ID (e.g. "GLS000123") — stable for the
  // lifetime of the account, shown in the mobile drawer profile and used
  // by admin to look a student up regardless of their Firebase uid. See
  // functions/src/studentId.ts (ensureStudentId).
  studentId?: string;
  name?: string;
  email?: string;
  school?: string;
  class?: number | string;
  // Class 11/12 only — null (or absent, on any account created before this
  // field existed) for Class 6–10 and for 11/12 students who haven't picked
  // one yet. Never guessed/auto-assigned — see dailyStreakQuizGeneration.ts
  // and profile-settings.tsx for how every read path treats "absent" and
  // "null" identically.
  stream?: StudentStream | null;
  // Required at registration; may be absent on accounts created before this
  // field existed — self-edit screens should let those students fill it in,
  // never block unrelated saves on it.
  parentGuardianName?: string;
  board?: string;
  phone?: string;
  location?: { district?: string; state?: string };
  interests?: string[];
  preferredLanguage?: string;
  profilePic?: string;
  LearnFunXP?: number;
  learnScore?: number;
  role?: "student" | "admin" | "tester";
  profileType?: "student" | "restart_education";
  // restart education indicator fields
  lastClassPassed?: string;
  educationGapReason?: string;
  currentOccupation?: string;
  vCoinsBalance?: number;
  vCoinsLifetimeEarned?: number;
  vCoinsLifetimeSpent?: number;
  [key: string]: any;
};
