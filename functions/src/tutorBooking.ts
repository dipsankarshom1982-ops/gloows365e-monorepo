// PATH: functions/src/tutorBooking.ts
// ShikshaHub Phase 1 — minimum viable tutor booking. Two callables:
// requestBooking (a student requests a slot against a verified tutor) and
// respondToBooking (the tutor accepts/declines their own incoming
// request). No payment, no calendar/timezone engine, no notifications
// beyond bookings/{id}'s own status field (student-side listens via
// onSnapshot — see apps/web/src/lib/shikshahub/index.ts). See the Phase 1
// architecture audit this implements for what's deliberately deferred.
//
// Same v1 onCall convention as functions/src/tutorAccounts.ts (context.auth
// populated automatically, no manual bearer-token parsing) — this repo's
// dominant pattern over onRequest.
//
// Client never writes bookings/{id} directly — firestore.rules has
// `allow write: if false` on this collection, exactly mirroring how
// tutorVerifications/{uid} stays closed to client writes and only these
// Admin-SDK callables (which bypass rules entirely) can create or mutate a
// booking. This is deliberate, not an oversight: it's what stops a client
// from ever posting an arbitrary "accepted" status directly.
//
// ShikshaHub Phase 3 — requestBooking now has TWO booking paths, chosen by
// whether the client sends a serviceId (functions/src/tutorServices.ts's
// tutorServices/{id}):
//   • service path  — serviceId given. subject/sessionFee/serviceType/
//     deliveryMode/duration are all resolved from the service doc, never
//     client-sent (same "never trust a client-sent amount" rule this file
//     already followed for the legacy sessionFee). instant_help services
//     are rejected outright — see the approved Phase 3 scope: config-only
//     this phase, no real-time request/match/session/billing engine yet.
//   • legacy path   — no serviceId. Exactly today's Phase 1/2 behavior,
//     byte-for-byte: resolves subject/sessionFee off tutors/{tutorUid}
//     directly. Stays available ONLY for a tutor with zero tutorServices
//     docs — the moment a tutor publishes (or even just creates, published
//     or not) their first service, this path starts rejecting new bookings
//     against them with a clear "use a service" error, forcing all NEW
//     bookings onto the service path. This is the approved migration rule:
//     never break an existing tutor's bookability, but don't let a
//     tutor's legacy flat fields and their new services silently drift out
//     of sync as two live, simultaneously-bookable pricing sources.
// Either path converges on the same bookings/{id} write — the doc just
// carries a few extra service-snapshot fields when it came from the
// service path. Existing Phase 1/2 booking fields are never removed or
// renamed, so every already-tested cancel/accept/decline flow (and every
// booking already sitting in Firestore) keeps working unchanged.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { notifyStudent, notifyTutor } from "./shikshahubNotify";

const db = admin.firestore();

type SessionType = "trial" | "regular";
// "completed" — booking completion phase. Added by tickBookingCompletion
// below, never by requestBooking/respondToBooking/cancelBooking (those
// three still only ever produce the original four statuses). No billing
// is tied to this — bookings have never had one (see this file's header
// comment) — "completed" exists purely so a scheduled session becomes
// review-eligible the same way an ended Instant Help session already is
// (see functions/src/tutorReviews.ts's submitTutorReview).
type BookingStatus = "requested" | "accepted" | "declined" | "cancelled" | "completed";
type ServiceType = "one_time" | "short_term" | "long_term" | "instant_help";
type DeliveryMode = "online" | "offline" | "online_offline";

const SESSION_TYPES: SessionType[] = ["trial", "regular"];
const TUTOR_ROLE_CLAIMS = ["TUTOR", "TEACHER", "COACHING_CENTER"];

