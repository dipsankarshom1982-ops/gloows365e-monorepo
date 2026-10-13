// packages/shared-logic/src/lib/tutorProfileCompletion.ts
// Tutor Profile Completion & Verification Dashboard — the single source
// of truth for "how complete is this tutor's profile", reused by
// apps/tutor and apps/tutor-mobile's dashboard/checklist/hero components
// instead of each hand-rolling its own percentage math.
//
// Pure function, no Firebase/React imports — safe to call from any
// component, a Cloud Function, or a test. Section weights and the fields
// that satisfy each one deliberately mirror the SAME requirements
// apps/tutor/src/components/onboarding's Step2-4 (and
// functions/src/tutorAccounts.ts's submitTutorOnboarding re-validation)
// already enforce as mandatory — MIN_BIO_LENGTH (100) and the
// "school-relevant student level" list are copied here rather than
// imported, since those constants live in each app's own app-local
// src/lib/onboardingOptions.ts (already duplicated web/mobile — see that
// file's own header), not in this shared package. Keep all three copies
// in sync if the onboarding requirements ever change.

import type { TutorProfile, TutorProfileCompletionResult, TutorProfileStrength } from "../types/tutor";

const MIN_BIO_LENGTH = 100;
const SCHOOL_STUDENT_LEVELS = ["PRIMARY", "MIDDLE", "SECONDARY", "HIGHER_SECONDARY"];

// Spec's weighted breakdown — must sum to 100.
const SECTION_WEIGHTS = {
  basic_information: 20,
  teaching_profile: 25,
  qualifications: 20,
  verification_documents: 20,
  profile_photo: 5,
  bio: 5,
  availability: 5,
} as const;

type SectionId = keyof typeof SECTION_WEIGHTS;

const SECTION_LABELS: Record<SectionId, string> = {
  basic_information: "Basic Information",
  teaching_profile: "Teaching Profile",
  qualifications: "Qualifications & Expertise",
  verification_documents: "Verification Documents",
  profile_photo: "Profile Photo",
  bio: "Tutor Bio",
  availability: "Availability Setup",
};

// One human-readable next-step per section, in the priority order the
// spec lays out (security/required info first, recommended enhancements
// last). Availability is deliberately last among "real" sections since
// it's the one piece that stays incomplete even for a fully onboarded,
// under-review tutor (see this file's completionPercentage note below).
const SECTION_PRIORITY: SectionId[] = [
  "basic_information",
  "teaching_profile",
  "qualifications",
  "verification_documents",
  "profile_photo",
  "bio",
  "availability",
];

const NEXT_ACTION_COPY: Record<SectionId, string> = {
  basic_information: "Complete your basic information",
  teaching_profile: "Finish setting up your teaching profile",
  qualifications: "Add your qualifications & expertise",
  verification_documents: "Upload your verification documents",
  profile_photo: "Add a profile photo",
  bio: "Write your tutor bio",
  availability: "Set your teaching availability",
};

function isSectionComplete(id: SectionId, p: Partial<TutorProfile>): boolean {
  switch (id) {
    case "basic_information":
      return !!(p.name?.trim() && p.phoneVerified && p.city?.trim() && p.state && p.gender);

    case "teaching_profile": {
      const studentLevels = p.studentLevels ?? [];
      const needsStreams = studentLevels.includes("HIGHER_SECONDARY");
      const needsBoards = studentLevels.some((l) => SCHOOL_STUDENT_LEVELS.includes(l));
      const needsServiceArea = p.teachingMode === "OFFLINE" || p.teachingMode === "BOTH";
      return !!(
        p.tutorType &&
        (p.subjects ?? []).length > 0 &&
        studentLevels.length > 0 &&
        p.teachingMode &&
        p.experience &&
        (!needsStreams || (p.streams ?? []).length > 0) &&
        (!needsBoards || (p.curriculumBoards ?? []).length > 0) &&
        (!needsServiceArea || (p.offlineServiceAreas ?? []).length > 0)
      );
    }

    case "qualifications":
      return !!(
        p.highestQualification &&
        p.degreeName?.trim() &&
        p.institutionName?.trim() &&
        p.completionYear &&
        p.specialization?.trim()
      );

    case "verification_documents":
      return (
        (p.qualificationDocuments?.length ?? 0) > 0 &&
        (p.experienceDocuments?.length ?? 0) > 0 &&
        (p.additionalCertificates?.length ?? 0) > 0
      );

    case "profile_photo":
      return !!p.profilePic?.trim();

    case "bio":
      return (p.bio?.trim().length ?? 0) >= MIN_BIO_LENGTH;

    case "availability":
      return Object.values(p.availability ?? {}).some((day) => day?.enabled);

    default:
      return false;
  }
}

function strengthForPercentage(percent: number): TutorProfileStrength {
  if (percent >= 100) return "excellent";
  if (percent >= 80) return "strong";
  if (percent >= 60) return "good";
  if (percent >= 40) return "developing";
  return "beginner";
}

// Computes completion percentage, per-section status, the single next
// recommended action, and a profile-strength band, all from one
// TutorProfile read — no separate calls needed. Sections are binary
// (complete/incomplete), matching the checklist-style UI the spec asks
// for (✓ / ○), not partial credit within a section.
export function calculateTutorProfileCompletion(
  profile: Partial<TutorProfile> | null | undefined
): TutorProfileCompletionResult {
  const p = profile ?? {};

  const completedSections: string[] = [];
  const incompleteSections: string[] = [];
  let earnedWeight = 0;

  for (const id of SECTION_PRIORITY) {
    if (isSectionComplete(id, p)) {
      completedSections.push(id);
      earnedWeight += SECTION_WEIGHTS[id];
    } else {
      incompleteSections.push(id);
    }
  }

  const completionPercentage = Math.round(earnedWeight);
  const nextIncomplete = incompleteSections[0];
  const nextRecommendedAction = nextIncomplete
    ? NEXT_ACTION_COPY[nextIncomplete as SectionId]
    : "Your profile is complete";

  return {
    completionPercentage,
    completedSections,
    incompleteSections,
    nextRecommendedAction,
    profileStrength: strengthForPercentage(completionPercentage),
  };
}

// Exported for the checklist/action-required UI, which needs a display
// label per section id rather than just the id itself.
export function tutorProfileSectionLabel(id: string): string {
  return SECTION_LABELS[id as SectionId] ?? id;
}
