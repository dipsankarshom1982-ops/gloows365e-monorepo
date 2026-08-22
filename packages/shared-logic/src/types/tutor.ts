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
