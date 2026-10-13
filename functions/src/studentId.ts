// PATH: functions/src/studentId.ts
//
// Auto-assigned, human-readable Student ID — e.g. "GLS000123". Distinct
// from the Firebase Auth uid (long, opaque, not something a student or
// support agent can read over the phone). Assigned once per student,
// stable for the lifetime of the account, and used by:
//   - the mobile drawer profile section (display + copy)
//   - admin's Students page (search students by this ID)
//
// ensureStudentId is idempotent and self-healing: called once at the end
// of registration (see app/(auth)/register.tsx), and again lazily by the
// drawer for any already-registered account that predates this feature
// and doesn't have one yet — in both cases, if students/{uid}.studentId
// already exists, it's returned as-is with no counter increment.
//
// The sequence itself lives server-side (counters/students.seq) and is
// only ever touched inside this transaction, so two students registering
// at the same instant can never be handed the same ID — Firestore retries
// the transaction on write contention until it commits cleanly.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

const ID_PREFIX = "GLS";
const ID_DIGITS = 6;

function formatStudentId(seq: number): string {
  return `${ID_PREFIX}${String(seq).padStart(ID_DIGITS, "0")}`;
}

export const ensureStudentId = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .https.onCall(async (_data: unknown, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const studentRef = db.collection("students").doc(uid);
    const counterRef = db.collection("counters").doc("students");

    try {
      const studentId = await db.runTransaction(async (tx) => {
        const studentSnap = await tx.get(studentRef);
        const existing = studentSnap.exists ? (studentSnap.data()?.studentId as string | undefined) : undefined;
        if (existing) return existing;

        const counterSnap = await tx.get(counterRef);
        const nextSeq = ((counterSnap.exists ? counterSnap.data()?.seq : 0) ?? 0) + 1;
        const newId = formatStudentId(nextSeq);

        tx.set(counterRef, { seq: nextSeq, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        tx.set(studentRef, { studentId: newId }, { merge: true });

        return newId;
      });

      return { studentId };
    } catch (err: any) {
      console.error("ensureStudentId failed:", err?.message ?? err);
      throw new functionsV1.https.HttpsError("internal", "Failed to assign student ID. Please try again.");
    }
  });
