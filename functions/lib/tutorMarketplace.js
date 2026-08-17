"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTutorMarketplaceProfile = void 0;
// PATH: functions/src/tutorMarketplace.ts
// ShikshaHub — mirrors safe fields from tutors/{uid} into
// tutorMarketplaceProfiles/{uid} whenever verified flips true, and deletes
// the mirror doc the moment it's no longer true (rejected/unverified/
// future-suspend). Keeps phone/email out of anything publicly readable —
// see firestore.rules' tutorMarketplaceProfiles block, and
// packages/shared-logic/src/types/tutor.ts's TutorMarketplaceProfile type,
// which this file's SAFE_FIELDS list must stay in sync with.
//
// Same firebase-functions v2 Firestore-trigger shape as vidyastarBoard.ts's
// onContestParticipantWrite — v2 for triggers, v1 (functionsV1.https.onCall)
// for callables like tutorAccounts.ts, both coexist in this codebase.
const admin = require("firebase-admin");
const firestore_1 = require("firebase-functions/v2/firestore");
const SAFE_FIELDS = [
    "name", "bio", "subjects", "qualification",
    "teachingExperienceYears", "preferredLanguage", "profilePic", "tutorRole",
];
exports.syncTutorMarketplaceProfile = (0, firestore_1.onDocumentWritten)({ document: "tutors/{uid}" }, async (event) => {
    const change = event.data;
    if (!change)
        return null;
    const { uid } = event.params;
    const db = admin.firestore();
    const after = change.after.exists ? change.after.data() : null;
    const mirrorRef = db.doc(`tutorMarketplaceProfiles/${uid}`);
    try {
        if (!after?.verified) {
            // .delete() on a non-existent doc is a no-op — no existence check
            // needed (covers both "never verified" and "verified -> false").
            await mirrorRef.delete();
            return null;
        }
        const mirror = {
            uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        for (const field of SAFE_FIELDS) {
            if (after[field] !== undefined)
                mirror[field] = after[field];
        }
        // Full overwrite, not merge — so a field removed from tutors/{uid}
        // (e.g. bio cleared) doesn't linger stale in the public mirror.
        await mirrorRef.set(mirror, { merge: false });
    }
    catch (e) {
        console.error(`syncTutorMarketplaceProfile(${uid}) error:`, e);
    }
    return null;
});
//# sourceMappingURL=tutorMarketplace.js.map