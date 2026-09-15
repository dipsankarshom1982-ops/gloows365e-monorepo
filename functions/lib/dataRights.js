"use strict";
// PATH: functions/src/dataRights.ts
//
// DPDP Act 2023 — data-principal rights ("right to access" / "right to
// erasure"). Two callables:
//   exportMyData    — bundles every collection/subcollection keyed to the
//                      caller's own uid into one JSON object.
//   eraseMyAccount  — cascading delete of the same data, then the Auth user.
//
// Both write an entry to dataRightsLog (admin-readable, client-writable:
// false — see firestore.rules) so there's always an audit trail proving the
// request was received and (eventually) completed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.eraseMyAccount = exports.adminEraseStudent = exports.exportMyData = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const db = admin.firestore();
// ─── Collection inventory ──────────────────────────────────────────────────
// Doc-ID-keyed collections (doc id === uid), optionally with subcollections.
// recursiveDelete() wipes the doc and every subcollection under it in one call.
const DOC_KEYED_COLLECTIONS = [
    "students",
    "users",
    "aiChats",
    "aiNotebook",
    "restartEducationChats",
    "bookmarks",
    "notifications",
    "studentLearnFunProgress",
    "studentDailyStreakProgress",
    "dashboard",
    "aiGuruUsage",
    "discoverUsage",
    "discoverHistory",
    "photoSolveUsage",
    "examSimulator",
    "voiceTutorUsage",
    "adFrequency",
    "leaderboard",
    "vCoins",
    "askGuruUsage",
    "vidyaguruUsage",
    "seekho_subscriptions",
];
// Field-keyed collections — the uid lives in a field, not the doc id, so each
// needs a query. { collection, field }.
const FIELD_KEYED_COLLECTIONS = [
    { collection: "posts", field: "userId" },
    { collection: "attempts", field: "userId" },
    { collection: "stories", field: "userId" },
    { collection: "seekho_progress", field: "userId" },
    { collection: "seekho_revision_queue", field: "userId" },
    { collection: "aiGuruLessons", field: "uid" },
    { collection: "skillboard", field: "userId" },
    { collection: "crashReports", field: "userId" },
];
// Retained for legal/financial-record-keeping reasons (DPDP §7(g)/17) rather
// than hard-deleted — see plan notes. Only PII fields are stripped.
const SCRUB_ONLY_COLLECTIONS = ["subscriptions"];
const STORAGE_PREFIXES = (uid) => [
    `profilePics/${uid}/`,
    `reels/${uid}/`,
    `stories/${uid}/`,
];
// ─── Shared helpers ─────────────────────────────────────────────────────────
async function collectDocKeyed(uid) {
    const out = {};
    for (const col of DOC_KEYED_COLLECTIONS) {
        try {
            const snap = await db.collection(col).doc(uid).get();
            if (snap.exists)
                out[col] = snap.data();
        }
        catch (err) {
            console.error(`exportMyData: failed reading ${col}/${uid}`, err);
        }
    }
    return out;
}
async function collectFieldKeyed(uid) {
    const out = {};
    for (const { collection, field } of FIELD_KEYED_COLLECTIONS) {
        try {
            const snap = await db.collection(collection).where(field, "==", uid).get();
            if (!snap.empty)
                out[collection] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        catch (err) {
            console.error(`exportMyData: failed querying ${collection} where ${field}==${uid}`, err);
        }
    }
    return out;
}
async function deleteDocKeyed(uid) {
    for (const col of DOC_KEYED_COLLECTIONS) {
        try {
            await db.recursiveDelete(db.collection(col).doc(uid));
        }
        catch (err) {
            console.error(`eraseMyAccount: failed deleting ${col}/${uid}`, err);
        }
    }
}
async function deleteFieldKeyed(uid) {
    for (const { collection, field } of FIELD_KEYED_COLLECTIONS) {
        try {
            const snap = await db.collection(collection).where(field, "==", uid).get();
            for (const doc of snap.docs) {
                await db.recursiveDelete(doc.ref);
            }
        }
        catch (err) {
            console.error(`eraseMyAccount: failed deleting from ${collection} where ${field}==${uid}`, err);
        }
    }
}
async function deleteAdAnalyticsEvents(uid) {
    try {
        const snap = await db
            .collectionGroup("events")
            .where("userId", "==", uid)
            .get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (!snap.empty)
            await batch.commit();
    }
    catch (err) {
        console.error("eraseMyAccount: failed deleting adAnalytics events", err);
    }
}
async function scrubRetainedRecords(uid) {
    for (const col of SCRUB_ONLY_COLLECTIONS) {
        try {
            const ref = db.collection(col).doc(uid);
            const snap = await ref.get();
            if (!snap.exists)
                continue;
            const data = snap.data() ?? {};
            const scrubbed = {};
            for (const field of ["name", "email", "phone", "contactEmail", "contactPhone"]) {
                if (field in data)
                    scrubbed[field] = admin.firestore.FieldValue.delete();
            }
            if (Object.keys(scrubbed).length) {
                await ref.update({ ...scrubbed, dataSubjectErased: true });
            }
        }
        catch (err) {
            console.error(`eraseMyAccount: failed scrubbing ${col}/${uid}`, err);
        }
    }
}
async function deleteStorageFiles(uid) {
    const bucket = admin.storage().bucket();
    for (const prefix of STORAGE_PREFIXES(uid)) {
        try {
            await bucket.deleteFiles({ prefix });
        }
        catch (err) {
            console.error(`eraseMyAccount: failed deleting storage prefix ${prefix}`, err);
        }
    }
}
// ─── exportMyData ───────────────────────────────────────────────────────────
exports.exportMyData = functionsV1
    .runWith({ timeoutSeconds: 60, memory: "256MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const logRef = db.collection("dataRightsLog").doc();
    await logRef.set({
        uid,
        type: "export",
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "processing",
    });
    try {
        const [profile, activity] = await Promise.all([
            collectDocKeyed(uid),
            collectFieldKeyed(uid),
        ]);
        await logRef.update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            exportedBy: uid,
            generatedAt: new Date().toISOString(),
            profile,
            activity,
        };
    }
    catch (err) {
        await logRef.update({
            status: "failed",
            error: String(err?.message ?? err),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });
        throw new functionsV1.https.HttpsError("internal", "Failed to export your data. Please try again.");
    }
});
// ─── adminEraseStudent ──────────────────────────────────────────────────────
// Same cascading delete as eraseMyAccount, but admin-triggered against an
// arbitrary uid instead of the caller's own — this is what powers the
// "delete student data" action on admin's Students page. Deliberately
// separate from eraseMyAccount (rather than parameterizing it) so the
// self-service DPDP erasure path's auth story (context.auth.uid only)
// never has to reason about an admin-supplied uid.
exports.adminEraseStudent = functionsV1
    .runWith({ timeoutSeconds: 120, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admins only.");
    }
    const uid = data?.uid;
    if (!uid) {
        throw new functionsV1.https.HttpsError("invalid-argument", "uid is required.");
    }
    const logRef = db.collection("dataRightsLog").doc();
    await logRef.set({
        uid,
        type: "admin_erase",
        requestedBy: context.auth.uid,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "processing",
    });
    try {
        await deleteDocKeyed(uid);
        await deleteFieldKeyed(uid);
        await deleteAdAnalyticsEvents(uid);
        await scrubRetainedRecords(uid);
        await deleteStorageFiles(uid);
        // Unlike eraseMyAccount, a missing/already-gone Auth user must not
        // block the rest of the cleanup — an admin may be deleting a record
        // for a student whose Auth account never existed or was removed
        // separately, and the Firestore/Storage data should still go.
        try {
            await admin.auth().deleteUser(uid);
        }
        catch (err) {
            console.error(`adminEraseStudent: failed deleting auth user ${uid}`, err);
        }
        await logRef.update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    }
    catch (err) {
        await logRef.update({
            status: "failed",
            error: String(err?.message ?? err),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });
        throw new functionsV1.https.HttpsError("internal", "Failed to delete student data. Please try again.");
    }
});
// ─── eraseMyAccount ─────────────────────────────────────────────────────────
exports.eraseMyAccount = functionsV1
    .runWith({ timeoutSeconds: 120, memory: "256MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const logRef = db.collection("dataRightsLog").doc();
    await logRef.set({
        uid,
        type: "erase",
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "processing",
    });
    try {
        await deleteDocKeyed(uid);
        await deleteFieldKeyed(uid);
        await deleteAdAnalyticsEvents(uid);
        await scrubRetainedRecords(uid);
        await deleteStorageFiles(uid);
        // Auth user deleted last — if anything above throws, the account (and
        // its rules-based access control) survives instead of leaving orphaned
        // data with no owner.
        await admin.auth().deleteUser(uid);
        await logRef.update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    }
    catch (err) {
        await logRef.update({
            status: "failed",
            error: String(err?.message ?? err),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });
        throw new functionsV1.https.HttpsError("internal", "Failed to delete your account. Please contact support@gloows365.in.");
    }
});
//# sourceMappingURL=dataRights.js.map