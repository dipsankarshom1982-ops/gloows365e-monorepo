// packages/shared-logic/src/index.ts
// Central barrel export for @gloows/shared-logic — shared hooks, context
// providers, Firebase bootstrap, and types used across web365, mobile365,
// and admin365.
//
// RESTORED — this file was accidentally overwritten with the contents of
// the separate @gloows/shared-types package (pure TS interfaces, no
// runtime exports) while working on another app. Rebuilt from the actual
// source files still present under src/{context,hooks,lib,services,types},
// none of which were touched by that overwrite.

// ─── Context / Providers ────────────────────────────────────────────────
export * from "./context/StudentProfileContext";
export * from "./context/FeatureFlagsContext";
export * from "./context/TutorProfileContext";

// ─── Firebase bootstrap ──────────────────────────────────────────────────
export * from "./lib/firebaseConfig";

// ─── Hooks ───────────────────────────────────────────────────────────────
export * from "./hooks/useVCoins";
export * from "./hooks/useContests";
export * from "./hooks/useHomeFeed";
export * from "./hooks/useHomeFlags";
export * from "./hooks/useHomeReels";
export * from "./hooks/useReferralConfig";
export * from "./hooks/useStories";
export * from "./hooks/useBatchStudents";
export * from "./hooks/useTutorBatches";
export * from "./hooks/useStudentBookings";
export * from "./hooks/useTutorBookings";
export * from "./hooks/useTutorClasses";
export * from "./hooks/useTutorServices";
export * from "./hooks/useTutorStudents";

// ─── Services ────────────────────────────────────────────────────────────
export * from "./services/aiGuruApi";

// ─── Types ───────────────────────────────────────────────────────────────
export * from "./types/aiGuru";
export * from "./types/booking";
export * from "./types/referral";
export * from "./types/skillBattle";
export * from "./types/student";
export * from "./types/tutor";
export * from "./types/tutorBatch";
export * from "./types/tutorClass";
export * from "./types/tutorService";
export * from "./types/tutorStudent";
export * from "./types/vcoins";
