// PATH: functions/src/moderation/moderationQueue.ts
//
// Phase B §2 — the admin moderation queue's backing callable. Reads
// across BOTH engines (legacy `posts`, canonical `submissions`) and
// normalizes them into one shape the admin UI renders identically,
// since a moderator shouldn't need to know or care which engine a given
// battle uses.
//
// Query strategy — same documented V1 pragmatism as refundSearch.ts/
// invoiceSearch.ts: fetch a bounded, ordered window per collection, then
// filter/sort in-memory rather than building a combinatorial set of
// composite indexes for every filter × sort pairing. Fine at this app's
// admin-tool scale; if that changes, the fix is real composite indexes,
// not a shape change here.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

export type QueueFilter =
  | "pending" | "high_risk" | "copyright_flagged" | "duplicate_suspected"
  | "reported" | "winner_review" | "recent"
  // Phase C §12 additions:
  | "provider_failed" | "processing" | "manual_review_required";
export type QueueSort = "priority" | "oldest" | "newest" | "risk" | "reports";

interface ModerationQueueItem {
  engine: "legacy" | "canonical";
  contentId: string;
  battleId: string;
  studentUid: string;
  studentName: string;
  title: string;
  mediaUrl: string;
  createdAt: string | null;
  status: string;
  moderationStatus: string | null;
  copyrightStatus: string | null;
  similarityStatus: string | null;
  riskLevel: string | null;
  moderationReasons: string[];
  reportCount: number;
  // Phase C §12 — provider/processing visibility. Deliberately just the
  // provider NAME and status/job-id, never credentials or raw provider
  // payloads (brief §12: "Do not expose provider API credentials or
  // internal security information").
  safetyProvider: string | null;
  safetyStatus: string | null;
  copyrightProvider: string | null;
  similarityProvider: string | null;
  matchedSubmissionId: string | null;
  moderationProcessingVersion: number;
}

