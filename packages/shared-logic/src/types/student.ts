// packages/shared-logic/src/types/student.ts
// Shared StudentProfile type — used by mobile, web, and admin

export type StudentProfile = {
  uid?: string;
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
