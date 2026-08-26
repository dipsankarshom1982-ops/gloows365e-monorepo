// PATH: apps/admin/src/pages/RefundManagement.tsx
// Admin-controlled refund + reconciliation UI (launch audit, Phase 1 Task 7).
// Goes entirely through functions/src/refunds.ts's Admin-SDK callables —
// refunds/{id} has `allow write: if false` in firestore.rules, same
// closed-write pattern every other real-money collection in this codebase
// uses (see TutorPayouts.tsx). This screen only reads that collection
// directly (admins are allowed to) and triggers processRefund /
// resolveRefundReconciliation for every state change.
//
// V1: full refunds only, one flow at a time, looked up by the Razorpay
// payment ID (what a receipt/support ticket actually shows an admin).

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, limit as fbLimit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

type Flow = "aiGuruSubscription" | "seekhoSubscription" | "aiGuruCredits" | "tutorCredits";
type RefundStatus = "processing" | "succeeded" | "failed" | "needs_reconciliation";

const FLOW_LABELS: Record<Flow, string> = {
  aiGuruSubscription: "AI Guru Subscription",
  seekhoSubscription: "Seekho Subscription",
  aiGuruCredits:      "AI Guru Credits",
  tutorCredits:       "Tutor Credits",
};
const FLOWS = Object.keys(FLOW_LABELS) as Flow[];

const STATUS_STYLES: Record<RefundStatus, string> = {
  processing:            "bg-slate-700 text-slate-300",
  succeeded:              "bg-green-500/20 text-green-400",
  failed:                 "bg-red-500/20 text-red-400",
  needs_reconciliation:   "bg-amber-500/20 text-amber-400",
};

interface EntitlementAction {
  type: string;
  detail: string;
  creditsClawedBack?: number;
}

interface RefundRecord {
  id: string;
  flow: Flow;
  uid: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  originalAmountPaise: number;
  refundedAmountPaise: number;
  isFullRefund: boolean;
  reason: string;
  status: RefundStatus;
  razorpayRefundId?: string | null;
  entitlementAction?: EntitlementAction | null;
  errorMessage?: string | null;
  requestedBy: string;
  requestedAt?: { toDate: () => Date };
  processedAt?: { toDate: () => Date } | null;
}

const processRefundFn = httpsCallable<
  { flow: Flow; razorpayPaymentId: string; reason: string },
  { success: boolean; refundId: string; razorpayRefundId: string; entitlementAction: EntitlementAction }
>(functions, "processRefund");

const resolveReconciliationFn = httpsCallable<
  { refundId: string; resolution: "confirmed_refunded" | "not_actually_refunded"; note?: string },
  { status: string; entitlementAction?: EntitlementAction }
