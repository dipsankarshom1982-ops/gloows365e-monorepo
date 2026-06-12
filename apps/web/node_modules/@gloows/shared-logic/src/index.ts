// packages/shared-logic/src/index.ts
// Central export point for all shared logic
// Used by: apps/mobile, apps/web, apps/admin
//
// RULE: Only export files that physically exist in packages/shared-logic/src/

// ── Firebase config (platform-agnostic) ──────────────────────────────────
export * from "./lib/firebaseConfig";

// ── Types ─────────────────────────────────────────────────────────────────
export * from "./types/student";
export * from "./types/vcoins";
export * from "./types/aiGuru";
export * from "./types/skillBattle";
export * from "./types/referral";

// ── Services ──────────────────────────────────────────────────────────────
export * from "./services/aiGuruApi";

// ── Hooks ─────────────────────────────────────────────────────────────────
export * from "./hooks/useVCoins";
export * from "./hooks/useHomeFlags";
export * from "./hooks/useStories";
export * from "./hooks/useHomeReels";
export * from "./hooks/useHomeFeed";
export * from "./hooks/useContests";
export * from "./hooks/useReferralConfig";

// ── Context ───────────────────────────────────────────────────────────────
export * from "./context/StudentProfileContext";
export * from "./context/FeatureFlagsContext";