// "YYYY-MM-DD" / "HH:mm" (24h) — deliberately plain strings, no Date/
// timezone handling. Phase 3's real calendar system replaces this
// wholesale rather than extending it in place (see the audit).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// DATE_RE alone accepts impossible dates like "2026-02-30" (format-valid,
// calendar-invalid). This adds the real-calendar-date check on top of it:
// build a UTC Date from the parts and confirm it round-trips back to the
// same year/month/day — an invalid date like Feb 30 rolls over to Mar 2
// (or Feb 29 on a non-leap year rolls to Mar 1), which fails the
// round-trip and is correctly rejected. UTC specifically so this never
// depends on the Cloud Function's server timezone.
function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) return false;
  const year  = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  const day   = Number(dateStr.slice(8, 10));
  if (month < 1 || month > 12) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// ─── requestBooking ─────────────────────────────────────────────────────────
export const requestBooking = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (
    data: {
      tutorUid?: string;
      serviceId?: string;
      subject?: string;
      sessionType?: SessionType;
      requestedDate?: string;
      requestedStartTime?: string;
      requestedEndTime?: string;
    },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const studentUid = context.auth.uid;

    // Reject anything carrying a tutor role claim outright (cheap,
    // no-read defense-in-depth) — students never get a custom claim at
    // all (see tutorAccounts.ts's header comment), only tutors do.
    const callerRole = context.auth.token?.role as string | undefined;
    if (callerRole && TUTOR_ROLE_CLAIMS.includes(callerRole)) {
      throw new functionsV1.https.HttpsError("permission-denied", "Only student accounts can request a booking");
    }

    const {
      tutorUid, serviceId, subject, sessionType,
      requestedDate, requestedStartTime, requestedEndTime,
    } = data ?? {};

    if (!tutorUid || typeof tutorUid !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "tutorUid is required");
    }
    if (!sessionType || !SESSION_TYPES.includes(sessionType)) {
      throw new functionsV1.https.HttpsError("invalid-argument", 'sessionType must be "trial" or "regular"');
    }
    if (!requestedDate || !isValidCalendarDate(requestedDate)) {
      throw new functionsV1.https.HttpsError("invalid-argument", "requestedDate must be a real calendar date in YYYY-MM-DD format");
    }
    if (!requestedStartTime || !TIME_RE.test(requestedStartTime) || !requestedEndTime || !TIME_RE.test(requestedEndTime)) {
      throw new functionsV1.https.HttpsError("invalid-argument", "requestedStartTime/requestedEndTime must be HH:mm (24h)");
    }
    if (requestedEndTime <= requestedStartTime) {
      throw new functionsV1.https.HttpsError("invalid-argument", "requestedEndTime must be after requestedStartTime");
    }

    // Real "is this caller a student" check — a students/{uid} profile
    // doc existing, not just the absence of a tutor claim. Also doubles
    // as the studentName snapshot source.
    const studentSnap = await db.doc(`students/${studentUid}`).get();
    if (!studentSnap.exists) {
      throw new functionsV1.https.HttpsError("permission-denied", "Only student accounts can request a booking");
    }

    const tutorSnap = await db.doc(`tutors/${tutorUid}`).get();
    if (!tutorSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Tutor not found");
    }
    const tutor = tutorSnap.data()!;
    if (tutor.verified !== true) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This tutor isn't verified yet");
    }

    // Resolved by whichever path below actually runs — never client-sent
    // for the fields that matter (subject/sessionFee/service metadata),
    // exactly the "never trust a client-sent amount" rule aiGuruCredits.ts
    // follows for its own payment flow.
    let resolvedSubject: string;
    let sessionFee: number;
    let serviceSnapshot: Record<string, unknown> = {};

    if (serviceId) {
      // ── Phase 3 service path ──────────────────────────────────────────
      if (typeof serviceId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "serviceId must be a string");
      }
      const serviceSnap = await db.doc(`tutorServices/${serviceId}`).get();
      if (!serviceSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Service not found");
      }
      const service = serviceSnap.data()!;
      if (service.tutorUid !== tutorUid) {
        throw new functionsV1.https.HttpsError("invalid-argument", "serviceId does not belong to the given tutor");
      }
      if (service.published !== true) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This service is not currently available for booking");
      }
      const serviceType = service.serviceType as ServiceType;
      if (serviceType === "instant_help") {
        // Approved Phase 3 scope: instant_help services are configuration-
        // only — no real-time request/match/session/billing engine exists
        // yet, so this path is deliberately a dead end until that phase.
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          "This service isn't bookable yet — Instant Help launches in a later phase"
        );
      }
      if (sessionType === "trial" && service.trialAvailable !== true) {
        throw new functionsV1.https.HttpsError("invalid-argument", "This service doesn't offer a trial session");
      }
      const fee = Number(service.sessionFee);
      if (!Number.isInteger(fee) || fee <= 0) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This service hasn't set a session fee yet");
      }

      resolvedSubject = (service.subject as string) ?? "";
      sessionFee = fee;
      serviceSnapshot = {
        serviceId,
        serviceName: (service.serviceName as string | undefined) ?? "",
        serviceType,
        deliveryMode: (service.deliveryMode as DeliveryMode | undefined) ?? null,
        duration: (service.durationMinutes as number | undefined) ?? null,
      };
    } else {
      // ── Legacy Phase 1/2 path ─────────────────────────────────────────
      if (!subject || typeof subject !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "subject is required");
      }

      // Migration rule: the moment a tutor has created ANY tutorServices
      // doc (published or not), new bookings against them must go through
      // the service path — this is what stops their flat fields and their
      // services from silently drifting into two live, conflicting prices.
      const anyService = await db.collection("tutorServices")
        .where("tutorUid", "==", tutorUid).limit(1).get();
      if (!anyService.empty) {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          "This tutor now offers services — please select a service to book"
        );
      }

      const tutorSubjects: string[] = Array.isArray(tutor.subjects) ? tutor.subjects : [];
      if (!tutorSubjects.includes(subject)) {
        throw new functionsV1.https.HttpsError("invalid-argument", "subject must be one this tutor teaches");
      }

      const fee = Number(tutor.sessionFee);
      if (!Number.isInteger(fee) || fee <= 0) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This tutor hasn't set a session fee yet");
      }

      resolvedSubject = subject;
      sessionFee = fee;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const bookingRef = db.collection("bookings").doc();
    await bookingRef.set({
      studentUid,
      tutorUid,
      subject: resolvedSubject,
      sessionType,
      requestedDate,
      requestedStartTime,
      requestedEndTime,
      sessionFee,
      status: "requested" as BookingStatus,
      // Display-only snapshots — never the authoritative relationship,
      // which stays studentUid/tutorUid above.
      studentName: (studentSnap.data()?.name as string | undefined) ?? "",
      tutorName: (tutor.name as string | undefined) ?? "",
      ...serviceSnapshot,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`✅ Booking requested: ${bookingRef.id} student=${studentUid} tutor=${tutorUid}${serviceId ? ` service=${serviceId}` : " (legacy)"}`);
    return { bookingId: bookingRef.id, status: "requested" as BookingStatus };
  });

