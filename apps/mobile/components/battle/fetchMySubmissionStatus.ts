// PATH: components/battle/fetchMySubmissionStatus.ts
// Phase 2D-3 — shared by Discovery and Battle Details (extracted so
// there's exactly one implementation, not two independently-maintained
// copies). A single, cheap, bounded read per battle — never a rank/score
// Cloud Function call (see resolveBattleExperience.ts's header for why
// Discovery specifically avoids that N-calls pattern).

import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { classifyBattleEngine, type RawBattle } from "./resolveBattleExperience";

export type MySubmissionStatus = "NONE" | "PENDING_MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export async function fetchMySubmissionStatus(battle: RawBattle, uid: string): Promise<MySubmissionStatus> {
  const engine = classifyBattleEngine(battle);
  try {
    if (engine === "canonical") {
      const snap = await getDoc(doc(db, "submissions", `${battle.id}_${uid}`));
      if (!snap.exists()) return "NONE";
      const status = snap.data()?.status;
      if (status === "APPROVED") return "APPROVED";
      if (status === "REJECTED") return "REJECTED";
      if (status === "WITHDRAWN") return "WITHDRAWN";
      return "PENDING_MODERATION";
    }
    const snap = await getDocs(query(
      collection(db, "posts"),
      where("battleId", "==", battle.id),
      where("userId", "==", uid),
      where("isSkillBattle", "==", true),
      limit(5) // small, bounded — not a scan; a student has at most ~4 submissions per legacy battle
    ));
    if (snap.empty) return "NONE";
    const statuses = snap.docs.map((d) => d.data().status as string);
    if (statuses.includes("approved")) return "APPROVED";
    if (statuses.includes("pending") || statuses.includes("in_review")) return "PENDING_MODERATION";
    return "REJECTED";
  } catch {
    return "NONE";
  }
}
