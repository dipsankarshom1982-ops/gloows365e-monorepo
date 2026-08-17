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

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

type SessionType = "trial" | "regular";
type BookingStatus = "requested" | "accepted" | "declined" | "cancelled";

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
      tutorUid, subject, sessionType,
      requestedDate, requestedStartTime, requestedEndTime,
    } = data ?? {};

    if (!tutorUid || typeof tutorUid !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "tutorUid is required");
    }
    if (!subject || typeof subject !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "subject is required");
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

    const tutorSubjects: string[] = Array.isArray(tutor.subjects) ? tutor.subjects : [];
    if (!tutorSubjects.includes(subject)) {
      throw new functionsV1.https.HttpsError("invalid-argument", "subject must be one this tutor teaches");
    }

    // Server-resolved, never client-sent — there is no payment in Phase 1,
    // but the fee is still snapshotted from the tutor's own doc, exactly
    // the "never trust a client-sent amount" rule aiGuruCredits.ts follows
    // for its (real, Phase-2-relevant) payment flow.
    const sessionFee = Number(tutor.sessionFee);
    if (!Number.isInteger(sessionFee) || sessionFee <= 0) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This tutor hasn't set a session fee yet");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const bookingRef = db.collection("bookings").doc();
    await bookingRef.set({
      studentUid,
      tutorUid,
      subject,
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
      createdAt: now,
      updatedAt: now,
    });

    console.log(`✅ Booking requested: ${bookingRef.id} student=${studentUid} tutor=${tutorUid}`);
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
