// packages/shared-logic/src/types/referral.ts

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalVCoinsEarned: number;
  milestoneReached: number;
}

export interface ReferralEntry {
  id: string;
  referrerId: string;
  referredId: string;
  status: "pending" | "success" | "failed";
  createdAt: any;
  vCoinsAwarded?: number;
}
