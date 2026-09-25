"use strict";
// PATH: functions/src/vidyastarContest.ts
// Server-side, atomic version of joining a VidyaStar contest.
//
// The client-side implementation (apps/mobile & apps/web
// services/joinContest.ts) used to do this as three separate,
// non-transactional steps: check contests/{id}/participant/{uid} for
// already-joined, read+debit V-Coins via a client runTransaction, then
// setDoc the participant doc. firestore.rules' `participant` subcollection
// allowed any authenticated user to `create` their own doc there with
// arbitrary field values (entryFeePaid, sponsored, ...) — nothing enforced
// that those values were true, so a client could write straight past this
// whole flow and join any paid contest for free. This callable is now the
// ONLY way a participant doc gets created (firestore.rules locks the
// subcollection's `create` rule to admin-only / Admin-SDK-only), and does
// the existence check, balance check, debit, participant write, and
// contest.joinedCount increment in a single Firestore transaction so two
// concurrent join attempts (e.g. a double-tap) can't double-charge or
// double-join.
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteContest = exports.joinVidyastarContest = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const db = admin.firestore();
exports.joinVidyastarContest = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const contestId = (data?.contestId ?? "").trim();
    if (!contestId) {
        throw new functionsV1.https.HttpsError("invalid-argument", "contestId is required");
    }
    const contestRef = db.doc(`contests/${contestId}`);
    const participantRef = contestRef.collection("participant").doc(uid);
    const userRef = db.doc(`users/${uid}`);
    const studentRef = db.doc(`students/${uid}`);
    return db.runTransaction(async (tx) => {
        const [contestSnap, participantSnap, userSnap, studentSnap] = await Promise.all([
            tx.get(contestRef),
            tx.get(participantRef),
            tx.get(userRef),
            tx.get(studentRef),
        ]);
        if (!contestSnap.exists) {
            throw new functionsV1.https.HttpsError("not-found", "Contest not found");
        }
        const contest = contestSnap.data();
        if (contest.isActive === false) {
            throw new functionsV1.https.HttpsError("failed-precondition", "This contest is no longer active");
        }
        if (participantSnap.exists) {
            return { status: "already_joined" };
        }
        const totalSpots = Number(contest.totalSpots) || 0;
        const joinedCount = Number(contest.joinedCount) || 0;
        if (totalSpots > 0 && joinedCount >= totalSpots) {
            throw new functionsV1.https.HttpsError("resource-exhausted", "This contest is full");
        }
        const fee = contest.isSponsored ? 0 : Math.max(0, Number(contest.vCoinEntryFee) || 0);
        // Same combined-pool eligibility check as the client's debitVCoins —
        // vCoinsBalance (client-earned) + vCoins (server-earned, e.g. Daily
        // Streak Quiz) is the balance shown everywhere in the UI.
        const balancePart = userSnap.exists ? (userSnap.data()?.vCoinsBalance ?? 0) : 0;
        const streakPart = userSnap.exists ? (userSnap.data()?.vCoins ?? 0) : 0;
        const balance = balancePart + streakPart;
        if (fee > 0 && balance < fee) {
            return { status: "insufficient_balance", required: fee, balance };
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        if (fee > 0) {
            tx.update(userRef, {
                vCoinsBalance: balancePart - fee,
                vCoinsLifetimeSpent: admin.firestore.FieldValue.increment(fee),
                vCoinsUpdatedAt: now,
            });
            const txRef = userRef.collection("vCoinTransactions").doc();
            tx.set(txRef, {
                type: "DEBIT",
                amount: fee,
                source: "VIDYASTAR_CONTEST_JOIN_FEE",
                title: `Joined "${contest.title ?? "VidyaStar Contest"}"`,
                description: "V-Coins entry fee for VidyaStar contest",
                status: "SUCCESS",
                referenceId: `${contestId}_${uid}`,
                metadata: { contestId, contestTitle: contest.title ?? null },
                createdAt: now,
                updatedAt: now,
            });
        }
        tx.set(participantRef, {
            userId: uid,
            // Denormalized at join time via the Admin SDK — firestore.rules
            // locks students/{uid} reads to the student's own uid (or an
            // admin), so the leaderboard screen can never read another
            // participant's name directly. Reading it here once and storing it
            // on the participant doc (world-readable, see this file's own
            // participant.read rule) is what actually makes names show up.
            name: studentSnap.exists ? (studentSnap.data()?.name ?? "Student") : "Student",
            contestId,
            joinedAt: now,
            score: 0,
            completed: false,
            entryFeePaid: fee,
            sponsored: !!contest.isSponsored,
        });
        tx.update(contestRef, {
            joinedCount: admin.firestore.FieldValue.increment(1),
            updatedAt: now,
        });
        console.log(`✅ VidyaStar join: user=${uid} contest=${contestId} fee=${fee}`);
        return { status: "joined", feePaid: fee };
    });
});
// Admin-only. firestore.rules allows admins to `delete` the contest doc
// directly, but denies delete on the participant subcollection entirely
// (same reason join/submit are Cloud-Function-only — see the comment at
// the top of this file and submitVidyastarContestQuiz.ts). A plain client
// deleteDoc would therefore leave every participant doc orphaned under a
// contest ID that no longer exists. recursiveDelete (Admin SDK only) wipes
// the contest doc and its entire participant subcollection atomically.
exports.deleteContest = functionsV1
    .runWith({ timeoutSeconds: 60, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admin access required");
    }
    const contestId = (data?.contestId ?? "").trim();
    if (!contestId) {
        throw new functionsV1.https.HttpsError("invalid-argument", "contestId is required");
    }
    const contestRef = db.doc(`contests/${contestId}`);
    const snap = await contestRef.get();
    if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Contest not found");
    }
    await db.recursiveDelete(contestRef);
    console.log(`🗑️ Contest deleted: id=${contestId} by=${context.auth.uid}`);
    return { success: true };
});
//# sourceMappingURL=vidyastarContest.js.map