// ─── respondToBooking ───────────────────────────────────────────────────────
export const respondToBooking = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (
    data: { bookingId?: string; action?: "accepted" | "declined" },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    const { bookingId, action } = data ?? {};

    if (!bookingId || typeof bookingId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "bookingId is required");
    }
    if (action !== "accepted" && action !== "declined") {
      throw new functionsV1.https.HttpsError("invalid-argument", 'action must be "accepted" or "declined"');
    }

    const bookingRef = db.doc(`bookings/${bookingId}`);

    // Transaction, not a plain get+update — closes the race where two
    // near-simultaneous respondToBooking calls (e.g. a double-tap) could
    // otherwise both pass the status==="requested" check before either
    // write lands.
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Booking not found");
      }
      const booking = snap.data()!;
      if (booking.tutorUid !== tutorUid) {
        throw new functionsV1.https.HttpsError("permission-denied", "This booking doesn't belong to you");
      }
      if (booking.status !== "requested") {
        throw new functionsV1.https.HttpsError("failed-precondition", `Booking is already "${booking.status}"`);
      }
      tx.update(bookingRef, {
        status: action,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: action as BookingStatus };
    });

    console.log(`✅ Booking ${bookingId} ${result.status} by tutor ${tutorUid}`);
    return result;
  });

