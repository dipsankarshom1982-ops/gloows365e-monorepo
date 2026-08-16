// packages/shared-logic/src/types/tutorStudent.ts
// A tutor's own manually-maintained roster entry — tutorStudents/{studentId}.
// Distinct from StudentProfile (types/student.ts), which is a real
// Gloows365E student ACCOUNT. A roster entry has no relationship to a
// real account yet — Phase 1b is manual-entry only; account-linking
// ("Invite Student") is a later phase.

export type TutorStudent = {
  id?: string;             // Firestore doc ID (auto-generated, not a stored field)
  tutorId?: string;        // owner — the creating tutor's uid
  name?: string;
  class?: string;
  school?: string;
  board?: string;
  subjects?: string[];
  joiningDate?: unknown;   // Firestore Timestamp | null, tutor-supplied
  // Phase 1c — which tutorBatches this student has been assigned to. A
  // student can be in more than one batch (e.g. separate Math/Science
  // batches), so this lives here as an array rather than a single
  // batchId, and rather than an array-of-students on the batch doc — see
  // the Phase 1c plan for the reasoning.
  batchIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
};
