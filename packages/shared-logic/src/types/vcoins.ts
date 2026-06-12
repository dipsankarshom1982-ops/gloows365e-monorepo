// packages/shared-logic/src/types/vcoins.ts

export type VCoinTxType = "CREDIT" | "DEBIT";
export type VCoinTxStatus = "SUCCESS" | "PENDING" | "FAILED";

export interface VCoinTransaction {
  id: string;
  type: VCoinTxType;
  amount: number;
  reason: string;
  status: VCoinTxStatus;
  createdAt: any; // Firestore Timestamp
  meta?: Record<string, any>;
}
