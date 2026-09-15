// PATH: apps/admin/src/pages/TutorVerifications.tsx
// Gloows Tutor — Phase 1a verification review queue, PLUS (added for the
// Tutor Profile Completion & Verification Dashboard) a second tab for the
// newer onboarding-wizard review workflow.
//
// Two entirely separate systems live on this one page, each its own tab,
// each its own callable — see functions/src/tutorAccounts.ts's header
// comments on why they're kept parallel rather than merged:
//   - "Legacy" tab: tutorVerifications/{uid} + reviewTutorVerification,
//     Phase 1a's original Draft/Submitted/Under Review/Verified/Rejected/
//     Suspended workflow (unchanged from before this feature).
//   - "Onboarding Profiles" tab (new): tutors/{uid}.profileStatus (set by
//     the 5-step onboarding wizard's submitTutorOnboarding) +
//     reviewTutorOnboarding — the ONLY thing that can move a submission
//     out of under_review, closing the loop the tutor-facing dashboard's
//     Verification Centre/Timeline depend on.
//
// Both tabs reuse the same ApprovalQueue/ApprovalItem component (same
// pattern as Stories.tsx's review queue).

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import ApprovalQueue, { ApprovalItem } from "../components/ApprovalQueue";

type Filter = "pending" | "approved" | "rejected" | "all";
type QueueTab = "legacy" | "onboarding";

type RawStatus = "Draft" | "Submitted" | "Under Review" | "Verified" | "Rejected" | "Suspended";

function toApprovalStatus(status: RawStatus): "pending" | "approved" | "rejected" | null {
  if (status === "Submitted" || status === "Under Review") return "pending";
  if (status === "Verified") return "approved";
  if (status === "Rejected") return "rejected";
  return null; // Draft (not submitted yet) / Suspended (not an approve/reject outcome) — excluded from this queue
}

type OnboardingStatus = "under_review" | "verified" | "rejected";
function toOnboardingApprovalStatus(status: OnboardingStatus): "pending" | "approved" | "rejected" {
  if (status === "verified") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

const reviewTutorVerificationFn = httpsCallable<
  { uid: string; action: "approve" | "reject"; reason?: string },
  { status: "Verified" | "Rejected" }
>(functions, "reviewTutorVerification");

const reviewTutorOnboardingFn = httpsCallable<
  { uid: string; action: "approve" | "reject"; reason?: string },
  { profileStatus: "verified" | "rejected" }
>(functions, "reviewTutorOnboarding");

export default function TutorVerifications() {
  const [tab, setTab]         = useState<QueueTab>("legacy");
  const [items, setItems]     = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("pending");
  const [actionError, setActionError] = useState<string | null>(null);

  const loadLegacyQueue = async () => {
    const snap = await getDocs(collection(db, "tutorVerifications"));

    const withStatus = snap.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .map(({ id, data }) => ({ id, data, approvalStatus: toApprovalStatus(data.status ?? "Draft") }))
      .filter((x): x is typeof x & { approvalStatus: NonNullable<typeof x.approvalStatus> } => x.approvalStatus !== null);

    return Promise.all(
      withStatus.map(async ({ id, data, approvalStatus }) => {
        const tutorSnap = await getDoc(doc(db, "tutors", id));
        const tutor = tutorSnap.exists() ? tutorSnap.data() : null;
        return {
          id,
          title: tutor?.name || "Unnamed tutor",
          uploaderName: tutor?.email || id,
          createdAt: data.submittedAt,
          approvalStatus,
          subtitle: [tutor?.tutorRole, `${(data.documents ?? []).length} document(s)`].filter(Boolean).join(" · "),
        } satisfies ApprovalItem;
      })
    );
  };

  // Onboarding-wizard submissions — read straight off tutors/{uid} (no
  // separate collection; see submitTutorOnboarding's header). "in" query
  // is fine at Phase 1 volume — same denormalization/scale note the
  // legacy queue above already carries.
  const loadOnboardingQueue = async () => {
    const q = query(collection(db, "tutors"), where("profileStatus", "in", ["under_review", "verified", "rejected"]));
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data();
      const docCount =
        (data.qualificationDocuments?.length ?? 0) +
        (data.experienceDocuments?.length ?? 0) +
        (data.additionalCertificates?.length ?? 0);
      return {
        id: d.id,
        title: data.name || "Unnamed tutor",
        uploaderName: data.email || d.id,
        createdAt: data.submittedAt,
        approvalStatus: toOnboardingApprovalStatus(data.profileStatus as OnboardingStatus),
        subtitle: [data.tutorType, data.highestQualification, `${docCount} document(s)`].filter(Boolean).join(" · "),
      } satisfies ApprovalItem;
    });
  };

  const loadQueue = async () => {
    setLoading(true);
    try {
      const all = tab === "legacy" ? await loadLegacyQueue() : await loadOnboardingQueue();
      const filtered = filter === "all" ? all : all.filter((i) => i.approvalStatus === filter);
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); }, [filter, tab]);

  const handleApprove = async (uid: string) => {
    // QA fix — neither handler previously caught a callable failure (e.g.
    // reviewTutorOnboarding's own validation errors, a stale/already-
    // decided item, a dropped connection): the promise just rejected
    // uncaught, leaving `items` stuck showing "pending" with no
    // indication anything went wrong. Now surfaced via `actionError`.
    setActionError(null);
    try {
      if (tab === "legacy") await reviewTutorVerificationFn({ uid, action: "approve" });
      else await reviewTutorOnboardingFn({ uid, action: "approve" });
      setItems((prev) => prev.map((i) => i.id === uid ? { ...i, approvalStatus: "approved" } : i));
    } catch (err: any) {
      setActionError(err?.message ?? "Could not approve. Please try again.");
    }
  };

  const handleReject = async (uid: string, reason: string) => {
    if (tab === "onboarding" && !reason.trim()) {
      setActionError("A rejection reason is required.");
      return;
    }
    setActionError(null);
    try {
      if (tab === "legacy") await reviewTutorVerificationFn({ uid, action: "reject", reason });
      else await reviewTutorOnboardingFn({ uid, action: "reject", reason });
      setItems((prev) => prev.map((i) => i.id === uid ? { ...i, approvalStatus: "rejected" } : i));
    } catch (err: any) {
      setActionError(err?.message ?? "Could not reject. Please try again.");
    }
  };

  const counts = { pending: items.filter((i) => i.approvalStatus === "pending").length };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🎓 Tutor Verifications</h1>
        <p className="text-slate-400 text-sm mt-1">
          Review submitted documents and approve tutors for the Gloows365E Tutor Marketplace
        </p>
      </div>

      <div className="flex gap-2">
        {([
          { key: "legacy" as const, label: "Verification Documents" },
          { key: "onboarding" as const, label: "Onboarding Profiles" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setFilter("pending"); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === t.key ? "bg-white text-slate-900" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors capitalize ${
              filter === f ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {f}
            {f === "pending" && counts.pending > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {counts.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-2.5">
          {actionError}
        </div>
      )}

      <ApprovalQueue
        items={items}
        onApprove={handleApprove}
        onReject={handleReject}
        loading={loading}
        emptyMessage={`No ${filter === "all" ? "" : filter} ${tab === "legacy" ? "tutor verifications" : "onboarding profiles"}.`}
      />
    </div>
  );
}