// ─── cancelBooking ──────────────────────────────────────────────────────────
// Phase 2 — either party on the booking (student or tutor) can cancel a
// "requested" or "accepted" booking. "declined" and already-"cancelled"
// bookings can't be cancelled again — declining is the tutor's own terminal
// action, and there's nothing left to cancel once a booking is already
// cancelled. Same transaction-guarded pattern as respondToBooking, for the
// same double-tap race reason.
export const cancelBooking = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (
    data: { bookingId?: string },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const callerUid = context.auth.uid;
    const { bookingId } = data ?? {};

    if (!bookingId || typeof bookingId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "bookingId is required");
    }

    const bookingRef = db.doc(`bookings/${bookingId}`);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Booking not found");
      }
      const booking = snap.data()!;
      if (booking.studentUid !== callerUid && booking.tutorUid !== callerUid) {
        throw new functionsV1.https.HttpsError("permission-denied", "This booking doesn't belong to you");
      }
      if (booking.status !== "requested" && booking.status !== "accepted") {
        throw new functionsV1.https.HttpsError("failed-precondition", `Booking is already "${booking.status}"`);
      }
      tx.update(bookingRef, {
        status: "cancelled" as BookingStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: "cancelled" as BookingStatus };
    });

    console.log(`✅ Booking ${bookingId} cancelled by ${callerUid}`);
    return result;
  });

// ─── tickBookingCompletion ───────────────────────────────────────────────────
// Booking completion phase — the only thing that ever moves a booking to
// "completed". Sweeps "accepted" bookings whose scheduled end has passed
// (requestedDate/requestedEndTime compared as plain IST wall-clock
// strings, same no-timezone convention this file has followed since
// Phase 1 — see isValidCalendarDate's header comment) and flips them.
// Booking granularity doesn't need Instant Help's 1-minute
// tickInstantHelp cadence, so this runs every 15 minutes. No billing
// side-effect - bookings have never had one. Single equality-filter
// query (status=="accepted"), same "fetch a bounded batch, evaluate in
// code" shape tickInstantHelp already uses, so no new Firestore index is
// needed.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
function nowIST(): { date: string; time: string } {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const iso = ist.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export const tickBookingCompletion = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .pubsub.schedule("every 15 minutes")
  .onRun(async () => {
    const { date: todayDate, time: nowTime } = nowIST();

    const snap = await db.collection("bookings")
      .where("status", "==", "accepted")
      .limit(500) // one run's worth — next run catches the rest
      .get();

    const toComplete = snap.docs.filter((d) => {
      const b = d.data();
      const bd = b.requestedDate as string | undefined;
      const bt = b.requestedEndTime as string | undefined;
      if (typeof bd !== "string" || typeof bt !== "string") return false;
      return bd < todayDate || (bd === todayDate && bt <= nowTime);
    });

    if (toComplete.length === 0) return null;

    const batch = db.batch();
    toComplete.forEach((d) => batch.update(d.ref, {
      status: "completed" as BookingStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }));
    await batch.commit();
    console.log(`✅ tickBookingCompletion: completed ${toComplete.length} booking(s)`);

    // Best-effort — never blocks the sweep itself.
    await Promise.allSettled(toComplete.map((d) => {
      const b = d.data();
      const tutorLabel = (b.tutorName as string | undefined) || "your tutor";
      const studentLabel = (b.studentName as string | undefined) || "the student";
      return Promise.all([
        notifyStudent(b.studentUid, {
          title: "Booking completed",
          body: `Your session with ${tutorLabel} is complete — leave a review!`,
          type: "shikshahub",
        }),
        notifyTutor(b.tutorUid, {
          title: "Booking completed",
          body: `Your session with ${studentLabel} is complete.`,
          type: "shikshahub",
        }),
      ]);
    })).then((results) => {
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.warn(`tickBookingCompletion: notify failed for booking ${toComplete[i].id}:`, r.reason);
        }
      });
    });

    return null;
  });
