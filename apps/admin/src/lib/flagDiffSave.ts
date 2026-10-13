// PATH: apps/admin/src/lib/flagDiffSave.ts
//
// Field-level saves for the featureFlags/* documents (homeSection, aiGuru,
// drawerItems) so an Admin page that loaded them earlier can never write back
// a stale copy of a flag it didn't change.
//
// Why: FeatureControl used to setDoc() the WHOLE document from the state it
// read once at mount. Any flag another Admin flipped since (App Structure,
// another FeatureControl tab) was silently reverted on Save. Adding
// merge:true alone doesn't help — the stale values would still be written.
// Here only the keys whose value actually differs from what this page loaded
// are written, each as a single-field merge.

import { doc, setDoc, type Firestore } from "firebase/firestore";

export type FlagMap = Record<string, boolean>;
export type FlagDocName = "homeSection" | "aiGuru" | "drawerItems";

/** Keys in `current` whose value differs from `baseline` (what the page loaded / last saved). */
export function diffFlags(baseline: FlagMap, current: FlagMap): FlagMap {
  const changed: FlagMap = {};
  for (const key of Object.keys(current)) {
    if (current[key] !== baseline[key]) changed[key] = current[key];
  }
  return changed;
}

export interface FlagSaveResult {
  name: FlagDocName;
  /** The fields this save wrote (empty when there was nothing to write). */
  written: FlagMap;
  /** Set when the write for this document failed. */
  error?: unknown;
}

/**
 * Merge-write only the changed fields of each document. Documents are written
 * independently: one failing doesn't stop the others, and the result tells the
 * caller exactly which ones persisted so it never treats a failed write as saved.
 */
export async function saveFlagDiffs(
  db: Firestore,
  diffs: Record<FlagDocName, FlagMap>
): Promise<FlagSaveResult[]> {
  const names = Object.keys(diffs) as FlagDocName[];
  return Promise.all(
    names.map(async (name): Promise<FlagSaveResult> => {
      const written = diffs[name];
      if (Object.keys(written).length === 0) return { name, written };
      try {
        await setDoc(doc(db, "featureFlags", name), written, { merge: true });
        return { name, written };
      } catch (error) {
        return { name, written: {}, error };
      }
    })
  );
}
