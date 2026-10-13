// packages/shared-logic/src/types/tutorClass.ts
// A tutor's scheduled class session — tutorClasses/{classId}. Belongs to
// exactly one tutorBatch (batchId, required). Deliberately no
// attendance/notes-upload/recording fields yet — those are later-phase
// spec items with no backing feature, same reasoning tutorStudent left
// Attendance/Test Score/Fee Status out of its own schema.

export type TutorClassMode = "Online" | "Offline"; // 2-way — "Hybrid" is a batch-level concept, not per-session
export type TutorClassStatus = "Scheduled" | "Completed" | "Cancelled";

export type TutorClass = {
  id?: string;
  tutorId?: string;
  batchId?: string;
  subject?: string;
  topic?: string;
  mode?: TutorClassMode;
  meetingLink?: string;
  startTime?: unknown; // Firestore Timestamp, required
  endTime?: unknown;   // Firestore Timestamp | null
  notes?: string;
  status?: TutorClassStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};
