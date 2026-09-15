// packages/shared-logic/src/types/tutorService.ts
// ShikshaHub Phase 3 — a tutor's own bookable services. Introduced
// alongside (not replacing) the Phase 1/2 flat tutors/{uid}.sessionFee/
// availability model — see functions/src/tutorBooking.ts's header comment
// for the legacy-fallback migration rule this type supports: a tutor with
// zero tutorServices docs stays bookable through their flat fields; the
// moment they publish their first service, all NEW bookings against them
// must go through a service.
//
// discriminated on `serviceType`: "one_time" | "short_term" | "long_term"
// share one shape (scheduled, session-fee-priced, weekly-availability-
// gated); "instant_help" is deliberately configuration-only this phase —
// topics/creditsPerMinute/availability are stored so the UI can display
// and edit them, but functions/src/tutorBooking.ts's requestBooking
// rejects any attempt to book an instant_help service outright (see that
// file's header comment) until the real-time matching/session/billing
// engine exists in a later phase.

import type { TutorWeeklyAvailability } from "./tutor";

export type ServiceType = "one_time" | "short_term" | "long_term" | "instant_help";
export type DeliveryMode = "online" | "offline" | "online_offline";

// tutorServices/{serviceId} — the tutor's own authoritative record.
// Client never writes this collection directly (firestore.rules:
// `allow write: if false`) — createService/updateService/deleteService in
// functions/src/tutorServices.ts are the only ways a doc here is ever
// created or changed, all via the Admin SDK, same pattern as bookings/{id}.
export type TutorService = {
  id?: string; // Firestore doc ID (auto-generated, not a stored field)
  tutorUid: string;

  serviceName: string;
  description?: string;
  subject: string;
  topics?: string[];

  serviceType: ServiceType;
  deliveryMode: DeliveryMode;

  // Scheduled types (one_time/short_term/long_term) only — validated
  // server-side when serviceType is one of those three.
  durationMinutes?: number;      // length of one session
  numberOfSessions?: number;     // total sessions in the package (short/long-term)
  sessionsPerWeek?: number;      // short/long-term cadence
  startDate?: string;            // "YYYY-MM-DD", short/long-term only
  endDate?: string;               // "YYYY-MM-DD", short/long-term only
  sessionFee?: number;           // whole INR, server-validated positive int
  trialAvailable?: boolean;
  availability?: TutorWeeklyAvailability;

  // instant_help only — configuration fields per the approved Phase 3
  // scope: stored/editable/browsable, but NOT wired to any runtime
  // request/match/session/billing behavior this phase.
  creditsPerMinute?: number;
  minimumDurationMinutes?: number;
  maximumDurationMinutes?: number;

  published: boolean;

  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};

// tutorServicesMarketplace/{serviceId} — public-safe mirror of a
// **published** service belonging to a **verified** tutor, written only by
// functions/src/tutorServices.ts's syncTutorServiceMarketplace trigger
// (Admin SDK, bypasses firestore.rules entirely). Identical field set to
// TutorService minus nothing sensitive — this collection was designed with
// no PII from the start (unlike tutors/{uid}, which hides phone/email),
// so the mirror carries every field straight through.
export type TutorServiceMarketplace = Omit<TutorService, "id" | "published"> & {
  id: string;
  tutorName?: string;
  tutorVerified: true;
  updatedAt?: unknown;
};
