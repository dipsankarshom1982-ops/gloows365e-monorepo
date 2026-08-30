// packages/shared-logic/src/types/tutor.ts
// Shared Tutor types — used by apps/tutor (web), apps/tutor-mobile, and
// apps/admin's Tutor Verifications review queue.
//
// Mirrors types/student.ts's shape/conventions exactly: a merged profile
// type assembled from users/{uid} (role/auth-common fields) + tutors/{uid}
// (profile fields, wins on overlap) by TutorProfileContext.tsx, the same
// way StudentProfile is merged from users/{uid} + students/{uid}.

export type TutorRole = "TUTOR" | "TEACHER" | "COACHING_CENTER";

// ShikshaHub Phase 1 (minimum viable booking) — a tutor's own declared
// weekly availability. Deliberately simple: one enabled/start/end window
// per weekday, no timezone, no recurrence exceptions, no per-slot student
// caps. Full calendar/timezone handling is explicitly later-phase scope
// per the Phase 1 architecture audit — this shape is meant to be replaced
// wholesale then, not incrementally extended in place.
export type TutorWeekday =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export type TutorDayAvailability = {
  enabled: boolean;
  start?: string; // "HH:mm", 24h
  end?: string;   // "HH:mm", 24h
};

export type TutorWeeklyAvailability = Partial<Record<TutorWeekday, TutorDayAvailability>>;

export type TutorVerificationStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Verified"
  | "Rejected"
  | "Suspended";

// ── Onboarding (post-account-creation) — Step 2-5, all written onto the
// same tutors/{uid} doc as Phase 1a's fields above (no separate
// collection, no duplicate profile). Deliberately a PARALLEL status
// model from TutorVerification/TutorVerificationStatus above (which
// admin's existing review queue already consumes) rather than replacing
// it — see functions/src/tutorAccounts.ts's submitTutorOnboarding for
// the reasoning. profileStatus/onboardingVerificationStatus/submittedAt/
// reviewedAt/rejectionReason are server-only (set exclusively by that
// callable via the Admin SDK) — firestore.rules' tutors/{uid} allowlist
// deliberately excludes them, same protection `verified` already has.
export type TutorOnboardingProfileStatus =
  | "draft" | "incomplete" | "submitted" | "under_review"
  | "verified" | "rejected" | "suspended";

export type TutorOnboardingVerificationStatus =
  | "not_started" | "pending" | "verified" | "rejected";

export type TutorGender = "male" | "female" | "prefer_not_to_say" | "other";

export type TutorType =
  | "SCHOOL_TEACHER" | "PRIVATE_TUTOR" | "COLLEGE_FACULTY"
  | "SUBJECT_EXPERT" | "EXAM_PREP_TUTOR" | "SKILL_INSTRUCTOR";

export type TutorStudentLevel =
  | "PRIMARY" | "MIDDLE" | "SECONDARY" | "HIGHER_SECONDARY"
  | "COLLEGE" | "COMPETITIVE_EXAMS" | "PROFESSIONAL_SKILL";

export type TutorStream = "SCIENCE" | "COMMERCE" | "ARTS";
export type TutorCurriculumBoard = "CBSE" | "ICSE_ISC" | "STATE_BOARD" | "OTHER";
export type TutorTeachingMode = "ONLINE" | "OFFLINE" | "BOTH";
export type TutorExperienceRange =
  | "FRESHER" | "LESS_THAN_1" | "ONE_TO_2" | "THREE_TO_5" | "FIVE_TO_10" | "TEN_PLUS";
export type TutorHighestQualification =
  | "HIGHER_SECONDARY" | "DIPLOMA" | "GRADUATE" | "POSTGRADUATE"
  | "B_ED" | "M_ED" | "PHD" | "PROFESSIONAL_CERTIFICATION" | "OTHER";

export type TutorOnboardingDocumentStatus =
  | "not_submitted" | "submitted" | "under_review" | "verified" | "rejected";

