// packages/shared-logic/src/types/review.ts
// ShikshaHub Phase 6 — tutor ratings & reviews. Originally scoped to a
// completed instantHelpSessions/{id} (status === "ended") only —
// bookings/{id} had no "completed" concept at all then.
//
// Booking completion phase — extended to ALSO cover a completed
// bookings/{id} (status === "completed", see
// functions/src/tutorBooking.ts's tickBookingCompletion). A review is
// sourced from exactly one of sessionId/bookingId, never both — which
// field is present is itself the signal for which kind of session this
// review was left for, same "presence/absence of a field is a reliable
// signal" pattern bookings/{id}'s own serviceId/serviceName/etc already
// follow (see packages/shared-logic/src/types/booking.ts).
//
// One review per source: tutorReviews/{sessionId|bookingId} — the source
// doc's own id IS the review doc id, so "has this already been reviewed"
// is a single doc read, and a student can never leave two reviews for the
// same session/booking by construction (submitTutorReview's transaction
// checks existence before creating).

// tutorReviews/{sessionId|bookingId} — client never writes this directly
// (firestore.rules: allow write: if false). submitTutorReview (student,
// owner of the session/booking) creates it; hideTutorReview (admin) is
// the only thing that ever updates it afterward.
export type TutorReview = {
  id?: string; // = the instantHelpSessions/{id} or bookings/{id} it was left for
  sessionId?: string; // present only for an Instant Help session review
  bookingId?: string; // present only for a scheduled booking review
  studentUid: string;
  tutorUid: string;
  serviceId?: string;
  subject?: string; // display snapshot, from the session/booking
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

  // Tutor reply to reviews phase — the tutor being reviewed (tutorUid) can
  // post one public reply. Absence means no reply yet, same "presence
  // marks it done" pattern this codebase already uses elsewhere (e.g.
  // bookings/{id}'s reminderSentAt). A hidden review's reply is hidden
  // right along with it since both live on the same doc — no separate
  // visibility rule needed. Client never writes this directly (closed-
  // write collection); replyToTutorReview (the owning tutor, via the
  // Admin SDK) is the only thing that ever sets it.
  tutorReply?: string;
  tutorReplyAt?: unknown; // Firestore Timestamp

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
