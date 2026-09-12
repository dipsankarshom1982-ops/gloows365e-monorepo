// PATH: apps/admin/src/pages/SkillBattleModeration.tsx
//
// Phase B §1/§3/§7/§8/§9 — the admin moderation queue, cross-engine
// approve/reject/escalate workflow, report resolution, and winner
// verification, all backed by the Admin-SDK-only callables in
// functions/src/moderation/*.ts (getModerationQueue, reviewBattleSubmission,
// reviewSkillBattlePost, resolveSkillBattleReport, verifyBattleWinner).
// This page NEVER writes moderation fields directly via the client SDK —
// every mutation goes through one of those callables, which independently
// re-enforce admin-only auth, valid-state-transition checks, and the
// moderationAuditLog trail regardless of what this UI sends.
//
// Never renders internal AI/vendor scores, moderator notes meant for
// other moderators, or security internals to anyone — this page IS the
// moderator surface, so that restriction is about what's fetched from
// providers, not what's shown here; deliberately not applicable to this
// file specifically, unlike the student-facing screens.

import {
  collection, doc, getDoc, getDocs, orderBy, query, where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { db, functions } from "../lib/firebase";

// ─── Types ──────────────────────────────────────────────────────────────────

type QueueFilter =
  | "pending" | "high_risk" | "copyright_flagged" | "duplicate_suspected"
  | "reported" | "winner_review" | "recent";
type QueueSort = "priority" | "oldest" | "newest" | "risk" | "reports";

interface QueueItem {
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
}

interface ReportDoc {
  id: string;
  contentType: string;
  contentId: string;
  battleId: string;
  reporterUid: string;
  reportedUid: string;
  category: string;
  note: string;
  status: "OPEN" | "RESOLVED";
  quarantined: boolean;
  createdAt: any;
}

// ─── Callables ──────────────────────────────────────────────────────────────

const getModerationQueueFn = httpsCallable<
  { filter?: QueueFilter; sortBy?: QueueSort; pageSize?: number },
  { items: any[]; filter: string; sortBy: string }
>(functions, "getModerationQueue");

const reviewBattleSubmissionFn = httpsCallable<
  { battleId: string; studentId: string; action: string; reason?: string },
  { ok: boolean; status: string }
>(functions, "reviewBattleSubmission");

const reviewSkillBattlePostFn = httpsCallable<
  { postId: string; action: string; reason?: string },
  { ok: boolean; status: string }
>(functions, "reviewSkillBattlePost");

const resolveSkillBattleReportFn = httpsCallable<
  { reportId: string; resolution: string; note?: string },
  { ok: boolean }
>(functions, "resolveSkillBattleReport");

const verifyBattleWinnerFn = httpsCallable<
  { engine: "legacy" | "canonical"; battleId: string; uid: string; decision: "VERIFIED" | "REJECTED"; reason?: string },
  { winnerStatus: string; checklist: Record<string, boolean> }
>(functions, "verifyBattleWinner");

// ─── Small UI helpers ───────────────────────────────────────────────────────

const RISK_CLS: Record<string, string> = {
  HIGH_RISK: "bg-red-500/20 text-red-400",
  MEDIUM_RISK: "bg-amber-500/20 text-amber-400",
  LOW_RISK: "bg-slate-700 text-slate-400",
};

function Pill({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

const FILTERS: { key: QueueFilter; label: string }[] = [
  { key: "pending", label: "⏳ Pending" },
  { key: "high_risk", label: "🚨 High Risk" },
  { key: "copyright_flagged", label: "©️ Copyright" },
  { key: "duplicate_suspected", label: "🪞 Duplicate" },
  { key: "reported", label: "🚩 Reported" },
  { key: "winner_review", label: "🏆 Winner Review" },
  { key: "recent", label: "🕓 Recent" },
];

export default function SkillBattleModeration() {
  const [tab, setTab] = useState<"queue" | "reports">("queue");
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">🛡️ Skill Battle Moderation</h1>
        <p className="text-slate-400 text-sm mt-1">
          Cross-engine moderation queue, reports, and winner verification. Every action here is
          admin-only and permanently recorded in the moderation audit log.
        </p>
      </div>

      <div className="flex gap-2">
        {(["queue", "reports"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${tab === t ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
            {t === "queue" ? "📋 Moderation Queue" : "🚩 Reports"}
          </button>
        ))}
      </div>

      {tab === "queue" ? <QueueTab /> : <ReportsTab />}
    </div>
  );
}

// ─── Queue tab (§1, §3, §8/§9) ──────────────────────────────────────────────

function QueueTab() {
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [sortBy, setSortBy] = useState<QueueSort>("priority");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<{ id: string; action: string } | null>(null);
  const [reasonText, setReasonText] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await getModerationQueueFn({ filter, sortBy, pageSize: 100 });
      setItems((result.data.items as QueueItem[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? "Failed to load the moderation queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, sortBy]);

  const runAction = async (item: QueueItem, action: string, reason?: string) => {
    setProcessing(item.contentId);
    try {
      if (item.engine === "canonical") {
        await reviewBattleSubmissionFn({ battleId: item.battleId, studentId: item.studentUid, action, reason });
      } else {
        await reviewSkillBattlePostFn({ postId: item.contentId, action, reason });
      }
      setReasonFor(null);
      setReasonText("");
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Action failed. Please refresh and try again.");
    } finally {
      setProcessing(null);
    }
  };

  const runWinnerDecision = async (item: any, decision: "VERIFIED" | "REJECTED") => {
    setProcessing(item.id ?? item.contentId);
    try {
      await verifyBattleWinnerFn({ engine: item.engine, battleId: item.battleId, uid: item.uid, decision });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Verification failed. It may not meet the objective eligibility checklist yet.");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f.key ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {filter !== "winner_review" && (
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as QueueSort)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none">
              <option value="priority">Sort: Priority</option>
              <option value="oldest">Sort: Oldest first</option>
              <option value="newest">Sort: Newest first</option>
              <option value="risk">Sort: Risk level</option>
              <option value="reports">Sort: Report count</option>
            </select>
          )}
          <button onClick={load} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">🔄 Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading queue…</div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center text-slate-400">Nothing in this filter. 🎉</div>
      ) : filter === "winner_review" ? (
        <div className="space-y-3">
          {items.map((item: any, i: number) => (
            <motion.div key={item.id ?? i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-white font-bold text-sm">{item.uid} · Battle {item.battleId}</p>
                <p className="text-slate-500 text-xs">Engine: {item.engine} · Awaiting verification before any prize can be released</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button disabled={processing === item.id} onClick={() => runWinnerDecision(item, "VERIFIED")}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg">
                  ✓ Verify Winner
                </button>
                <button disabled={processing === item.id} onClick={() => runWinnerDecision(item, "REJECTED")}
                  className="bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg">
                  ✕ Reject
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const isProcessing = processing === item.contentId;
            const reviewable = item.moderationStatus === "PENDING_HUMAN_REVIEW" || item.moderationStatus === "PENDING_MODERATION";
            return (
              <motion.div key={`${item.engine}_${item.contentId}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex gap-4">
                  <div className="w-16 h-24 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center text-2xl">🎬</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm">{item.studentName || item.studentUid}</p>
                      <Pill cls="bg-slate-700 text-slate-300">{item.engine}</Pill>
                      {item.moderationStatus && <Pill cls="bg-blue-500/20 text-blue-400">{item.moderationStatus}</Pill>}
                      {item.riskLevel && <Pill cls={RISK_CLS[item.riskLevel] ?? "bg-slate-700 text-slate-400"}>{item.riskLevel}</Pill>}
                      {item.copyrightStatus && item.copyrightStatus !== "NO_MATCH" && item.copyrightStatus !== "NOT_CHECKED" && (
                        <Pill cls="bg-amber-500/20 text-amber-400">©️ {item.copyrightStatus}</Pill>
                      )}
                      {item.similarityStatus === "HIGH_SIMILARITY" && <Pill cls="bg-purple-500/20 text-purple-400">🪞 Duplicate suspected</Pill>}
                      {item.reportCount > 0 && <Pill cls="bg-red-500/20 text-red-400">🚩 {item.reportCount} report{item.reportCount === 1 ? "" : "s"}</Pill>}
                    </div>
                    <p className="text-slate-400 text-xs mt-1 truncate">{item.title || "(no caption)"}</p>
                    <p className="text-slate-500 text-xs">Battle {item.battleId} · {item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "—"}</p>
                    {item.moderationReasons?.length > 0 && (
                      <p className="text-slate-500 text-xs mt-1">Automated flags: {item.moderationReasons.join(", ")}</p>
                    )}
                    {item.mediaUrl && (
                      <a href={item.mediaUrl} target="_blank" rel="noreferrer" className="text-indigo-400 text-xs font-bold underline mt-1 inline-block">▶ View media</a>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {reviewable && (
                      <>
                        <button disabled={isProcessing} onClick={() => runAction(item, "APPROVE")}
                          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg">✓ Approve</button>
                        <button disabled={isProcessing} onClick={() => setReasonFor({ id: item.contentId, action: "REJECT" })}
                          className="bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg">✕ Reject</button>
                        <button disabled={isProcessing} onClick={() => setReasonFor({ id: item.contentId, action: "ESCALATE" })}
                          className="bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg">⬆ Escalate</button>
                      </>
                    )}
                    {item.status === "approved" || item.status === "APPROVED" ? (
                      <button disabled={isProcessing} onClick={() => setReasonFor({ id: item.contentId, action: "REMOVE" })}
                        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-bold px-3 py-2 rounded-lg">Remove</button>
                    ) : null}
                  </div>
                </div>

                {reasonFor?.id === item.contentId && (
                  <div className="mt-3 flex gap-2">
                    <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Reason (shown to the student for reject/remove)"
                      className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none" />
                    <button onClick={() => runAction(item, reasonFor.action, reasonText)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-sm">Confirm</button>
                    <button onClick={() => { setReasonFor(null); setReasonText(""); }}
                      className="bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Reports tab (§7) ───────────────────────────────────────────────────────
// Direct client-SDK read is safe here — firestore.rules' skillBattleReports
// read rule allows admin == true to read every report, same posture as
// every other admin list-view in this app. All WRITES still go through
// resolveSkillBattleReportFn (Admin SDK only, rules deny direct writes
// unconditionally).

function ReportsTab() {
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"OPEN" | "RESOLVED" | "all">("OPEN");
  const [processing, setProcessing] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<{ id: string; resolution: string } | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const constraints = filter === "all" ? [] : [where("status", "==", filter)];
      const snap = await getDocs(query(collection(db, "skillBattleReports"), ...constraints, orderBy("createdAt", "desc")));
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReportDoc)));
    } catch (e: any) {
      alert(e?.message ?? "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  // CONTENT_REMOVED is two real actions, not one: resolving the report
  // (resolveSkillBattleReportFn) only closes the report's own lifecycle —
  // it never touches the reported content itself (see
  // moderation/reporting.ts's header). Taking the content down for real
  // still goes through the same admin-only reviewer every other takedown
  // uses (reviewSkillBattlePost / reviewBattleSubmission's REMOVE action),
  // so it's independently re-validated (currently approved? etc.) rather
  // than trusted from this report-resolution flow.
  const resolve = async (report: ReportDoc, resolution: string, note?: string) => {
    setProcessing(report.id);
    try {
      if (resolution === "CONTENT_REMOVED") {
        if (report.contentType === "post") {
          await reviewSkillBattlePostFn({ postId: report.contentId, action: "REMOVE", reason: note || "Removed following a user report" });
        } else if (report.contentType === "submission") {
          // submissions/{battleId}_{uid} — battleId itself may contain
          // underscores, so split off only the trailing uid segment
          // (studentId), same id shape winnerVerification.ts relies on.
          const idx = report.contentId.lastIndexOf("_");
          const battleId = report.contentId.slice(0, idx);
          const studentId = report.contentId.slice(idx + 1);
          await reviewBattleSubmissionFn({ battleId, studentId, action: "REMOVE", reason: note || "Removed following a user report" });
        }
      }
      await resolveSkillBattleReportFn({ reportId: report.id, resolution, note });
      setNoteFor(null);
      setNoteText("");
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed to resolve the report.");
    } finally {
      setProcessing(null);
    }
  };

  const CATEGORY_LABEL: Record<string, string> = {
    copyright: "©️ Copyright", reuploaded: "🔁 Reuploaded", inappropriate: "⚠️ Inappropriate",
    harassment: "🚨 Harassment", violence: "🚨 Violence", dangerous_activity: "🚨 Dangerous activity",
    spam: "🗑️ Spam", impersonation: "🎭 Impersonation", other: "❓ Other",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["OPEN", "RESOLVED", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${filter === f ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
            {f.toLowerCase()}
          </button>
        ))}
        <button onClick={load} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg ml-auto">🔄 Refresh</button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="p-12 text-center text-slate-400">No reports in this filter.</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r, i) => {
            const isProcessing = processing === r.id;
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill cls="bg-slate-700 text-slate-300">{CATEGORY_LABEL[r.category] ?? r.category}</Pill>
                      <Pill cls={r.status === "OPEN" ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"}>{r.status}</Pill>
                      {r.quarantined && <Pill cls="bg-red-500/20 text-red-400">🔒 Content quarantined</Pill>}
                    </div>
                    <p className="text-slate-300 text-sm mt-1">
                      {r.contentType} <span className="text-slate-500">{r.contentId}</span> · Battle {r.battleId}
                    </p>
                    {r.note && <p className="text-slate-500 text-xs mt-1">"{r.note}"</p>}
                    {r.createdAt?.toDate && <p className="text-slate-600 text-xs mt-1">{r.createdAt.toDate().toLocaleString("en-IN")}</p>}
                  </div>
                  {r.status === "OPEN" && (
                    <div className="flex gap-2 shrink-0">
                      <button disabled={isProcessing} onClick={() => resolve(r, "NO_ACTION")}
                        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-bold px-3 py-2 rounded-lg">No Action</button>
                      <button disabled={isProcessing} onClick={() => setNoteFor({ id: r.id, resolution: "CONTENT_REMOVED" })}
                        className="bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg">Remove Content</button>
                      <button disabled={isProcessing} onClick={() => resolve(r, "CONTENT_APPROVED")}
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg">Content OK</button>
                    </div>
                  )}
                </div>
                {noteFor?.id === r.id && (
                  <div className="mt-3 flex gap-2">
                    <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Internal resolution note (not shown to the reported student)"
                      className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none" />
                    <button onClick={() => resolve(r, noteFor.resolution, noteText)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-sm">Confirm</button>
                    <button onClick={() => { setNoteFor(null); setNoteText(""); }}
                      className="bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
