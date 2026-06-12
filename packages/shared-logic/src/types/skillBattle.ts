// packages/shared-logic/src/types/skillBattle.ts

export interface SkillBattle {
  id: string;
  title: string;
  subject: string;
  startDate: any; // Firestore Timestamp
  endDate: any;   // Firestore Timestamp
  prizes: BattlePrize[];
  participants?: number;
  scope?: "local" | "national";
}

export interface BattlePrize {
  rank: number;
  vCoins?: number;
  physical?: string;
  description?: string;
}

export type BattleStatus = "live" | "upcoming" | "completed";

export function getBattleStatus(battle: SkillBattle): BattleStatus {
  const now = Date.now();
  const start = battle.startDate?.toMillis?.() ?? battle.startDate;
  const end   = battle.endDate?.toMillis?.()   ?? battle.endDate;
  if (now < start) return "upcoming";
  if (now > end)   return "completed";
  return "live";
}
