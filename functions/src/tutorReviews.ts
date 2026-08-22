// PATH: functions/src/tutorReviews.ts
// ShikshaHub Phase 6 — tutor ratings & reviews. Same v1 onCall convention
// as every other ShikshaHub callable.
//
// Approved Phase 6 scope: reviewable only off a completed
// instantHelpSessions/{id} (status === "ended") — bookings/{id} has no
// "completed" concept at all today, so scheduled sessions are explicitly
// NOT reviewable yet (later-phase scope, same discipline every prior
// phase followed rather than inventing scope). One review per session:
// tutorReviews/{sessionId} uses the session's own id as the review doc id,
// so "already reviewed" is a single existence check inside the same
// transaction that creates it — a student can never leave two reviews for
// one session by construction.
//
// tutors/{uid}.ratingSum/ratingCount/ratingAverage are maintained
// transactionally here (never recomputed by scanning tutorReviews
// client-side) and mirrored to tutorMarketplaceProfiles/{uid} by
// tutorMarketplace.ts's existing SAFE_FIELDS-driven sync trigger — this
// file just adds the two public fields to that allowlist.
//
// Client never writes tutorReviews/{id} directly — firestore.rules has
// `allow write: if false`, same closed-write pattern every other
// ShikshaHub collection uses. submitTutorReview (student, owner of the
// session) creates it; hideTutorReview (admin) is the only thing that
// ever updates it afterward.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

const MAX_REVIEW_TEXT_LENGTH = 1000;

function roundToOneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── submitTutorReview ───────────────────────────────────────────────────────
export const submitTutorReview = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (
    data: { sessionId?: string; rating?: number; reviewText?: string },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const studentUid = context.auth.uid;
    const { sessionId, rating, reviewText } = data ?? {};

    if (!sessionId || typeof sessionId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "sessionId is required");
    }
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
      throw new functionsV1.https.HttpsError("invalid-argument", "rating must be an integer from 1 to 5");
    }
    const trimmedText = typeof reviewText === "string" ? reviewText.trim().slice(0, MAX_REVIEW_TEXT_LENGTH) : "";

    const sessionSnap = await db.doc(`instantHelpSessions/${sessionId}`).get();
    if (!sessionSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Session not found");
    }
    const session = sessionSnap.data()!;
    if (session.studentUid !== studentUid) {
      throw new functionsV1.https.HttpsError("permission-denied", "This session doesn't belong to you");
    }
    if (session.status !== "ended") {
      throw new functionsV1.https.HttpsError("failed-precondition", "You can only review a session after it has ended");
    }

    const studentSnap = await db.doc(`students/${studentUid}`).get();
    const tutorUid = session.tutorUid as string;
    const reviewRef = db.doc(`tutorReviews/${sessionId}`);
    const tutorRef = db.doc(`tutors/${tutorUid}`);

    await db.runTransaction(async (tx) => {
      const [existingReview, tutorSnap] = await Promise.all([tx.get(reviewRef), tx.get(tutorRef)]);
      if (existingReview.exists) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This session has already been reviewed");
      }

      const tutor = tutorSnap.exists ? tutorSnap.data()! : {};
      const newSum = (Number(tutor.ratingSum) || 0) + (rating as number);
      const newCount = (Number(tutor.ratingCount) || 0) + 1;
      const newAverage = roundToOneDecimal(newSum / newCount);

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(reviewRef, {
        sessionId,
        studentUid,
        tutorUid,
        serviceId: session.serviceId ?? null,
        subject: session.subject ?? "",
        rating,
        reviewText: trimmedText,
        studentName: (studentSnap.exists ? (studentSnap.data()?.name as string | undefined) : undefined) ?? "",
        hidden: false,
        createdAt: now,
        updatedAt: now,
      });

      tx.set(tutorRef, {
        ratingSum: newSum,
        ratingCount: newCount,
        ratingAverage: newAverage,
        updatedAt: now,
      }, { merge: true });
    });

    console.log(`✅ Review submitted: session=${sessionId} student=${studentUid} tutor=${tutorUid} rating=${rating}`);
    return { reviewId: sessionId };
  });

// ─── hideTutorReview (admin) ─────────────────────────────────────────────────
// Moderate, don't destroy — the review doc is never deleted, only excluded
// from the tutor's public aggregate and from useTutorReviews' default
// query. Idempotent: hiding an already-hidden review (or unhiding an
// already-visible one) is a no-op on the aggregate, only the
// reason/updatedAt fields change.
export const hideTutorReview = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: { reviewId?: string; hidden?: boolean; reason?: string }, context) => {
    if (!context.auth?.token?.admin) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const adminUid = context.auth.uid;
    const { reviewId, hidden, reason } = data ?? {};
    if (!reviewId || typeof reviewId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "reviewId is required");
    }
    if (typeof hidden !== "boolean") {
      throw new functionsV1.https.HttpsError("invalid-argument", "hidden must be a boolean");
    }

    const reviewRef = db.doc(`tutorReviews/${reviewId}`);

    await db.runTransaction(async (tx) => {
      const reviewSnap = await tx.get(reviewRef);
      if (!reviewSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Review not found");
      }
      const review = reviewSnap.data()!;
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (review.hidden === hidden) {
        // No aggregate change — just update the moderation note.
        tx.update(reviewRef, { hiddenBy: adminUid, hiddenReason: reason ?? null, updatedAt: now });
        return;
      }

      const tutorRef = db.doc(`tutors/${review.tutorUid}`);
      const tutorSnap = await tx.get(tutorRef);
      const tutor = tutorSnap.exists ? tutorSnap.data()! : {};
      const delta = hidden ? -Number(review.rating) : Number(review.rating);
      const countDelta = hidden ? -1 : 1;

      const newSum = Math.max(0, (Number(tutor.ratingSum) || 0) + delta);
      const newCount = Math.max(0, (Number(tutor.ratingCount) || 0) + countDelta);
      const newAverage = newCount > 0 ? roundToOneDecimal(newSum / newCount) : 0;

      tx.set(tutorRef, {
        ratingSum: newSum,
        ratingCount: newCount,
        ratingAverage: newAverage,
        updatedAt: now,
      }, { merge: true });

      tx.update(reviewRef, {
        hidden,
        hiddenBy: adminUid,
        hiddenReason: reason ?? null,
        updatedAt: now,
      });
    });

    console.log(`✅ Review ${reviewId} ${hidden ? "hidden" : "unhidden"} by admin ${adminUid}`);
    return { reviewId, hidden };
  });
