"use strict";
// PATH: functions/src/tutorAccounts.ts
// Gloows Tutor — Phase 1a account/profile/verification backend.
//
// Follows this codebase's dominant convention (30 onCall vs 2 legacy
// onRequest — see functions/src/submitVidyastarContestQuiz.ts,
// contestLesson.ts) rather than a REST API: v1 functionsV1.https.onCall,
// context.auth populated automatically, no manual bearer-token parsing.
//
// Plain profile field reads/writes (qualification, subjects, etc.) are
// NOT callables here — same as student profiles, they're direct Firestore
// reads/writes from the client, gated by firestore.rules'
// owner-reads/writes-own-doc rule for tutors/{uid}. Callables in this file
// are reserved for the operations that need real server-side authority:
// granting a role claim, and the verification review workflow.
//
// Role/admin authorization follows functions/src/adminManagement.ts's
// createAdmin pattern exactly: Firebase custom claims
// (auth.setCustomUserClaims), never a Firestore field — a Firestore
// users/{uid}.role field exists elsewhere in this codebase but is only
// ever used for a quota bypass (usageCheck.ts), never for authorization,
// and that distinction matters: don't copy that field for anything
// privilege-gated.
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewTutorVerification = exports.submitTutorVerification = exports.registerTutorAccount = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const db = admin.firestore();
const TUTOR_ROLES = ["TUTOR", "TEACHER", "COACHING_CENTER"];
// ─── registerTutorAccount ──────────────────────────────────────────────────
// Called right after the client creates the Firebase Auth user itself
// (createUserWithEmailAndPassword / Google sign-in — same split
// responsibility as apps/web's signup.tsx). This callable provisions the
// Firestore side (users/{uid} + tutors/{uid}) and grants the role claim.
//
// Both the Firestore writes (merge:true) and setCustomUserClaims are
// idempotent, so unlike signup.tsx's create-then-rollback-on-failure
// pattern (which owns the Auth user's whole lifecycle), a client that
// retries this callable after a partial failure just re-applies the same
// state rather than needing to delete anything.
exports.registerTutorAccount = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email ?? "";
    const { tutorRole, name, phone } = data ?? {};
    if (!tutorRole || !TUTOR_ROLES.includes(tutorRole)) {
        throw new functionsV1.https.HttpsError("invalid-argument", `tutorRole must be one of: ${TUTOR_ROLES.join(", ")}`);
    }
    if (!name || !name.trim()) {
        throw new functionsV1.https.HttpsError("invalid-argument", "name is required");
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(db.doc(`users/${uid}`), {
        role: "tutor",
        email,
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    batch.set(db.doc(`tutors/${uid}`), {
        uid,
        name: name.trim(),
        email,
        phone: phone ?? "",
        tutorRole,
        verified: false,
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    await batch.commit();
    await admin.auth().setCustomUserClaims(uid, { role: tutorRole });
    console.log(`✅ Tutor account registered: uid=${uid} role=${tutorRole}`);
    // Custom claims only take effect on the client's NEXT ID token —
    // caller must force a refresh (getIdToken(true)) after this resolves,
    // same requirement setCustomUserClaims always carries.
    return { uid, tutorRole };
});
// ─── submitTutorVerification ───────────────────────────────────────────────
// Documents are uploaded to Storage (tutorDocuments/{uid}/{fileName},
// private — see storage.rules) directly from the client BEFORE calling
// this; this callable only records the resulting refs and flips the
// review-workflow status. Validates each storagePath is actually under
// this caller's own tutorDocuments/{uid}/ prefix — storage.rules
// separately stops a tutor from ever writing outside that prefix, but
// this stops a tutor from getting an arbitrary path metadata-referenced
// into their own verification doc for admin to open.
exports.submitTutorVerification = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const documents = Array.isArray(data?.documents) ? data.documents : null;
    if (!documents || documents.length === 0) {
        throw new functionsV1.https.HttpsError("invalid-argument", "At least one document is required");
    }
    const expectedPrefix = `tutorDocuments/${uid}/`;
    for (const doc of documents) {
        if (!doc?.name || !doc?.storagePath) {
            throw new functionsV1.https.HttpsError("invalid-argument", "Each document needs a name and storagePath");
        }
        if (!doc.storagePath.startsWith(expectedPrefix)) {
            throw new functionsV1.https.HttpsError("invalid-argument", "storagePath must be under this account's own tutorDocuments folder");
        }
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.doc(`tutorVerifications/${uid}`).set({
        uid,
        status: "Submitted",
        documents,
        submittedAt: now,
        updatedAt: now,
    }, { merge: true });
    console.log(`✅ Tutor verification submitted: uid=${uid} (${documents.length} document(s))`);
    return { status: "Submitted" };
});
// ─── reviewTutorVerification ───────────────────────────────────────────────
// Admin-only (apps/admin's Tutor Verifications review queue). Deliberately
// its own callable rather than reusing adminManagement.ts's generic
// approveContent — approval here also has to flip tutors/{uid}.verified
// (the marketplace-visibility eligibility flag), which approveContent's
// generic "flip one status field" shape doesn't cover.
exports.reviewTutorVerification = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const { uid, action, reason } = data ?? {};
    if (!uid || !["approve", "reject"].includes(action)) {
        throw new functionsV1.https.HttpsError("invalid-argument", "uid and action (approve|reject) are required");
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    if (action === "approve") {
        batch.set(db.doc(`tutorVerifications/${uid}`), {
            status: "Verified",
            reviewedBy: context.auth.uid,
            reviewedAt: now,
            updatedAt: now,
        }, { merge: true });
        batch.set(db.doc(`tutors/${uid}`), { verified: true, updatedAt: now }, { merge: true });
    }
    else {
        batch.set(db.doc(`tutorVerifications/${uid}`), {
            status: "Rejected",
            rejectionReason: reason ?? "",
            reviewedBy: context.auth.uid,
            reviewedAt: now,
            updatedAt: now,
        }, { merge: true });
        batch.set(db.doc(`tutors/${uid}`), { verified: false, updatedAt: now }, { merge: true });
    }
    await batch.commit();
    console.log(`✅ Tutor verification ${action}d: uid=${uid} by ${context.auth.uid}`);
    return { status: action === "approve" ? "Verified" : "Rejected" };
});
//# sourceMappingURL=tutorAccounts.js.map