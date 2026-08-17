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
import * as admin from "firebase-admin";
import {
  Change,
  DocumentSnapshot,
  FirestoreEvent,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";

const SAFE_FIELDS = [
  "name", "bio", "subjects", "qualification",
  "teachingExperienceYears", "preferredLanguage", "profilePic", "tutorRole",
  // ShikshaHub Phase 1 — sessionFee (a price) and availability (a weekly
  // hour range) are both public-safe the same way the fields above are:
  // no phone/email, nothing PII. Mirrored so the booking panel can show a
  // fee and compute slot options without widening tutors/{uid}'s own
  // owner+admin-only read (see that collection's firestore.rules match).
  "sessionFee", "availability",
] as const;

export const syncTutorMarketplaceProfile = onDocumentWritten(
  { document: "tutors/{uid}" },
  async (
    event: FirestoreEvent<Change<DocumentSnapshot> | undefined>
  ): Promise<null> => {
    const change = event.data;
    if (!change) return null;

    const { uid } = event.params as { uid: string };
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

      const mirror: Record<string, unknown> = {
        uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      for (const field of SAFE_FIELDS) {
        if (after[field] !== undefined) mirror[field] = after[field];
      }
      // Full overwrite, not merge — so a field removed from tutors/{uid}
      // (e.g. bio cleared) doesn't linger stale in the public mirror.
      await mirrorRef.set(mirror, { merge: false });
    } catch (e) {
      console.error(`syncTutorMarketplaceProfile(${uid}) error:`, e);
    }
    return null;
  }
);