>(functions, "resolveRefundReconciliation");

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function RefundManagement() {
  const [flow, setFlow]                       = useState<Flow>("aiGuruSubscription");
  const [razorpayPaymentId, setPaymentId]      = useState("");
  const [reason, setReason]                     = useState("");
  const [submitting, setSubmitting]             = useState(false);
  const [formError, setFormError]               = useState("");
  const [formSuccess, setFormSuccess]           = useState("");

  const [recent, setRecent]           = useState<RefundRecord[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadRecent = async () => {
    setLoadingRecent(true);
    try {
      const snap = await getDocs(
        query(collection(db, "refunds"), orderBy("requestedAt", "desc"), fbLimit(50))
      );
      setRecent(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RefundRecord)));
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => { loadRecent(); }, []);

  const submitRefund = async () => {
    setFormError(""); setFormSuccess("");
    if (!razorpayPaymentId.trim()) { setFormError("Enter the Razorpay payment ID (starts with pay_)."); return; }
    if (!reason.trim()) { setFormError("A reason is required — this becomes part of the audit trail."); return; }
    if (!window.confirm(
      `Refund the full amount for ${FLOW_LABELS[flow]} payment "${razorpayPaymentId.trim()}"?\n\n` +
      `This calls Razorpay immediately and cannot be undone from here. Reason: "${reason.trim()}"`
    )) return;

    setSubmitting(true);
    try {
      const { data } = await processRefundFn({ flow, razorpayPaymentId: razorpayPaymentId.trim(), reason: reason.trim() });
      setFormSuccess(
        `✅ Refunded (Razorpay refund ${data.razorpayRefundId}). ` +
        `Entitlement: ${data.entitlementAction.detail}`
      );
      setPaymentId(""); setReason("");
      await loadRecent();
    } catch (e: any) {
      setFormError(e.message ?? "Refund failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const resolveReconciliation = async (r: RefundRecord, resolution: "confirmed_refunded" | "not_actually_refunded") => {
    const note = window.prompt(
      resolution === "confirmed_refunded"
        ? "Confirming this WAS refunded outside the system (checked in Razorpay dashboard). Add a note for the audit trail:"
        : "Confirming this was NOT actually refunded — clearing the flag so it can be retried normally. Add a note:"
    );
    if (note === null) return; // cancelled
    setResolvingId(r.id);
    try {
      await resolveReconciliationFn({ refundId: r.id, resolution, note: note || undefined });
      await loadRecent();
    } catch (e: any) {
      alert(e.message ?? "Failed to resolve.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">💳 Refund Management</h1>
        <p className="text-slate-400 text-sm mt-1">
          Full refunds only, across AI Guru subscriptions/credits, Seekho subscriptions, and tutor credit packs.
          Every refund is server-verified, calls Razorpay directly, and is logged below — nothing here writes
          to Firestore except through the backend.
        </p>
      </div>

      {/* New refund form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold text-lg">Process a Refund</h2>

        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{formError}</div>
        )}
        {formSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-green-400 text-sm">{formSuccess}</div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Payment Flow</label>
            <select
              value={flow}
              onChange={(e) => setFlow(e.target.value as Flow)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            >
              {FLOWS.map((f) => <option key={f} value={f}>{FLOW_LABELS[f]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Razorpay Payment ID</label>
            <input
              type="text"
              value={razorpayPaymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="pay_XXXXXXXXXXXXXX"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Reason (required)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate charge, customer request"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <button
          onClick={submitRefund}
          disabled={submitting}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          {submitting ? "Processing…" : "Process Full Refund"}
        </button>
      </div>

      {/* Recent refunds */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-bold">Recent Refunds</h2>
          <button onClick={loadRecent} className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-1.5 transition-colors">
            ↻ Refresh
          </button>
        </div>

        {loadingRecent ? (
          <div className="text-center text-slate-400 py-16">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="text-center text-slate-400 py-16">No refunds yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="text-left p-4">Flow</th>
                  <th className="text-left p-4">Payment</th>
                  <th className="text-right p-4">Amount</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Entitlement</th>
                  <th className="text-left p-4">Reason</th>
                  <th className="text-right p-4"></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors align-top">
                    <td className="p-4 text-slate-300">{FLOW_LABELS[r.flow] ?? r.flow}</td>
                    <td className="p-4">
                      <div className="text-white font-mono text-xs">{r.razorpayPaymentId}</div>
                      <div className="text-slate-600 text-xs font-mono">{r.uid?.slice(0, 12)}…</div>
                    </td>
                    <td className="p-4 text-right text-white font-bold tabular-nums">{rupees(r.originalAmountPaise)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES[r.status] ?? "bg-slate-700 text-slate-300"}`}>
                        {r.status}
                      </span>
                      {r.errorMessage && (
                        <div className="text-red-400 text-xs mt-1 max-w-[220px]">{r.errorMessage}</div>
                      )}
                    </td>
                    <td className="p-4 text-slate-400 text-xs max-w-[260px]">
                      {r.entitlementAction?.detail ?? "—"}
                    </td>
                    <td className="p-4 text-slate-400 text-xs max-w-[180px]">{r.reason}</td>
                    <td className="p-4 text-right">
                      {r.status === "needs_reconciliation" && (
                        <div className="flex flex-col gap-1 items-end">
                          <button
                            disabled={resolvingId === r.id}
                            onClick={() => resolveReconciliation(r, "confirmed_refunded")}
                            className="text-xs font-bold px-3 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Confirm refunded
                          </button>
                          <button
                            disabled={resolvingId === r.id}
                            onClick={() => resolveReconciliation(r, "not_actually_refunded")}
                            className="text-xs font-bold px-3 py-1 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Not refunded — clear
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
