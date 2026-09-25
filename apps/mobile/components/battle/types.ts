// PATH: components/battle/types.ts
//
// Phase 2D-3 — presentation-layer types only. These are VIEW MODELS: they
// exist to give BattleCard/Battle Details ONE shape to render regardless
// of which engine (legacy posts-based, or the Phase 2C canonical engine)
// a given battle actually runs on. Nothing in this file calculates score,
// rank, reward, or eligibility — those values are always read from an
// authoritative backend call (functions/src/battle*.ts,
// functions/src/vcoins.ts's getMySkillBattleStanding/claimSkillBattleReward)
// and passed in already-resolved. See resolveBattleExperience.ts for the
// adapter that builds these from raw Firestore data.

export type BattleEngine = "legacy" | "canonical";

// Unifies legacy's date-derived status and canonical's real `state` field
// into one presentation-only status — the CTA state machine (below) is
// the thing that's actually authoritative-state-driven; this is just
// "what badge/label do we show."
export type BattlePresentationStatus =
  | "UPCOMING"
  | "LIVE"
  | "SUBMISSION_CLOSED"
  | "COMPLETED"
  | "CANCELLED";

export interface SkillViewModel {
  id: string;
  name: string;
  icon?: string;
  categoryId?: string;
  categoryName?: string;
}

export interface RewardViewModel {
  // Always a pre-formatted, ready-to-render label — "500 VCoins" — never
  // a raw number the component would have to interpret or compute a
  // percentage/estimate from. See §12/§22 of the Phase 2D-3 brief.
  label: string;
}

export interface ScopeViewModel {
  // Privacy-safe, pre-formatted — "Assam", "Kamrup District", "Class 8–10".
  // NEVER a pincode or exact address. See resolveBattleExperience.ts's
  // formatScopeLabel().
  label: string;
}

export interface BattleCardViewModel {
  id: string;
  engine: BattleEngine;
  title: string;
  skill?: SkillViewModel;
  status: BattlePresentationStatus;
  deadline: Date | null; // authoritative — never invented if absent
  reward?: RewardViewModel;
  participantCount?: number;
  scope?: ScopeViewModel;
  sponsor?: string;
}

// The CTA state machine (Phase 2D-3 brief §24) — driven entirely by
// authoritative battle state + the student's own authoritative submission
// status, never by a client-side timestamp guess when real state exists.
export type CTAState =
  | "NOT_ELIGIBLE"
  | "SUBMIT" // OPEN/LIVE, eligible, no submission yet
  | "PENDING_MODERATION" // submitted, awaiting review
  | "APPROVED_COMPETING" // approved — "Enter Competition" (Competition screen is Phase 2D-5; for now this state still shows, CTA just doesn't navigate anywhere new yet)
  | "REJECTED" // moderation rejected
  | "SUBMISSIONS_CLOSED" // window closed, no submission was made
  | "VIEW_RESULTS" // RESULT_LOCKED / COMPLETED
  | "CANCELLED"
  | "COMING_SOON" // UPCOMING battle, or a canonical battle whose submission
                   // entry point isn't built yet (Phase 2D-4) — see
                   // resolveBattleExperience.ts's header note on why a
                   // canonical battle's CTA doesn't route to the legacy
                   // submit screen.
  | "LOADING";

export interface BattleDetailsViewModel extends BattleCardViewModel {
  description?: string;
  eligibilityLabel: string; // e.g. "Class 8–10 · Assam"
  isEligible: boolean | null; // null = couldn't be determined (missing student profile data), never silently treated as true
  timeline: {
    opensAt: Date | null;
    submissionDeadline: Date | null;
    resultsAt: Date | null; // usually null — see §19, most battles don't have a promised results date
  };
  mySubmissionStatus: "NONE" | "PENDING_MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | null; // null = still loading
  rejectionReason?: string;
  cta: CTAState;
}
