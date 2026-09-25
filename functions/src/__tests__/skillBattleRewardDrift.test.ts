// PATH: functions/src/__tests__/skillBattleRewardDrift.test.ts
//
// Regression sentinel for SB-P0-05 (SkillBattle trust-boundary
// remediation): apps/mobile/utils/formatVCoins.ts's VCOIN_DIST_PCT display
// table had silently drifted from this file's own functions/src/vcoins.ts
// copy — every single rank differed, so students were shown one reward
// percentage and credited a different one by claimSkillBattleReward.
//
// The two files live in separate packages (Expo/RN app vs. Cloud
// Functions, different package.json/build target) so there's no single
// importable module both can share without a larger workspace-package
// change — out of scope for this fix (see the SkillBattle audit, §24).
// Until that exists, this test is the guard: it reads both source files as
// text and asserts their VCOIN_DIST_PCT array literals are identical,
// failing loudly the moment anyone edits one without the other.

import * as fs from "fs";
import * as path from "path";

function extractDistPctArray(fileContents: string, label: string): number[] {
  const match = fileContents.match(/VCOIN_DIST_PCT\s*=\s*\[([^\]]+)\]/);
  if (!match) {
    throw new Error(`Could not find a VCOIN_DIST_PCT array literal in ${label}`);
  }
  return match[1]
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map(Number);
}

test("SkillBattle reward table: server (functions/src/vcoins.ts) and client display (apps/mobile/utils/formatVCoins.ts) copies of VCOIN_DIST_PCT must be identical", () => {
  const serverPath = path.resolve(__dirname, "../vcoins.ts");
  const clientPath = path.resolve(__dirname, "../../../apps/mobile/utils/formatVCoins.ts");

  const serverSrc = fs.readFileSync(serverPath, "utf8");
  const clientSrc = fs.readFileSync(clientPath, "utf8");

  const serverTable = extractDistPctArray(serverSrc, "functions/src/vcoins.ts");
  const clientTable = extractDistPctArray(clientSrc, "apps/mobile/utils/formatVCoins.ts");

  expect(clientTable).toEqual(serverTable);
  // Sanity check on the table itself, independent of the comparison above —
  // catches a future edit that breaks both copies identically.
  expect(serverTable).toHaveLength(10);
  serverTable.forEach((pct) => expect(pct).toBeGreaterThan(0));
});
