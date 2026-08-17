// packages/shared-logic/src/types/booking.ts
// ShikshaHub Phase 1 — bookings/{bookingId}. A student's request to book a
// verified tutor for a trial/regular session. studentUid/tutorUid are the
// authoritative relationship (never studentName/tutorName, which are
// display-only snapshots taken at request time — see requestBooking in
// functions/src/tutorBooking.ts). Deliberately excludes anything payment/
// refund/commission/rating-related — that's later-phase scope per the
// Phase 1 architecture audit. Client never writes this collection
// directly (firestore.rules: allow write: if false) — requestBooking and
// respondToBooking are the only two ways a doc here is ever created or
// changed, both via the Admin SDK.

export type BookingSessionType = "trial" | "regular";

export type BookingStatus = "requested" | "accepted" | "declined" | "cancelled";

export type Booking = {
  id?: string; // Firestore doc ID (auto-generated, not a stored field)
  studentUid: string;
  tutorUid: string;

  subject: string;
  sessionType: BookingSessionType;

  requestedDate: string;      // "YYYY-MM-DD"
  requestedStartTime: string; // "HH:mm", 24h
  requestedEndTime: string;   // "HH:mm", 24h

  // Snapshot of tutors/{tutorUid}.sessionFee at request time (whole INR) —
  // not re-read live, so a later rate change doesn't retroactively alter
  // an in-flight or past request.
  sessionFee: number;

  status: BookingStatus;

  // Display-only snapshots — never the authoritative identity, and never
  // trusted for authorization (studentUid/tutorUid are, exclusively).
  studentName?: string;
  tutorName?: string;

  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};
