// packages/shared-logic/src/types/tutor.ts
// Shared Tutor types — used by apps/tutor (web), apps/tutor-mobile, and
// apps/admin's Tutor Verifications review queue.
//
// Mirrors types/student.ts's shape/conventions exactly: a merged profile
// type assembled from users/{uid} (role/auth-common fields) + tutors/{uid}
// (profile fields, wins on overlap) by TutorProfileContext.tsx, the same
// way StudentProfile is merged from users/{uid} + students/{uid}.

export type TutorRole = "TUTOR" | "TEACHER" | "COACHING_CENTER";

export type TutorVerificationStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Verified"
  | "Rejected"
  | "Suspended";

// Phase 1a field set only — spec section 14's full marketplace profile
// builder (cover image, achievements, demo video, reels, etc.) is later
// phase scope, added onto this same tutors/{uid} doc without a schema
// migration since Firestore is schemaless.
export type TutorProfile = {
  uid?: string;
  name?: string;
  email?: string;
  phone?: string;
  tutorRole?: TutorRole;
  qualification?: string;
  subjects?: string[];
  teachingExperienceYears?: number;
  preferredLanguage?: string;
  profilePic?: string;
  // Set true only by reviewTutorVerification's approve path — this is the
  // marketplace-visibility eligibility flag, distinct from
  // TutorVerification.status (which tracks the review workflow itself).
  verified?: boolean;
  role?: "tutor" | "admin" | "tester";
  [key: string]: any;
};

// tutorVerifications/{uid} — one doc per tutor, tracks the review workflow
// and the document refs submitted for it. Document files themselves live
// in Storage at tutorDocuments/{uid}/{fileName} (private — see
// storage.rules); this doc only stores their download-ref metadata, never
// the files' contents.
export type TutorDocumentRef = {
  name: string;
  storagePath: string;
  uploadedAt?: unknown;
};

export type TutorVerification = {
  uid?: string;
  status?: TutorVerificationStatus;
  documents?: TutorDocumentRef[];
  submittedAt?: unknown;
  reviewedBy?: string;
  reviewedAt?: unknown;
  rejectionReason?: string;
};