function toIso(v: unknown): string | null {
  if (v && typeof (v as FirebaseFirestore.Timestamp).toDate === "function") {
    return (v as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  return null;
}

const RISK_RANK: Record<string, number> = { HIGH_RISK: 2, MEDIUM_RISK: 1, LOW_RISK: 0 };

function fromPost(doc: FirebaseFirestore.QueryDocumentSnapshot): ModerationQueueItem {
  const d = doc.data();
  return {
    engine: "legacy",
    contentId: doc.id,
    battleId: d.battleId ?? "",
    studentUid: d.userId ?? "",
    studentName: d.name ?? "",
    title: d.caption ?? "",
    mediaUrl: d.mediaUrl ?? "",
    createdAt: toIso(d.createdAt),
    status: d.status ?? "pending",
    moderationStatus: d.moderationStatus ?? null,
    copyrightStatus: d.copyrightStatus ?? null,
    similarityStatus: d.similarityStatus ?? null,
    riskLevel: d.moderationRiskLevel ?? null,
    moderationReasons: Array.isArray(d.moderationReasons) ? d.moderationReasons : [],
    reportCount: Number(d.reportCount) || 0,
    safetyProvider: d.safetyModeration?.provider ?? null,
    safetyStatus: d.safetyModeration?.status ?? null,
    copyrightProvider: d.copyrightCheck?.provider ?? null,
    similarityProvider: d.similarityCheck?.provider ?? null,
    matchedSubmissionId: d.similarityCheck?.matchedSubmissionId ?? null,
    moderationProcessingVersion: Number(d.moderationProcessingVersion) || 0,
  };
}

function fromSubmission(doc: FirebaseFirestore.QueryDocumentSnapshot): ModerationQueueItem {
  const d = doc.data();
  return {
    engine: "canonical",
    contentId: doc.id,
    battleId: d.battleId ?? "",
    studentUid: d.studentId ?? "",
    studentName: d.studentName ?? "",
    title: d.title ?? d.description ?? "",
    mediaUrl: d.mediaRef ?? "",
    createdAt: toIso(d.createdAt),
    status: d.status ?? "PENDING_MODERATION",
    moderationStatus: d.moderationStatus ?? null,
    copyrightStatus: d.copyrightStatus ?? null,
    similarityStatus: d.similarityStatus ?? null,
    riskLevel: d.moderationRiskLevel ?? null,
    moderationReasons: Array.isArray(d.moderationReasons) ? d.moderationReasons : [],
    reportCount: Number(d.reportCount) || 0,
    safetyProvider: d.safetyModeration?.provider ?? null,
    safetyStatus: d.safetyModeration?.status ?? null,
    copyrightProvider: d.copyrightCheck?.provider ?? null,
    similarityProvider: d.similarityCheck?.provider ?? null,
    matchedSubmissionId: d.similarityCheck?.matchedSubmissionId ?? null,
    moderationProcessingVersion: Number(d.moderationProcessingVersion) || 0,
  };
}

interface GetModerationQueueInput {
  filter?: QueueFilter;
  sortBy?: QueueSort;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_WINDOW = 200; // per-collection fetch window before in-memory filter/sort

export const getModerationQueue = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: GetModerationQueueInput, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    if (context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const filter = data?.filter ?? "pending";
    const sortBy = data?.sortBy ?? "oldest";
    const pageSize = Math.min(Math.max(data?.pageSize ?? DEFAULT_PAGE_SIZE, 1), 200);

    const [postsSnap, submissionsSnap] = await Promise.all([
      db.collection("posts").where("isSkillBattle", "==", true).orderBy("createdAt", "desc").limit(MAX_WINDOW).get(),
      db.collection("submissions").orderBy("createdAt", "desc").limit(MAX_WINDOW).get(),
    ]);

    let items: ModerationQueueItem[] = [
      ...postsSnap.docs.map(fromPost),
      ...submissionsSnap.docs.map(fromSubmission),
    ];

    switch (filter) {
      case "pending":
        items = items.filter((i) => i.moderationStatus === "PENDING_HUMAN_REVIEW" || i.moderationStatus === "PENDING_MODERATION");
        break;
      case "high_risk":
        items = items.filter((i) => i.riskLevel === "HIGH_RISK");
        break;
      case "copyright_flagged":
        items = items.filter((i) => i.copyrightStatus === "POSSIBLE_MATCH" || i.copyrightStatus === "CONFIRMED_MATCH" || i.copyrightStatus === "LICENSE_INFORMATION_REQUIRED");
        break;
      case "duplicate_suspected":
        items = items.filter((i) => i.similarityStatus === "HIGH_SIMILARITY");
        break;
      case "reported":
        items = items.filter((i) => i.reportCount > 0);
        break;
      case "provider_failed":
        // Any of the three checks came back an explicit failure/error —
        // distinct from "not yet checked" (PROCESSING/NOT_CONFIGURED),
        // which belongs in "processing"/"pending" instead.
        items = items.filter((i) =>
          i.safetyStatus === "FAILED" || i.similarityStatus === "ERROR"
        );
        break;
      case "processing":
        // A job is genuinely in flight (visual safety kicked off,
        // awaiting Sightengine's callback) — distinct from "pending"
        // (nothing has been attempted / no automated provider running).
        items = items.filter((i) => i.safetyStatus === "PROCESSING");
        break;
      case "manual_review_required":
        // Everything that unambiguously needs a human decision right
        // now: high risk, any flag, or any report — a convenience union
        // of the more specific filters above for a moderator who just
        // wants "show me everything that needs me".
        items = items.filter((i) =>
          i.riskLevel === "HIGH_RISK" || i.riskLevel === "MEDIUM_RISK" || i.reportCount > 0
        );
        break;
      case "winner_review":
        // Winner-review items live in winnerVerifications, not
        // posts/submissions directly — surfaced via a separate query so
        // this branch doesn't silently return an empty/wrong list.
        items = [];
        break;
      case "recent":
        // No extra filter — createdAt desc ordering already applied.
        break;
    }

    if (filter === "winner_review") {
      const pendingSnap = await db.collection("winnerVerifications")
        .where("winnerStatus", "==", "WINNER_PENDING_REVIEW")
        .orderBy("createdAt", "desc")
        .limit(pageSize)
        .get();
      return {
        items: pendingSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
        filter, sortBy,
      };
    }

    switch (sortBy) {
      case "oldest":
        items.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
        break;
      case "newest":
        items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        break;
      case "risk":
        items.sort((a, b) => (RISK_RANK[b.riskLevel ?? ""] ?? -1) - (RISK_RANK[a.riskLevel ?? ""] ?? -1));
        break;
      case "reports":
        items.sort((a, b) => b.reportCount - a.reportCount);
        break;
      case "priority":
        // High risk + reported first, then oldest — a simple, explainable
        // composite rather than an opaque scoring formula.
        items.sort((a, b) => {
          const scoreOf = (i: ModerationQueueItem) => (RISK_RANK[i.riskLevel ?? ""] ?? -1) * 10 + Math.min(i.reportCount, 9);
          return scoreOf(b) - scoreOf(a) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
        });
        break;
    }

    return { items: items.slice(0, pageSize), filter, sortBy };
  });
