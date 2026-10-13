// packages/shared-logic/src/onboarding/onboardingRouting.ts
//
// Single source of truth for where a logged-in user should land during the
// Create Account → Parent Profile → Phone Verification → Parent Permissions
// → Student Registration onboarding sequence. Both apps/mobile (app/index.tsx,
// app/(auth)/{signup,login}.tsx) and apps/web (src/app/page.tsx,
// src/app/(auth)/{signup,login}/page.tsx) call resolveOnboardingRoute() with
// the students/{uid} doc instead of independently re-deriving the same
// decision from onboardingComplete, which is how the pre-existing
// onboardingComplete check ended up duplicated three times per platform.

export type OnboardingStep =
  | "accountCreated"
  | "parentProfileCompleted"
  | "phoneVerified"
  | "parentPermissionsCompleted"
  | "studentRegistration";

export interface OnboardingStudentDoc {
  onboardingStep?: string;
  parentPhoneVerified?: boolean;
  onboardingComplete?: boolean;
}

export type OnboardingRoute =
  | "parent-profile"
  | "phone-verification"
  | "parent-permissions"
  | "student-registration"
  | "home";

// `student` is undefined when students/{uid} doesn't exist yet (brand-new
// account, right after signup writes its stub doc — or before that write
// has landed at all).
export function resolveOnboardingRoute(student?: OnboardingStudentDoc): OnboardingRoute {
  if (!student) return "parent-profile";
  if (student.onboardingComplete) return "home";

  switch (student.onboardingStep) {
    case "parentProfileCompleted":
      return student.parentPhoneVerified ? "parent-permissions" : "phone-verification";
    case "phoneVerified":
      return "parent-permissions";
    case "parentPermissionsCompleted":
    case "studentRegistration":
      return "student-registration";
    case "accountCreated":
    default:
      return "parent-profile";
  }
}
