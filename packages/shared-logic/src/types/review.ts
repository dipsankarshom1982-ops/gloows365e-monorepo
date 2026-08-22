// packages/shared-logic/src/types/review.ts
// ShikshaHub Phase 6 — tutor ratings & reviews. Approved Phase 6 scope:
// reviewable only off a completed instantHelpSessions/{id} (status ===
// "ended") — bookings/{id} has no "completed" concept at all today (only
// requested/accepted/declined/cancelled), so scheduled one-time/short-term/
// long-term sessions are explicitly NOT reviewable yet; adding that is
// later-phase scope, same "don't invent scope" discipline every prior
// phase followed.
//
// One review per session: tutorReviews/{sessionId} — the session's own id
// IS the review doc id, so "has this session already been reviewed" is a
// single doc read, and a student can never leave two reviews for the same
// session by construction (submitTutorReview's transaction checks
// existence before creating).

// tutorReviews/{sessionId} — client never writes this directly
// (firestore.rules: allow write: if false). submitTutorReview (student,
// owner of the session) creates it; hideTutorReview (admin) is the only
// thing that ever updates it afterward.
export type TutorReview = {
  id?: string; // = the instantHelpSessions/{id} it was left for
  sessionId: string;
  studentUid: string;
  tutorUid: string;
  serviceId?: string;
  subject?: string; // display snapshot, from the session
  rating: number; // 1-5 integer

  // reviewText is capped and trimmed server-side (see
  // functions/src/tutorReviews.ts) — never rendered as HTML anywhere, only
  // ever plain text.
  reviewText?: string;

  studentName?: string; // display-only snapshot, never authoritative (studentUid is)

  // Admin moderation (approved Phase 6 scope). A hidden review is excluded
  // from the tutor's public ratingAverage/ratingCount aggregate and from
  // useTutorReviews' default query, but the doc itself is never deleted —
  // same "moderate, don't destroy" pattern this app's Feedback/Grievances
  // screens already follow.
  hidden: boolean;
  hiddenBy?: string; // admin uid
  hiddenReason?: string;

  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};

// tutors/{uid} and tutorMarketplaceProfiles/{uid} both gain these two
// fields (Firestore is schemaless, no migration needed — same pattern
// every prior phase already used repeatedly). ratingAverage is derived
// (ratingSum/ratingCount) but stored directly for cheap reads; both are
// maintained transactionally by submitTutorReview/hideTutorReview, never
// recomputed by scanning tutorReviews client-side.
export type TutorRatingFields = {
  ratingSum?: number; // internal bookkeeping — never displayed directly
  ratingCount?: number;
  ratingAverage?: number;
};
