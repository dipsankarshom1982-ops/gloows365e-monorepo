// packages/shared-logic/src/lib/vcoinsRank.ts
// Single source of truth for the V-Coins yearly ranking definition, shared by
// the student drawer and wallet leaderboard on web + mobile. Pure functions,
// no Firebase/React imports.
//
// RULE — competition ranking on users/{uid}.vCoinsYear_{IST year}, DESC:
//   rank = 1 + (number of users with a strictly higher score)
//   e.g. 201, 201, 200 → #1, #1, #3.
// Users with a score of 0 / no field are unranked.
//
// The drawer and the wallet's "my rank" get that rank from a Firestore
// aggregate count query (count(where(field > score)) + 1); leaderboard lists
// (rows already sorted DESC) use withCompetitionRanks() below, which yields
// the identical numbers.

// IST (UTC+5:30) calendar year — must match currentYearIST() in
// functions/src/vcoins.ts, which decides which vCoinsYear_* field gets
// written. Do NOT use the device's local year: around New Year a device
// outside India would read/rank the wrong year's field.
export function currentYearIST(now: Date = new Date()): number {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getUTCFullYear();
}

export function vCoinsYearField(year: number = currentYearIST()): string {
  return `vCoinsYear_${year}`;
}

// Rows sorted by yearCoins DESC → competition ranks (equal scores share a rank).
export function withCompetitionRanks<T extends { yearCoins: number; rank: number }>(entries: T[]): T[] {
  const out: T[] = [];
  entries.forEach((e, i) => {
    const tied = i > 0 && e.yearCoins === entries[i - 1].yearCoins;
    out.push({ ...e, rank: tied ? out[i - 1].rank : i + 1 });
  });
  return out;
}
