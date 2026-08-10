// PATH: services/studentIdService.ts
//
// Typed binding for the ensureStudentId callable (functions/src/studentId.ts).
// Same httpsCallable(functions, ...) pattern as services/dataRightsService.ts.
// Idempotent — safe to call any number of times; returns the existing
// studentId once one has been assigned instead of generating a new one.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

const ensureStudentIdCF = httpsCallable<Record<string, never>, { studentId: string }>(
  functions,
  "ensureStudentId"
);

export async function ensureStudentId(): Promise<string> {
  const res = await ensureStudentIdCF({});
  return res.data.studentId;
}
