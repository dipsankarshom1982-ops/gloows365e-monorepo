// packages/shared-logic/src/types/booking.ts
// ShikshaHub Phase 1 — bookings/{bookingId}. A student's request to book a
// verified tutor for a trial/regular session. studentUid/tutorUid are the
// authoritative relationship (never studentName/tutorName, which are
// display-only snapshots taken at request time — see requestBooking in
// functions/src/tutorBooking.ts). Client never writes this collection
// directly (firestore.rules: allow write: if false) — requestBooking and
// respondToBooking are the only two ways this doc's WORKFLOW fields
// (status, etc.) are ever created or changed, both via the Admin SDK.
//
// Booking payment phase (functions/src/bookingPayment.ts) added
// financialStatus/paymentExpiresAt below — a deliberately SEPARATE,
// additive companion to `status` above, never a replacement (see
// BookingFinancialStatus's own header in ./financial for why). Written
// only by createBookingPaymentOrder and the webhook's confirmation path;
// a booking that predates this phase simply has neither field, which
// every reader treats identically to an explicit "not_required".

import type { BookingFinancialStatus } from "./financial";

export type BookingSessionType = "trial" | "regular";

// "completed" — booking completion phase: functions/src/tutorBooking.ts's
// tickBookingCompletion (scheduled, every 15 min) is the only thing that
// ever sets this, once an "accepted" booking's scheduled end time has
// passed. Review-eligibility marker only — bookings still carry no
// billing (see this type's own header comment above).
export type BookingStatus = "requested" | "accepted" | "declined" | "cancelled" | "completed";

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

  // ShikshaHub Phase 3 — present only for bookings made through a
  // tutorServices/{serviceId} (the "service path" in requestBooking).
  // Absent entirely on legacy Phase 1/2 bookings and on any booking made
  // against a tutor who still has zero services — never backfilled, so a
  // booking's presence/absence of these fields is itself a reliable signal
  // of which path created it. All server-resolved at request time, same
  // snapshot-not-live-reference rule sessionFee already followed.
  serviceId?: string;
  serviceName?: string;
  serviceType?: "one_time" | "short_term" | "long_term" | "instant_help";
  deliveryMode?: "online" | "offline" | "online_offline";
  duration?: number; // minutes

  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp

  // Booking session reminders phase — internal bookkeeping only, never
  // rendered client-side. Set once by tickBookingCompletion's sibling
  // sweep (functions/src/tutorBooking.ts's tickBookingReminders) so a
  // booking is only ever reminded once, same "presence marks it done"
  // pattern this codebase already uses (e.g. hideTutorReview's
  // hiddenReason).
  reminderSentAt?: unknown; // Firestore Timestamp

  // Booking payment phase — see this file's header. Absent on every
  // booking that predates payment support.
  financialStatus?: BookingFinancialStatus;
  paymentExpiresAt?: unknown; // Firestore Timestamp — set only while financialStatus === "payment_pending"
};
