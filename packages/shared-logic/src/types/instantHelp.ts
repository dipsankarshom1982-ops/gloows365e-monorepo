// packages/shared-logic/src/types/instantHelp.ts
// ShikshaHub Phase 4 — the real-time Instant Help matching/session/billing
// engine. Builds on Phase 3's config-only instant_help TutorService (see
// tutorService.ts's header comment) — this is the part that phase
// deliberately deferred: functions/src/instantHelp.ts's requestInstantHelp/
// respondToInstantHelpRequest/endInstantHelpSession/tickInstantHelpBilling.
//
// Direct-request matching model (approved Phase 4 scope): a student picks
// ONE online, eligible tutor and sends a request; that tutor accepts or
// declines (or the request expires unanswered). No broadcast/fan-out to
// multiple tutors. Mirrors bookings/{id}'s requestBooking->respondToBooking
// shape closely, with the addition of a live billed session afterward.
//
// No in-app call/video/chat this phase — a session is a billed timer, not a
// communication channel. Student and tutor reach each other the same way
// scheduled bookings already imply (phone numbers on their own profiles);
// nothing about *how* they talk is modeled here.

// instantHelpRequests/{requestId} — a student's direct request to one
// tutor for one of that tutor's published instant_help services. Client
// never writes this collection directly (firestore.rules: allow write: if
// false) — requestInstantHelp/respondToInstantHelpRequest in
// functions/src/instantHelp.ts are the only ways a doc here is created or
// changed, both via the Admin SDK, same pattern as bookings/{id}.
export type InstantHelpRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export type InstantHelpRequest = {
  id?: string; // Firestore doc ID (auto-generated, not a stored field)
  studentUid: string;
  tutorUid: string;
  serviceId: string;

  subject: string;
  topics?: string[];
  // Snapshot of the service's creditsPerMinute at request time — never
  // re-read live once a session starts, same snapshot-not-live-reference
  // rule bookings/{id}.sessionFee already follows.
  creditsPerMinute: number;

  status: InstantHelpRequestStatus;

  // Display-only snapshots — never the authoritative identity, which stays
  // studentUid/tutorUid exclusively.
  studentName?: string;
  tutorName?: string;

  // The tutor has a fixed window to respond before this auto-expires —
  // enforced server-side by respondToInstantHelpRequest (rejects a stale
  // accept/decline) and lazily by requestInstantHelp (a student can't send
  // a new request until their last pending one is resolved or past this).
  expiresAt?: unknown; // Firestore Timestamp
  respondedAt?: unknown; // Firestore Timestamp

  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};

// instantHelpSessions/{sessionId} — created the moment a request is
// accepted; the live billed timer. Client never writes this collection
// directly either — same allow write: if false, same Admin-SDK-only
// callables (respondToInstantHelpRequest creates it; endInstantHelpSession
// and the scheduled tickInstantHelpBilling are the only things that ever
// update it).
export type InstantHelpSessionStatus = "active" | "ended";
export type InstantHelpEndReason = "student_ended" | "tutor_ended" | "insufficient_balance";

export type InstantHelpSession = {
  id?: string;
  requestId: string;
  studentUid: string;
  tutorUid: string;
  serviceId: string;

  subject: string;
  creditsPerMinute: number;

  status: InstantHelpSessionStatus;
  endReason?: InstantHelpEndReason;

  studentName?: string;
  tutorName?: string;

  // Billing bookkeeping — see functions/src/instantHelp.ts's
  // settleInstantHelpSession(), the one function both endInstantHelpSession
  // and the scheduled tickInstantHelpBilling call, so there's exactly one
  // place elapsed time ever turns into a debit/credit.
  startedAt?: unknown; // Firestore Timestamp
  lastBilledAt?: unknown; // Firestore Timestamp — the clean minute boundary billing has settled up to
  minutesBilled: number;
  totalCreditsCharged: number;
  endedAt?: unknown; // Firestore Timestamp

  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};
