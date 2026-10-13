// packages/shared-logic/src/types/tutorBatch.ts
// A tutor's own batch (a named group of students taught together) —
// tutorBatches/{batchId}. Membership lives on the student side
// (TutorStudent.batchIds: string[], see types/tutorStudent.ts) rather
// than an array here or a subcollection — see the Phase 1c plan for why.

export type TutorBatchMode = "Online" | "Offline" | "Hybrid";

export type TutorBatch = {
  id?: string;
  tutorId?: string;
  name?: string;
  class?: string;
  subject?: string;   // singular — a batch teaches one subject
  board?: string;
  mode?: TutorBatchMode;
  fee?: number;
  startDate?: unknown; // Firestore Timestamp | null
  endDate?: unknown;   // Firestore Timestamp | null
  createdAt?: unknown;
  updatedAt?: unknown;
};
