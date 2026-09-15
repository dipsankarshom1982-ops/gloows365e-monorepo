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
exports.reviewTutorVerification = exports.submitTutorOnboarding = exports.submitTutorVerification = exports.registerTutorAccount = void 0;
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
// ─── submitTutorOnboarding ──────────────────────────────────────────────────
// Final step (Step 5 "Submit Profile for Review") of the post-signup
// onboarding wizard (apps/tutor's /onboarding, apps/tutor-mobile's
// equivalent once built). Steps 2-4 write their fields directly to
// tutors/{uid} from the client as they go (plain setDoc/merge, gated by
// firestore.rules' allowlist — same trust level as Phase 1a's
// qualification/subjects/bio fields already have) so progress autosaves
// and survives a refresh/app-restart without needing a callable per step.
//
// This callable exists ONLY for the one thing a plain client write can't
// safely do: flip profileStatus/onboardingVerificationStatus into the
// review workflow. Those two fields are deliberately OFF
// firestore.rules' tutors/{uid} allowlist (same protection `verified`
// already has) so this is the only path that can ever set them — a
// tutor can't self-declare "submitted"/"under_review" any more than they
// could self-declare "verified" before this feature existed.
//
// Deliberately a SEPARATE status model from TutorVerification/
// TutorVerificationStatus above (Draft/Submitted/Under Review/Verified/
// Rejected/Suspended, already consumed by admin's Tutor Verifications
// review queue) rather than reusing it — this onboarding flow's
// profileStatus/onboardingVerificationStatus track the ONBOARDING
// wizard's own review workflow (spec'd with snake_case values), and
// wiring them into admin's existing queue is separate follow-up work,
// not done here.
//
// Re-validates every required field server-side (never trust that a
// tutor who reached Step 5 in the UI actually satisfied every earlier
// step's client-side checks) and is idempotent-safe against
// double-submission: once profileStatus is already submitted/
// under_review/verified, a second call is rejected outright rather than
// silently re-processing.
const TUTOR_TYPES = [
    "SCHOOL_TEACHER", "PRIVATE_TUTOR", "COLLEGE_FACULTY",
    "SUBJECT_EXPERT", "EXAM_PREP_TUTOR", "SKILL_INSTRUCTOR",
];
const STUDENT_LEVELS = [
    "PRIMARY", "MIDDLE", "SECONDARY", "HIGHER_SECONDARY",
    "COLLEGE", "COMPETITIVE_EXAMS", "PROFESSIONAL_SKILL",
];
const TEACHING_MODES = ["ONLINE", "OFFLINE", "BOTH"];
const EXPERIENCE_RANGES = [
    "FRESHER", "LESS_THAN_1", "ONE_TO_2", "THREE_TO_5", "FIVE_TO_10", "TEN_PLUS",
];
const HIGHEST_QUALIFICATIONS = [
    "HIGHER_SECONDARY", "DIPLOMA", "GRADUATE", "POSTGRADUATE",
    "B_ED", "M_ED", "PHD", "PROFESSIONAL_CERTIFICATION", "OTHER",
];
// "rejected" is deliberately NOT in this list — a rejected tutor must be
// able to fix their profile and resubmit.
const NON_RESUBMITTABLE_STATUSES = ["submitted", "under_review", "verified"];
exports.submitTutorOnboarding = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const tutorRef = db.doc(`tutors/${uid}`);
    const snap = await tutorRef.get();
    if (!snap.exists) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Complete the earlier onboarding steps before submitting.");
    }
    const t = snap.data();
    if (NON_RESUBMITTABLE_STATUSES.includes(t.profileStatus)) {
        throw new functionsV1.https.HttpsError("already-exists", "This profile has already been submitted for review.");
    }
    // ── Re-validate every required field (mirrors each step's client
    // checks) — a single collected list of human-readable problems, not
    // a throw-on-first-error, so the client can surface all of them at
    // once if it ever needs to.
    const problems = [];
    const name = typeof t.name === "string" ? t.name.trim() : "";
    if (name.length < 2 || name.length > 100)
        problems.push("Full name must be 2-100 characters");
    if (!t.phoneVerified)
        problems.push("Mobile number must be verified");
    // city/state deliberately NOT required — see Step2BasicInfo.tsx
    if (!TUTOR_TYPES.includes(t.tutorType))
        problems.push("Tutor type is required");
    if (!Array.isArray(t.subjects) || t.subjects.length === 0)
        problems.push("At least one subject is required");
    if (!Array.isArray(t.studentLevels) || t.studentLevels.length === 0 || !t.studentLevels.every((l) => STUDENT_LEVELS.includes(l))) {
        problems.push("At least one student level is required");
    }
    if (!TEACHING_MODES.includes(t.teachingMode))
        problems.push("Teaching mode is required");
    if (!EXPERIENCE_RANGES.includes(t.experience))
        problems.push("Teaching experience is required");
    if (!HIGHEST_QUALIFICATIONS.includes(t.highestQualification))
        problems.push("Highest qualification is required");
    if (!t.degreeName || typeof t.degreeName !== "string" || !t.degreeName.trim())
        problems.push("Degree / course name is required");
    if (!t.institutionName || typeof t.institutionName !== "string" || !t.institutionName.trim())
        problems.push("Institution name is required");
    if (typeof t.completionYear !== "number")
        problems.push("Year of completion is required");
    const bio = typeof t.bio === "string" ? t.bio.trim() : "";
    if (bio.length < 100 || bio.length > 500)
        problems.push("About section must be 100-500 characters");
    if (problems.length > 0) {
        throw new functionsV1.https.HttpsError("invalid-argument", problems.join("; "));
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    await tutorRef.set({
        profileStatus: "under_review",
        onboardingVerificationStatus: "pending",
        onboardingCompleted: true,
        onboardingStep: 5,
        submittedAt: now,
        updatedAt: now,
    }, { merge: true });
    console.log(`✅ Tutor onboarding submitted for review: uid=${uid}`);
    return { profileStatus: "under_review" };
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