export type TutorOnboardingDocument = {
  name: string;
  storagePath: string;
  status: TutorOnboardingDocumentStatus;
  rejectionReason?: string;
  uploadedAt?: unknown;
};

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
  // Free-text public bio shown on the tutor's ShikshaHub marketplace
  // listing (see TutorMarketplaceProfile below) — added onto this same
  // doc without a schema migration, same as this file's other Phase 1a
  // comment already anticipated.
  bio?: string;
  // Set true only by reviewTutorVerification's approve path — this is the
  // marketplace-visibility eligibility flag, distinct from
  // TutorVerification.status (which tracks the review workflow itself).
  verified?: boolean;
  role?: "tutor" | "admin" | "tester";
  // ShikshaHub Phase 1 — flat per-session rate in whole INR (no paise,
  // no per-subject/package pricing yet). Validated server-side (positive
  // integer) by firestore.rules' tutors/{uid} write rule and again by
  // requestBooking before it's snapshotted onto a booking.
  sessionFee?: number;
  availability?: TutorWeeklyAvailability;
  // ShikshaHub Phase 4 — live presence flag for Instant Help, distinct
  // from any tutorServices/{id}.availability (a static weekly-hours
  // config). Tutor-toggled via functions/src/instantHelp.ts's
  // setInstantHelpOnlineStatus; requestInstantHelp re-checks this
  // server-side before creating a request, same "never trust a stale
  // client-read flag" rule tutor.verified already follows there.
  isOnlineForInstantHelp?: boolean;
  // ShikshaHub Phase 6 — maintained transactionally by
  // functions/src/tutorReviews.ts's submitTutorReview/hideTutorReview,
  // never recomputed by scanning tutorReviews client-side. See
  // packages/shared-logic/src/types/review.ts's TutorRatingFields.
  ratingSum?: number;
  ratingCount?: number;
  ratingAverage?: number;

  // ── Onboarding (Step 2-5) — see the types above for each enum. ──────────
  phoneNumber?: string;
  phoneVerified?: boolean; // client-asserted until real Firebase Phone Auth
                            // replaces the OTP stub — see onboarding/page.tsx
  // Onboarding Step 2's photo upload writes into `profilePic` above
  // (Phase 1a's field, already in tutorMarketplace.ts's SAFE_FIELDS)
  // rather than a separate field — same reasoning as reusing `subjects`
  // for Step 3 below.
  pinCode?: string; // 6-digit Indian PIN — city/state are auto-filled from
                     // this client-side (api.postalpincode.in) but remain
                     // editable and optional, not derived server-side
  city?: string;  // optional
  state?: string; // optional
  gender?: TutorGender;

  tutorType?: TutorType;
  // Onboarding Step 3's subject multi-select writes into `subjects` above
  // (Phase 1a's field) rather than a separate one — both are just
  // string[] of subject names, and reusing it means tutorMarketplace.ts's
  // existing sync picks up onboarding's selection automatically.
  studentLevels?: TutorStudentLevel[];
  streams?: TutorStream[]; // only meaningful if HIGHER_SECONDARY is selected
  curriculumBoards?: TutorCurriculumBoard[];
  teachingMode?: TutorTeachingMode;
  offlineServiceAreas?: string[]; // service city/area only — never an exact address
  experience?: TutorExperienceRange;

  highestQualification?: TutorHighestQualification;
  degreeName?: string;
  institutionName?: string;
  completionYear?: number;
  specialization?: string;
  // `bio` above is Phase 1a's public marketplace bio (short); onboarding's
  // richer 100-500 char "about" write to that same field — one bio, not two.

  qualificationDocuments?: TutorOnboardingDocument[];
  experienceDocuments?: TutorOnboardingDocument[];
  additionalCertificates?: TutorOnboardingDocument[];

  onboardingStep?: number; // 2-5, resume point
  onboardingCompleted?: boolean;
  profileCompletionPercentage?: number;
  profileStatus?: TutorOnboardingProfileStatus;           // server-only, see above
  onboardingVerificationStatus?: TutorOnboardingVerificationStatus; // server-only
  submittedAt?: unknown;   // server-only
  reviewedAt?: unknown;    // server-only
  rejectionReason?: string; // server-only

  [key: string]: any;
};

// tutorMarketplaceProfiles/{uid} — public-safe mirror of a verified tutor's
// tutors/{uid} doc, written only by functions/src/tutorMarketplace.ts's
// syncTutorMarketplaceProfile trigger (Admin SDK, bypasses firestore.rules
// entirely — the collection's own rules block all client writes). Never
// phone/email, unlike TutorProfile above. Doc exists iff
// tutors/{uid}.verified === true; deleted by the trigger the moment that
// flips false. Read by apps/web's and apps/mobile's ShikshaHub screens.
export type TutorMarketplaceProfile = {
  uid: string;
  name?: string;
  bio?: string;
  subjects?: string[];
  qualification?: string;
  teachingExperienceYears?: number;
  preferredLanguage?: string;
  profilePic?: string;
  tutorRole?: TutorRole;
  // Both public-safe (a price and a weekly hour range, no personal data) —
  // mirrored so ShikshaHub's booking panel can show a fee and compute slot
  // options without ever widening tutors/{uid}'s own owner+admin-only read.
  sessionFee?: number;
  availability?: TutorWeeklyAvailability;
  // ShikshaHub Phase 4 — mirrored so students browsing the marketplace can
  // see live Instant Help availability without reading tutors/{uid}
  // directly. See TutorProfile.isOnlineForInstantHelp above.
  isOnlineForInstantHelp?: boolean;
  // ShikshaHub Phase 6 — mirrored so students browsing the marketplace see
  // a tutor's rating without reading tutors/{uid} directly.
  ratingCount?: number;
  ratingAverage?: number;
  updatedAt?: unknown;
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
