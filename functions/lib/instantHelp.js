"use strict";
// PATH: functions/src/instantHelp.ts
// ShikshaHub Phase 4 — the real-time Instant Help matching/session/billing
// engine that Phase 3's instant_help TutorService deliberately left
// unbuilt (see tutorService.ts's header comment, and requestBooking's own
// outright rejection of instant_help services). Same v1 onCall convention
// as tutorBooking.ts/tutorServices.ts.
//
// Direct-request matching (approved Phase 4 scope): a student picks ONE
// online, eligible tutor and sends a request via requestInstantHelp; that
// tutor accepts or declines via respondToInstantHelpRequest, or the
// request auto-expires unanswered after REQUEST_TIMEOUT_MS. No
// broadcast-to-many-tutors fan-out. Accepting creates an
// instantHelpSessions/{id} doc immediately — the session "starts" at
// accept time, there's no separate ready-check step.
//
// No in-app call/video/chat this phase — a session is a billed timer, not
// a communication channel. Student and tutor reach each other outside the
// app, same implicit assumption scheduled bookings already make (nothing
// in tutorBooking.ts models *how* a session is actually conducted either).
//
// Billing (approved Phase 4 scope: real-time ticking debit, auto-end at
// zero balance): tickInstantHelp, a scheduled function, settles every
// active session roughly once a minute via settleInstantHelpSession() —
// the ONE function that ever turns elapsed session time into a debit
// (student's tutorCredits/{uid}) + matching credit (tutor's
// tutorEarnings/{uid}), inside a single transaction. endInstantHelpSession
// calls the exact same function (with a manual end reason) so a session
// ended mid-minute still gets any full elapsed minute(s) billed before it
// closes — there's deliberately only one billing code path, not two that
// could drift apart.
//
// No platform commission this phase — a tutor's tutorEarnings credit
// exactly matches the student's tutorCredits debit for each settled batch
// of minutes. No payout/withdrawal flow either — nothing in this codebase
// pays any balance out to a bank account today (see tutorCredits.ts's
// header comment); that's later-phase scope, not something to invent here.
//
// Client never writes instantHelpRequests/{id} or instantHelpSessions/{id}
// directly — firestore.rules has `allow write: if false` on both, exactly
// mirroring bookings/{id} — every write goes through this file's
// Admin-SDK callables/scheduled function.
Object.defineProperty(exports, "__esModule", { value: true });
exports.tickInstantHelp = exports.endInstantHelpSession = exports.cancelInstantHelpRequest = exports.respondToInstantHelpRequest = exports.requestInstantHelp = exports.setInstantHelpOnlineStatus = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const db = admin.firestore();
const TUTOR_ROLE_CLAIMS = ["TUTOR", "TEACHER", "COACHING_CENTER"];
const REQUEST_TIMEOUT_MS = 60000; // tutor has 60s to accept/decline
// ─── setInstantHelpOnlineStatus ─────────────────────────────────────────────
// A tutor's own live presence toggle — distinct from any tutorServices/{id}
// config, which is static. Mirrored into tutorMarketplaceProfiles/{uid} by
// tutorMarketplace.ts's existing syncTutorMarketplaceProfile trigger (this
// file just adds the field to that trigger's SAFE_FIELDS list) so students
// see it live without a second mirror collection.
exports.setInstantHelpOnlineStatus = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    if (typeof data?.online !== "boolean") {
        throw new functionsV1.https.HttpsError("invalid-argument", "online must be a boolean");
    }
    const tutorRef = db.doc(`tutors/${tutorUid}`);
    const tutorSnap = await tutorRef.get();
    if (!tutorSnap.exists) {
        throw new functionsV1.https.HttpsError("permission-denied", "Only tutor accounts can set this");
    }
    // Going online with zero published instant_help services would just
    // be a dead end for any student who sees it — so this endpoint is the
    // one enforcement point that stops that state from ever being set,
    // rather than every reader having to re-check it.
    if (data.online) {
        const svc = await db.collection("tutorServices")
            .where("tutorUid", "==", tutorUid)
            .where("serviceType", "==", "instant_help")
            .where("published", "==", true)
            .limit(1)
            .get();
        if (svc.empty) {
            throw new functionsV1.https.HttpsError("failed-precondition", "Publish an Instant Help service before going online");
        }
    }
    await tutorRef.update({
        isOnlineForInstantHelp: data.online,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Instant Help online status: tutor=${tutorUid} online=${data.online}`);
    return { online: data.online };
});
// ─── requestInstantHelp ─────────────────────────────────────────────────────
exports.requestInstantHelp = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const studentUid = context.auth.uid;
    const callerRole = context.auth.token?.role;
    if (callerRole && TUTOR_ROLE_CLAIMS.includes(callerRole)) {
        throw new functionsV1.https.HttpsError("permission-denied", "Only student accounts can request Instant Help");
    }
    const { tutorUid, serviceId } = data ?? {};
    if (!tutorUid || typeof tutorUid !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "tutorUid is required");
    }
    if (!serviceId || typeof serviceId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "serviceId is required");
    }
    const studentSnap = await db.doc(`students/${studentUid}`).get();
    if (!studentSnap.exists) {
        throw new functionsV1.https.HttpsError("permission-denied", "Only student accounts can request Instant Help");
    }
    const tutorSnap = await db.doc(`tutors/${tutorUid}`).get();
    if (!tutorSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Tutor not found");
    }
    const tutor = tutorSnap.data();
    if (tutor.verified !== true) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This tutor isn't verified yet");
    }
    if (tutor.isOnlineForInstantHelp !== true) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This tutor isn't online for Instant Help right now");
    }
    const serviceSnap = await db.doc(`tutorServices/${serviceId}`).get();
    if (!serviceSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Service not found");
    }
    const service = serviceSnap.data();
    if (service.tutorUid !== tutorUid) {
        throw new functionsV1.https.HttpsError("invalid-argument", "serviceId does not belong to the given tutor");
    }
    if (service.published !== true) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This service is not currently available");
    }
    if (service.serviceType !== "instant_help") {
        throw new functionsV1.https.HttpsError("invalid-argument", "This service isn't an Instant Help service");
    }
    const creditsPerMinute = Number(service.creditsPerMinute);
    if (!Number.isFinite(creditsPerMinute) || creditsPerMinute <= 0) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This service hasn't set a rate yet");
    }
    const now = Date.now();
    const requestsCol = db.collection("instantHelpRequests");
    const sessionsCol = db.collection("instantHelpSessions");
    const requestRef = requestsCol.doc();
    const result = await db.runTransaction(async (tx) => {
        // Race-closing: everything that decides whether this request is
        // even allowed to be created is re-checked inside the transaction,
        // same reasoning respondToBooking's transaction already applies to
        // the accept/decline race.
        const [studentPendingSnap, studentActiveSnap, tutorPendingSnap, tutorActiveSnap, balanceSnap,] = await Promise.all([
            tx.get(requestsCol.where("studentUid", "==", studentUid).where("status", "==", "pending")),
            tx.get(sessionsCol.where("studentUid", "==", studentUid).where("status", "==", "active").limit(1)),
            tx.get(requestsCol.where("tutorUid", "==", tutorUid).where("status", "==", "pending")),
            tx.get(sessionsCol.where("tutorUid", "==", tutorUid).where("status", "==", "active").limit(1)),
            tx.get(db.doc(`tutorCredits/${studentUid}`)),
        ]);
        const studentHasLivePending = studentPendingSnap.docs.some((d) => (d.data().expiresAt?.toMillis?.() ?? 0) > now);
        if (studentHasLivePending) {
            throw new functionsV1.https.HttpsError("failed-precondition", "You already have a pending Instant Help request");
        }
        if (!studentActiveSnap.empty) {
            throw new functionsV1.https.HttpsError("failed-precondition", "You already have an active Instant Help session");
        }
        const tutorHasLivePending = tutorPendingSnap.docs.some((d) => (d.data().expiresAt?.toMillis?.() ?? 0) > now);
        if (tutorHasLivePending || !tutorActiveSnap.empty) {
            throw new functionsV1.https.HttpsError("failed-precondition", "This tutor is currently busy — try again shortly");
        }
        const balance = balanceSnap.exists ? Number(balanceSnap.data()?.balance ?? 0) : 0;
        if (balance < creditsPerMinute) {
            throw new functionsV1.https.HttpsError("failed-precondition", `You need at least ${creditsPerMinute} credit${creditsPerMinute === 1 ? "" : "s"} to start — your balance is ${balance}`);
        }
        const nowFv = admin.firestore.FieldValue.serverTimestamp();
        tx.set(requestRef, {
            studentUid,
            tutorUid,
            serviceId,
            subject: service.subject ?? "",
            topics: Array.isArray(service.topics) ? service.topics : [],
            creditsPerMinute,
            status: "pending",
            studentName: studentSnap.data()?.name ?? "",
            tutorName: tutor.name ?? "",
            expiresAt: admin.firestore.Timestamp.fromMillis(now + REQUEST_TIMEOUT_MS),
            createdAt: nowFv,
            updatedAt: nowFv,
        });
        return { requestId: requestRef.id };
    });
    console.log(`✅ Instant Help requested: ${result.requestId} student=${studentUid} tutor=${tutorUid} service=${serviceId}`);
    return { requestId: result.requestId, status: "pending" };
});
// ─── respondToInstantHelpRequest ────────────────────────────────────────────
exports.respondToInstantHelpRequest = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    const { requestId, action } = data ?? {};
    if (!requestId || typeof requestId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "requestId is required");
    }
    if (action !== "accepted" && action !== "declined") {
        throw new functionsV1.https.HttpsError("invalid-argument", 'action must be "accepted" or "declined"');
    }
    const requestRef = db.doc(`instantHelpRequests/${requestId}`);
    const sessionRef = db.collection("instantHelpSessions").doc();
    const outcome = await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists)
            return { kind: "not_found" };
        const request = snap.data();
        if (request.tutorUid !== tutorUid)
            return { kind: "wrong_tutor" };
        if (request.status !== "pending")
            return { kind: "already_resolved", status: request.status };
        const now = Date.now();
        const expiresAtMs = request.expiresAt?.toMillis?.() ?? 0;
        if (now > expiresAtMs) {
            tx.update(requestRef, {
                status: "expired",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { kind: "expired" };
        }
        if (action === "declined") {
            tx.update(requestRef, {
                status: "declined",
                respondedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { kind: "declined" };
        }
        // action === "accepted" — defense-in-depth re-check of the balance
        // requestInstantHelp already validated at request time. Only way
        // this could now fail is if something else spent the student's
        // balance in between (nothing else does — see this file's header
        // comment), so this is a belt-and-suspenders guard, not an expected
        // path.
        const creditsPerMinute = Number(request.creditsPerMinute) || 0;
        const balanceSnap = await tx.get(db.doc(`tutorCredits/${request.studentUid}`));
        const balance = balanceSnap.exists ? Number(balanceSnap.data()?.balance ?? 0) : 0;
        if (balance < creditsPerMinute) {
            tx.update(requestRef, {
                status: "declined",
                respondedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { kind: "insufficient_balance" };
        }
        const nowFv = admin.firestore.FieldValue.serverTimestamp();
        const nowTs = admin.firestore.Timestamp.now();
        tx.set(sessionRef, {
            requestId,
            studentUid: request.studentUid,
            tutorUid: request.tutorUid,
            serviceId: request.serviceId,
            subject: request.subject ?? "",
            creditsPerMinute,
            status: "active",
            studentName: request.studentName ?? "",
            tutorName: request.tutorName ?? "",
            startedAt: nowFv,
            lastBilledAt: nowTs,
            minutesBilled: 0,
            totalCreditsCharged: 0,
            createdAt: nowFv,
            updatedAt: nowFv,
        });
        tx.update(requestRef, {
            status: "accepted",
            respondedAt: nowFv,
            updatedAt: nowFv,
        });
        return { kind: "accepted", sessionId: sessionRef.id };
    });
    switch (outcome.kind) {
        case "not_found":
            throw new functionsV1.https.HttpsError("not-found", "Request not found");
        case "wrong_tutor":
            throw new functionsV1.https.HttpsError("permission-denied", "This request doesn't belong to you");
        case "already_resolved":
            throw new functionsV1.https.HttpsError("failed-precondition", `Request is already "${outcome.status}"`);
        case "expired":
            throw new functionsV1.https.HttpsError("failed-precondition", "This request has expired");
        case "insufficient_balance":
            throw new functionsV1.https.HttpsError("failed-precondition", "Student no longer has enough balance to start this session");
        case "declined": {
            const result = { status: "declined" };
            console.log(`✅ Instant Help request ${requestId} declined by tutor ${tutorUid}`);
            return result;
        }
        case "accepted": {
            const result = { status: "accepted", sessionId: outcome.sessionId };
            console.log(`✅ Instant Help request ${requestId} accepted by tutor ${tutorUid}`);
            return result;
        }
    }
});
// ─── cancelInstantHelpRequest ───────────────────────────────────────────────
// Student-side — withdraw a still-"pending" request before the tutor
// responds (and before it auto-expires on its own). Symmetric to
// cancelBooking in tutorBooking.ts, scoped to the student only (unlike
// cancelBooking, which either party can call) — the tutor's own answer IS
// respondToInstantHelpRequest, they don't need a separate cancel path.
exports.cancelInstantHelpRequest = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const studentUid = context.auth.uid;
    const { requestId } = data ?? {};
    if (!requestId || typeof requestId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "requestId is required");
    }
    const requestRef = db.doc(`instantHelpRequests/${requestId}`);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw new functionsV1.https.HttpsError("not-found", "Request not found");
        }
        const request = snap.data();
        if (request.studentUid !== studentUid) {
            throw new functionsV1.https.HttpsError("permission-denied", "This request doesn't belong to you");
        }
        if (request.status !== "pending") {
            throw new functionsV1.https.HttpsError("failed-precondition", `Request is already "${request.status}"`);
        }
        tx.update(requestRef, {
            status: "cancelled",
            respondedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { status: "cancelled" };
    });
    console.log(`✅ Instant Help request ${requestId} cancelled by student ${studentUid}`);
    return result;
});
// ─── settleInstantHelpSession ───────────────────────────────────────────────
// The one place elapsed session time ever turns into money moving. Called
// by endInstantHelpSession (with callerUid + a manual end reason, so it can
// verify ownership and force-close in the same transaction) and by
// tickInstantHelp (with neither — a session-status-blind sweep). Idempotent
// against a session that's already "ended" (returns its final state as a
// no-op) so a race between the two callers is harmless.
async function settleInstantHelpSession(sessionId, opts) {
    const sessionRef = db.doc(`instantHelpSessions/${sessionId}`);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists) {
            throw new functionsV1.https.HttpsError("not-found", "Session not found");
        }
        const session = snap.data();
        if (opts?.callerUid && session.studentUid !== opts.callerUid && session.tutorUid !== opts.callerUid) {
            throw new functionsV1.https.HttpsError("permission-denied", "This session doesn't belong to you");
        }
        if (session.status !== "active") {
            return { status: session.status, endReason: session.endReason, minutesCharged: 0 };
        }
        const creditsPerMinute = Number(session.creditsPerMinute) || 0;
        const lastBilledAt = session.lastBilledAt;
        const nowTs = admin.firestore.Timestamp.now();
        const elapsedMinutes = Math.max(0, Math.floor((nowTs.toMillis() - lastBilledAt.toMillis()) / 60000));
        let minutesToCharge = elapsedMinutes;
        let endReason = opts?.manualEndReason;
        let newLastBilledAt = lastBilledAt;
        if (minutesToCharge > 0) {
            const balanceRef = db.doc(`tutorCredits/${session.studentUid}`);
            const balanceSnap = await tx.get(balanceRef);
            const balance = balanceSnap.exists ? Number(balanceSnap.data()?.balance ?? 0) : 0;
            const affordableMinutes = Math.min(minutesToCharge, Math.floor(balance / creditsPerMinute));
            // Only the scheduled sweep (no manual reason given) reports
            // "insufficient_balance" as the cause — a manual end still gets
            // capped at what the student can actually afford, but keeps
            // whichever human ended it as the recorded reason.
            if (affordableMinutes < minutesToCharge && !opts?.manualEndReason) {
                endReason = "insufficient_balance";
            }
            minutesToCharge = affordableMinutes;
            if (minutesToCharge > 0) {
                const amount = minutesToCharge * creditsPerMinute;
                const tutorEarningsRef = db.doc(`tutorEarnings/${session.tutorUid}`);
                const studentTxRef = balanceRef.collection("transactions").doc();
                const tutorTxRef = tutorEarningsRef.collection("transactions").doc();
                const nowFv = admin.firestore.FieldValue.serverTimestamp();
                tx.set(balanceRef, {
                    balance: admin.firestore.FieldValue.increment(-amount),
                    lifetimeSpent: admin.firestore.FieldValue.increment(amount),
                    updatedAt: nowFv,
                }, { merge: true });
                tx.set(studentTxRef, {
                    type: "DEBIT",
                    amount,
                    source: "INSTANT_HELP_SESSION",
                    title: "Instant Help session",
                    description: `${minutesToCharge} minute${minutesToCharge === 1 ? "" : "s"} of Instant Help`,
                    status: "SUCCESS",
                    referenceId: sessionId,
                    metadata: { tutorUid: session.tutorUid, minutesCharged: minutesToCharge },
                    createdAt: nowFv,
                    updatedAt: nowFv,
                });
                tx.set(tutorEarningsRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
                    lifetimeEarned: admin.firestore.FieldValue.increment(amount),
                    updatedAt: nowFv,
                }, { merge: true });
                tx.set(tutorTxRef, {
                    type: "EARNING",
                    amount,
                    source: "INSTANT_HELP_SESSION",
                    title: "Instant Help session",
                    description: `${minutesToCharge} minute${minutesToCharge === 1 ? "" : "s"} of Instant Help`,
                    referenceId: sessionId,
                    metadata: { studentUid: session.studentUid, minutesCharged: minutesToCharge },
                    createdAt: nowFv,
                });
                newLastBilledAt = admin.firestore.Timestamp.fromMillis(lastBilledAt.toMillis() + minutesToCharge * 60000);
            }
        }
        const willEnd = !!endReason;
        if (minutesToCharge === 0 && !willEnd) {
            // Nothing changed — skip the write entirely rather than touching
            // the doc every ~60s for a session that just started.
            return { status: "active", minutesCharged: 0 };
        }
        const patch = {
            lastBilledAt: newLastBilledAt,
            minutesBilled: admin.firestore.FieldValue.increment(minutesToCharge),
            totalCreditsCharged: admin.firestore.FieldValue.increment(minutesToCharge * creditsPerMinute),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (willEnd) {
            patch.status = "ended";
            patch.endReason = endReason;
            patch.endedAt = admin.firestore.FieldValue.serverTimestamp();
        }
        tx.update(sessionRef, patch);
        return {
            status: (willEnd ? "ended" : "active"),
            endReason,
            minutesCharged: minutesToCharge,
        };
    });
}
// ─── endInstantHelpSession ──────────────────────────────────────────────────
exports.endInstantHelpSession = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const callerUid = context.auth.uid;
    const { sessionId } = data ?? {};
    if (!sessionId || typeof sessionId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "sessionId is required");
    }
    // Which side is calling determines the recorded end reason — resolved
    // from the session doc itself inside settleInstantHelpSession's
    // transaction (via callerUid), not trusted from client input, so a
    // caller can't mislabel who ended it.
    const preSnap = await db.doc(`instantHelpSessions/${sessionId}`).get();
    if (!preSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Session not found");
    }
    const pre = preSnap.data();
    const manualEndReason = pre.studentUid === callerUid ? "student_ended" : "tutor_ended";
    const result = await settleInstantHelpSession(sessionId, { callerUid, manualEndReason });
    console.log(`✅ Instant Help session ${sessionId} ended by ${callerUid} (${result.endReason ?? result.status})`);
    return result;
});
// ─── tickInstantHelp ─────────────────────────────────────────────────────────
// Scheduled sweep, once a minute: (1) settle billing for every active
// session — this is what makes billing "real-time ticking" rather than
// only-settled-at-end; (2) expire any pending request the tutor never
// answered, so a student/tutor pair can never get silently stuck "pending"
// forever and block new requests (requestInstantHelp also lazily ignores
// a stale-but-not-yet-swept pending request via its own expiresAt check,
// so this is cleanup, not the only thing enforcing the timeout).
exports.tickInstantHelp = functionsV1
    .runWith({ timeoutSeconds: 300, memory: "256MB" })
    .pubsub.schedule("every 1 minutes")
    .onRun(async () => {
    const activeSnap = await db.collection("instantHelpSessions")
        .where("status", "==", "active")
        .limit(200) // one run's worth — next minute's run catches the rest
        .get();
    const settleResults = await Promise.allSettled(activeSnap.docs.map((d) => settleInstantHelpSession(d.id)));
    settleResults.forEach((r, i) => {
        if (r.status === "rejected") {
            console.error(`tickInstantHelp: settle failed for session ${activeSnap.docs[i].id}:`, r.reason);
        }
    });
    const nowTs = admin.firestore.Timestamp.now();
    const staleSnap = await db.collection("instantHelpRequests")
        .where("status", "==", "pending")
        .where("expiresAt", "<", nowTs)
        .limit(200)
        .get();
    if (!staleSnap.empty) {
        const batch = db.batch();
        staleSnap.docs.forEach((d) => batch.update(d.ref, {
            status: "expired",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }));
        await batch.commit();
        console.log(`✅ tickInstantHelp: expired ${staleSnap.size} stale request(s)`);
    }
    return null;
});
//# sourceMappingURL=instantHelp.js.map