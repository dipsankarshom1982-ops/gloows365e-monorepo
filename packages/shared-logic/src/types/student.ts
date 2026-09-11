// packages/shared-logic/src/types/student.ts
// Shared StudentProfile type — used by mobile, web, and admin

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
