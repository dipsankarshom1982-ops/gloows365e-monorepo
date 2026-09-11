// apps/tutor-mobile/lib/onboardingTypes.ts
// Mirrors apps/tutor/src/lib/onboardingTypes.ts exactly — same wizard
// state shape, same tutors/{uid} write payloads on both platforms. Kept
// as a duplicate file rather than a shared package export — see this
// file's counterpart on the web side for why. Keep the two byte-for-byte
// identical when editing either one.

import type { TutorOnboardingDocument } from "@gloows/shared-logic";

export type OnboardingData = {
  // Step 2 — Basic Information
  name: string;
  phoneNumber: string;   // 10 digits, no +91 prefix (prefix is fixed UI, not stored)
  phoneVerified: boolean;
  profilePic: string;
  pinCode: string;    // 6-digit Indian PIN code — drives city/state auto-fetch
  city: string;       // auto-filled from pinCode, editable — mandatory
  state: string;      // auto-filled from pinCode, editable — mandatory
  gender: string; // "" | TutorGender

  // Step 3 — Teaching Profile
  tutorType: string; // "" | TutorType
  subjects: string[];
  studentLevels: string[];
  streams: string[];
  curriculumBoards: string[];
  teachingMode: string; // "" | TutorTeachingMode
  offlineServiceAreas: string[];
  experience: string; // "" | TutorExperienceRange

  // Step 4 — Qualifications & Expertise
  highestQualification: string; // "" | TutorHighestQualification | custom text (see qualificationOtherText)
  qualificationOtherText: string; // UI-only; folded into highestQualification at save time when "OTHER" is chosen
  degreeName: string;
  institutionName: string;
  completionYear: string; // kept as string for the input; parsed to number on save
  specialization: string;
  bio: string;
  qualificationDocuments: TutorOnboardingDocument[];
  experienceDocuments: TutorOnboardingDocument[];
  additionalCertificates: TutorOnboardingDocument[];

  // Step 5 — declarations (never persisted — re-confirmed every submit)
  confirmAccurate: boolean;
  confirmTerms: boolean;

  // Progress
  onboardingStep: number;
};

export const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  name: "",
  phoneNumber: "",
  phoneVerified: false,
  profilePic: "",
  pinCode: "",
  city: "",
  state: "",
  gender: "",

  tutorType: "",
  subjects: [],
  studentLevels: [],
  streams: [],
  curriculumBoards: [],
  teachingMode: "",
  offlineServiceAreas: [],
  experience: "",

  highestQualification: "",
  qualificationOtherText: "",
  degreeName: "",
  institutionName: "",
  completionYear: "",
  specialization: "",
  bio: "",
  qualificationDocuments: [],
  experienceDocuments: [],
  additionalCertificates: [],

  confirmAccurate: false,
  confirmTerms: false,

  onboardingStep: 2,
};

// Builds the tutors/{uid} write payload for a given step — only the
// fields firestore.rules' tutors/{uid} allowlist actually covers, never
// profileStatus/onboardingVerificationStatus/submittedAt/reviewedAt/
// rejectionReason (server-only, see functions/src/tutorAccounts.ts's
// submitTutorOnboarding).
export function step2Payload(d: OnboardingData, nextStep: number) {
  return {
    name: d.name.trim(),
    phone: d.phoneNumber.trim(), // legacy Phase 1a field, kept in sync
    phoneNumber: d.phoneNumber.trim(),
    phoneVerified: d.phoneVerified,
    profilePic: d.profilePic,
    ...(d.pinCode.trim() ? { pinCode: d.pinCode.trim() } : {}),
    ...(d.city.trim() ? { city: d.city.trim() } : {}),
    ...(d.state ? { state: d.state } : {}),
    ...(d.gender ? { gender: d.gender } : {}),
    onboardingStep: nextStep,
  };
}

export function step3Payload(d: OnboardingData, nextStep: number) {
  return {
    tutorType: d.tutorType,
    subjects: d.subjects,
    studentLevels: d.studentLevels,
    streams: d.streams,
    curriculumBoards: d.curriculumBoards,
    teachingMode: d.teachingMode,
    offlineServiceAreas: d.offlineServiceAreas,
    experience: d.experience,
    onboardingStep: nextStep,
  };
}

export function step4Payload(d: OnboardingData, nextStep: number) {
  const highestQualification =
    d.highestQualification === "OTHER" && d.qualificationOtherText.trim()
      ? d.qualificationOtherText.trim()
      : d.highestQualification;
  return {
    highestQualification,
    degreeName: d.degreeName.trim(),
    institutionName: d.institutionName.trim(),
    completionYear: d.completionYear ? Number(d.completionYear) : null,
    specialization: d.specialization.trim(),
    bio: d.bio.trim(),
    qualificationDocuments: d.qualificationDocuments,
    experienceDocuments: d.experienceDocuments,
    additionalCertificates: d.additionalCertificates,
    onboardingStep: nextStep,
  };
}
