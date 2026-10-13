"use strict";
// PATH: functions/src/tutorServices.ts
// ShikshaHub Phase 3 — a tutor's own bookable services
// (tutorServices/{serviceId}). Same v1 onCall convention as
// tutorBooking.ts/tutorAccounts.ts (context.auth populated automatically).
//
// Client never writes tutorServices/{serviceId} directly — firestore.rules
// has `allow write: if false` on this collection, exactly mirroring how
// bookings/{id} stays closed to client writes and only these Admin-SDK
// callables can create/edit/delete a service. This is deliberate: every
// numeric/enum field here (fee, serviceType, deliveryMode, date range)
// needs real validation that's awkward to express fully in rules language,
// and per the approved Phase 3 scope, a client must never be able to write
// its own sessionFee/creditsPerMinute directly into a doc a student will
// later read as authoritative.
//
// Migration note (see tutorBooking.ts's header comment for the full
// legacy-fallback rule this collection's mere existence drives): creating
// a tutor's FIRST service here is also the moment requestBooking stops
// accepting the legacy flat-tutors-doc booking path for that tutor.
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTutorServiceMarketplace = exports.deleteService = exports.updateService = exports.createService = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const firestore_1 = require("firebase-functions/v2/firestore");
const db = admin.firestore();
const SERVICE_TYPES = ["one_time", "short_term", "long_term", "instant_help"];
const DELIVERY_MODES = ["online", "offline", "online_offline"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Shared validation for both createService and updateService — throws an
// HttpsError on the first problem found. `partial` relaxes required-field
// checks for updateService, which only validates whatever fields are
// actually present in the patch.
function validateServiceInput(input, partial) {
    if (!partial || input.serviceName !== undefined) {
        if (!input.serviceName || !input.serviceName.trim()) {
            throw new functionsV1.https.HttpsError("invalid-argument", "serviceName is required");
        }
    }
    if (!partial || input.subject !== undefined) {
        if (!input.subject || !input.subject.trim()) {
            throw new functionsV1.https.HttpsError("invalid-argument", "subject is required");
        }
    }
    if (!partial || input.serviceType !== undefined) {
        if (!input.serviceType || !SERVICE_TYPES.includes(input.serviceType)) {
            throw new functionsV1.https.HttpsError("invalid-argument", `serviceType must be one of: ${SERVICE_TYPES.join(", ")}`);
        }
    }
    if (!partial || input.deliveryMode !== undefined) {
        if (!input.deliveryMode || !DELIVERY_MODES.includes(input.deliveryMode)) {
            throw new functionsV1.https.HttpsError("invalid-argument", `deliveryMode must be one of: ${DELIVERY_MODES.join(", ")}`);
        }
    }
    if (input.topics !== undefined && !Array.isArray(input.topics)) {
        throw new functionsV1.https.HttpsError("invalid-argument", "topics must be an array of strings");
    }
    const isInstantHelp = input.serviceType === "instant_help";
    if (isInstantHelp) {
        if (input.creditsPerMinute !== undefined && (!Number.isFinite(input.creditsPerMinute) || input.creditsPerMinute <= 0)) {
            throw new functionsV1.https.HttpsError("invalid-argument", "creditsPerMinute must be a positive number");
        }
        if (input.minimumDurationMinutes !== undefined && (!Number.isInteger(input.minimumDurationMinutes) || input.minimumDurationMinutes <= 0)) {
            throw new functionsV1.https.HttpsError("invalid-argument", "minimumDurationMinutes must be a positive integer");
        }
        if (input.maximumDurationMinutes !== undefined && input.minimumDurationMinutes !== undefined
            && input.maximumDurationMinutes < input.minimumDurationMinutes) {
            throw new functionsV1.https.HttpsError("invalid-argument", "maximumDurationMinutes must be >= minimumDurationMinutes");
        }
    }
    else {
        // one_time / short_term / long_term — scheduled, session-fee-priced.
        if (!partial || input.sessionFee !== undefined) {
            if (!Number.isInteger(input.sessionFee) || input.sessionFee <= 0) {
                throw new functionsV1.https.HttpsError("invalid-argument", "sessionFee must be a positive integer");
            }
        }
        if (input.durationMinutes !== undefined && (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0)) {
            throw new functionsV1.https.HttpsError("invalid-argument", "durationMinutes must be a positive integer");
        }
        if (input.serviceType === "short_term" || input.serviceType === "long_term") {
            if (input.numberOfSessions !== undefined && (!Number.isInteger(input.numberOfSessions) || input.numberOfSessions <= 0)) {
                throw new functionsV1.https.HttpsError("invalid-argument", "numberOfSessions must be a positive integer");
            }
            if (input.sessionsPerWeek !== undefined && (!Number.isInteger(input.sessionsPerWeek) || input.sessionsPerWeek <= 0)) {
                throw new functionsV1.https.HttpsError("invalid-argument", "sessionsPerWeek must be a positive integer");
            }
            if (input.startDate !== undefined && input.startDate !== "" && !DATE_RE.test(input.startDate)) {
                throw new functionsV1.https.HttpsError("invalid-argument", "startDate must be YYYY-MM-DD");
            }
            if (input.endDate !== undefined && input.endDate !== "" && !DATE_RE.test(input.endDate)) {
                throw new functionsV1.https.HttpsError("invalid-argument", "endDate must be YYYY-MM-DD");
            }
            if (input.startDate && input.endDate && input.endDate < input.startDate) {
                throw new functionsV1.https.HttpsError("invalid-argument", "endDate must be on/after startDate");
            }
        }
    }
}
// Strip anything not in the known-field allowlist — a client can never
// smuggle an arbitrary field (e.g. tutorUid, published-as-true-on-create-
// bypassing-review) through the input object.
function pickServiceFields(input) {
    const out = {};
    const keys = [
        "serviceName", "description", "subject", "topics", "serviceType", "deliveryMode",
        "durationMinutes", "numberOfSessions", "sessionsPerWeek", "startDate", "endDate",
        "sessionFee", "trialAvailable", "availability",
        "creditsPerMinute", "minimumDurationMinutes", "maximumDurationMinutes",
    ];
    for (const k of keys) {
        if (input[k] !== undefined)
            out[k] = input[k];
    }
    if (typeof out.serviceName === "string")
        out.serviceName = out.serviceName.trim();
    if (typeof out.subject === "string")
        out.subject = out.subject.trim();
    if (typeof out.description === "string")
        out.description = out.description.trim();
    return out;
}
// ─── createService ──────────────────────────────────────────────────────────
exports.createService = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    // Real "is this caller a tutor" check — a tutors/{uid} profile doc
    // existing, matching requestBooking's own students/{uid} existence
    // check for the same reason.
    const tutorSnap = await db.doc(`tutors/${tutorUid}`).get();
    if (!tutorSnap.exists) {
        throw new functionsV1.https.HttpsError("permission-denied", "Only tutor accounts can create a service");
    }
    validateServiceInput(data ?? {}, /* partial */ false);
    const fields = pickServiceFields(data ?? {});
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = db.collection("tutorServices").doc();
    await ref.set({
        ...fields,
        tutorUid,
        // Always created as a draft — a tutor explicitly publishes via
        // updateService({ published: true }) once they're happy with it,
        // never published: true straight out of createService.
        published: false,
        createdAt: now,
        updatedAt: now,
    });
    console.log(`✅ Service created: ${ref.id} tutor=${tutorUid}`);
    return { serviceId: ref.id };
});
// ─── updateService ──────────────────────────────────────────────────────────
exports.updateService = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    const { serviceId, ...rest } = data ?? {};
    if (!serviceId || typeof serviceId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "serviceId is required");
    }
    const ref = db.doc(`tutorServices/${serviceId}`);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Service not found");
    }
    if (snap.data().tutorUid !== tutorUid) {
        throw new functionsV1.https.HttpsError("permission-denied", "This service doesn't belong to you");
    }
    // published is validated/applied separately from the rest of the
    // allowlist — a plain boolean the tutor toggles, no format checks
    // needed beyond "is it actually a boolean".
    const patch = {};
    if (Object.keys(rest).length > 0) {
        // Merge onto the existing doc for cross-field validation (e.g.
        // updating just startDate still needs to check it against the
        // stored endDate, not undefined).
        const merged = { ...snap.data(), ...rest };
        validateServiceInput(merged, /* partial */ true);
        Object.assign(patch, pickServiceFields(rest));
    }
    if (typeof data?.published === "boolean") {
        patch.published = data.published;
    }
    if (Object.keys(patch).length === 0) {
        throw new functionsV1.https.HttpsError("invalid-argument", "No valid fields to update");
    }
    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await ref.update(patch);
    console.log(`✅ Service updated: ${serviceId} tutor=${tutorUid}`);
    return { serviceId };
});
// ─── deleteService ──────────────────────────────────────────────────────────
// Historical bookings snapshot everything they need at request time (see
// tutorBooking.ts) — deleting a service here never corrupts a past
// booking, it only removes it from future discovery/booking.
exports.deleteService = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    const { serviceId } = data ?? {};
    if (!serviceId || typeof serviceId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "serviceId is required");
    }
    const ref = db.doc(`tutorServices/${serviceId}`);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Service not found");
    }
    if (snap.data().tutorUid !== tutorUid) {
        throw new functionsV1.https.HttpsError("permission-denied", "This service doesn't belong to you");
    }
    await ref.delete();
    console.log(`✅ Service deleted: ${serviceId} tutor=${tutorUid}`);
    return { serviceId };
});
// ─── syncTutorServiceMarketplace ────────────────────────────────────────────
// Mirrors a service into tutorServicesMarketplace/{serviceId} — the
// public-safe collection students actually browse/read — whenever it's
// both published AND its owning tutor is verified, and deletes the mirror
// otherwise. Same shape as tutorMarketplace.ts's syncTutorMarketplaceProfile
// trigger, one extra read (the parent tutor doc) since "verified" lives
// there, not on the service itself — defense in depth, same reasoning
// requestBooking already applies by re-checking tutor.verified server-side
// rather than trusting a stale/client-supplied flag.
exports.syncTutorServiceMarketplace = (0, firestore_1.onDocumentWritten)({ document: "tutorServices/{serviceId}" }, async (event) => {
    const change = event.data;
    if (!change)
        return null;
    const { serviceId } = event.params;
    const mirrorRef = db.doc(`tutorServicesMarketplace/${serviceId}`);
    const after = change.after.exists ? change.after.data() : null;
    try {
        if (!after?.published) {
            await mirrorRef.delete();
            return null;
        }
        const tutorSnap = await db.doc(`tutors/${after.tutorUid}`).get();
        const tutor = tutorSnap.data();
        if (!tutorSnap.exists || tutor?.verified !== true) {
            await mirrorRef.delete();
            return null;
        }
        const { published, ...rest } = after;
        void published; // never mirrored — the mirror only ever contains published services by construction
        await mirrorRef.set({
            ...rest,
            tutorUid: after.tutorUid,
            tutorName: tutor?.name ?? "",
            tutorVerified: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: false });
    }
    catch (e) {
        console.error(`syncTutorServiceMarketplace(${serviceId}) error:`, e);
    }
    return null;
});
//# sourceMappingURL=tutorServices.js.map