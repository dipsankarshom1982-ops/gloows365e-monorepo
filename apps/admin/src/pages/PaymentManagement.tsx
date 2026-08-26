// PATH: apps/admin/src/pages/PaymentManagement.tsx
// Payment Management — superAdmin-only (launch audit, Task 7 follow-up).
//
// Unified search/browse/detail view across all four active payment flows
// (AI Guru Subscription, AI Guru Credits, Seekho Subscription, Tutor
// Credits), backed by functions/src/refundSearch.ts's searchPaymentOrders
// and getPaymentDetail — both superAdmin-gated, read-only, and reading the
// order collections that are otherwise closed to every client. Refund
// submission reuses the EXACT SAME processRefund/resolveRefundReconciliation
// callables RefundManagement.tsx already uses — this page never writes
// anything itself, and never invents a second refund pathway. Selecting a
// payment here auto-fills flow + razorpayPaymentId; nothing is ever typed
// by hand.
//
// Student ID shown throughout is the existing human-readable system
// (students/{uid}.studentId, "GLS000123" — functions/src/studentId.ts),
// not a new identifier.

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

type Flow = "aiGuruSubscription" | "seekhoSubscription" | "aiGuruCredits" | "tutorCredits";
type OrderStatus = "created" | "paid" | "refunded";
type RefundStatus = "processing" | "succeeded" | "failed" | "needs_reconciliation";

const FLOW_LABELS: Record<Flow, string> = {
  aiGuruSubscription: "AI Guru Subscription",
  seekhoSubscription: "Seekho Subscription",
  aiGuruCredits:      "AI Guru Credits",
  tutorCredits:       "Tutor Credits",
};
const FLOWS = Object.keys(FLOW_LABELS) as Flow[];

interface SearchResultRow {
  id: string;
  uid: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  status: string;
  amountPaise: number;
  razorpayPaymentId: string | null;
  createdAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  planId?: string;
  cycle?: string;
  packId?: string;
  credits?: number;
}

interface EntitlementAction {
  type: string;
  detail: string;
  creditsClawedBack?: number;
}

interface PaymentDetail {
  order: {
    id: string; flow: Flow; uid: string; status: string; amountPaise: number;
    razorpayOrderId: string; razorpayPaymentId: string | null;
    createdAt: string | null; paidAt: string | null; refundedAt: string | null;
    planId?: string; cycle?: string; selectedClass?: number; billingCycle?: string;
    packId?: string; credits?: number;
  };
  student: { studentId: string | null; name: string | null; email: string | null; phone: string | null; profileType: string | null } | null;
  entitlement: Record<string, unknown> | null;
  entitlementBelongsToThisOrder: boolean | null;
  refund: Record<string, unknown> | null;
}

const searchPaymentOrdersFn = httpsCallable<
  {
    flow: Flow; razorpayOrderId?: string; razorpayPaymentId?: string; uid?: string;
    studentId?: string; email?: string; name?: string; status?: OrderStatus;
    startDate?: string; endDate?: string; cursor?: string; pageSize?: number;
  },
  { rows: SearchResultRow[]; nextCursor: string | null }
>(functions, "searchPaymentOrders");

const getPaymentDetailFn = httpsCallable<{ flow: Flow; orderId: string }, PaymentDetail>(functions, "getPaymentDetail");

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
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// Display-only status normalization — never changes the source-of-truth
// order/refund status values, purely for a consistent badge in this UI.
function refundEligibility(order: PaymentDetail["order"], refund: PaymentDetail["refund"]): {
  label: string; tone: "green" | "amber" | "red" | "slate";
} {
  if (order.status !== "paid" && order.status !== "refunded") return { label: "Payment Not Completed", tone: "slate" };
  if (!refund) return order.status === "refunded" ? { label: "Refunded (no local record)", tone: "amber" } : { label: "Eligible for Refund", tone: "green" };
  const st = refund.status as RefundStatus;
  if (st === "succeeded") return { label: "Already Refunded", tone: "slate" };
  if (st === "processing") return { label: "Refund in Progress", tone: "amber" };
  if (st === "needs_reconciliation") return { label: "Needs Reconciliation", tone: "red" };
  if (st === "failed") return { label: "Refund Failed — Retry Eligible", tone: "amber" };
  return { label: "Not Eligible", tone: "slate" };
}

const TONE_CLASSES: Record<string, string> = {
  green: "bg-green-500/20 text-green-400",
  amber: "bg-amber-500/20 text-amber-400",
  red:   "bg-red-500/20 text-red-400",
  slate: "bg-slate-700 text-slate-300",
};

export default function PaymentManagement() {
  const [flow, setFlow] = useState<Flow>("aiGuruSubscription");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const [razorpayOrderId, setRazorpayOrderId] = useState("");
  const [razorpayPaymentId, setRazorpayPaymentId] = useState("");
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [rows, setRows] = useState<SearchResultRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [selected, setSelected] = useState<SearchResultRow | null>(null);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const runSearch = async (append = false) => {
    setSearchError("");
    if (append) setLoadingMore(true); else { setLoading(true); setRows([]); setCursor(null); }
    setHasSearched(true);
    try {
      const { data } = await searchPaymentOrdersFn({
        flow,
        studentId: studentId.trim() || undefined,
        email: email.trim() || undefined,
        name: name.trim() || undefined,
        uid: uid.trim() || undefined,
        razorpayOrderId: razorpayOrderId.trim() || undefined,
        razorpayPaymentId: razorpayPaymentId.trim() || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        cursor: append ? cursor ?? undefined : undefined,
      });
      setRows((prev) => append ? [...prev, ...data.rows] : data.rows);
      setCursor(data.nextCursor);
    } catch (e: any) {
      setSearchError(e.message ?? "Search failed.");
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  };

  const openDetail = async (row: SearchResultRow) => {
    setSelected(row);
    setDetail(null);
    setDetailError("");
    setActionMessage(""); setActionError(""); setReason("");
    setLoadingDetail(true);
    try {
      const { data } = await getPaymentDetailFn({ flow, orderId: row.id });
      setDetail(data);
    } catch (e: any) {
      setDetailError(e.message ?? "Failed to load payment detail.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => { setSelected(null); setDetail(null); };

  const submitRefund = async () => {
    if (!detail?.order.razorpayPaymentId) return;
    setActionError(""); setActionMessage("");
    if (!reason.trim()) { setActionError("A reason is required — this becomes part of the audit trail."); return; }
    if (!window.confirm(
      `Refund the full amount for ${FLOW_LABELS[flow]}?\n\n` +
      `Student: ${detail.student?.name ?? detail.order.uid}\n` +
      `Amount: ${rupees(detail.order.amountPaise)}\n` +
      `Razorpay Payment ID: ${detail.order.razorpayPaymentId}\n` +
      `Reason: "${reason.trim()}"\n\n` +
      `This calls Razorpay immediately and cannot be undone from here.`
    )) return;

    setSubmitting(true);
    try {
      const { data } = await processRefundFn({ flow, razorpayPaymentId: detail.order.razorpayPaymentId, reason: reason.trim() });
      setActionMessage(`✅ Refunded (Razorpay refund ${data.razorpayRefundId}). Entitlement: ${data.entitlementAction.detail}`);
      setReason("");
      await openDetail(selected!); // refresh detail with the new refund state
      await runSearch(); // refresh the list behind it
    } catch (e: any) {
      setActionError(e.message ?? "Refund failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const resolveReconciliation = async (resolution: "confirmed_refunded" | "not_actually_refunded") => {
    if (!detail?.refund) return;
    const refundId = `${flow}_${detail.order.razorpayPaymentId}`;
    const note = window.prompt(
      resolution === "confirmed_refunded"
        ? "Confirming this WAS refunded outside the system (checked in Razorpay dashboard). Add a note for the audit trail:"
        : "Confirming this was NOT actually refunded — clearing the flag so it can be retried normally. Add a note:"
    );
    if (note === null) return;
    setSubmitting(true);
    setActionError(""); setActionMessage("");
    try {
      await resolveReconciliationFn({ refundId, resolution, note: note || undefined });
      setActionMessage("✅ Reconciliation resolved.");
      await openDetail(selected!);
      await runSearch();
    } catch (e: any) {
      setActionError(e.message ?? "Failed to resolve.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">💰 Payment Management</h1>
        <p className="text-slate-400 text-sm mt-1">
          Search, review, and refund payments across all active flows — no need to look up a Razorpay Payment ID
          externally. Refunds are processed through the same secure backend as Refund Management; this page never
          writes to Firestore directly.
        </p>
      </div>

      {/* Search / filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Payment Flow</label>
            <select value={flow} onChange={(e) => setFlow(e.target.value as Flow)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500">
              {FLOWS.map((f) => <option key={f} value={f}>{FLOW_LABELS[f]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Student ID</label>
            <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="GLS000123"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Student Email</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Student Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name prefix"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">User ID</label>
            <input type="text" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="Firebase UID"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Razorpay Order ID</label>
            <input type="text" value={razorpayOrderId} onChange={(e) => setRazorpayOrderId(e.target.value)} placeholder="order_XXXXXXXXXXXXXX"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Razorpay Payment ID</label>
            <input type="text" value={razorpayPaymentId} onChange={(e) => setRazorpayPaymentId(e.target.value)} placeholder="pay_XXXXXXXXXXXXXX"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "" | OrderStatus)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500">
              <option value="">Any status</option>
              <option value="created">Created (unpaid)</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">From date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">To date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        {searchError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{searchError}</div>
        )}

        <button onClick={() => runSearch(false)} disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Results table */}
      {hasSearched && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="text-center text-slate-400 py-16">No matching payments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Student</th>
                    <th className="text-left p-3">Product</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Order / Payment ID</th>
                    <th className="text-right p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors align-top">
                      <td className="p-3 text-slate-400 text-xs">{fmtDate(row.paidAt ?? row.createdAt)}</td>
                      <td className="p-3">
                        <div className="text-white text-xs font-mono">{row.studentId ?? "—"}</div>
                        <div className="text-slate-300 text-xs">{row.studentName ?? "—"}</div>
                        <div className="text-slate-600 text-xs">{row.studentEmail ?? ""}</div>
                      </td>
                      <td className="p-3 text-slate-400 text-xs">
                        {FLOW_LABELS[flow]}
                        <div className="text-slate-600">{row.planId ?? row.packId ?? ""}{row.cycle ? ` · ${row.cycle}` : ""}{row.credits ? ` · ${row.credits} credits` : ""}</div>
                      </td>
                      <td className="p-3 text-right text-white font-bold tabular-nums">{rupees(row.amountPaise)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          row.status === "paid" ? "bg-green-500/20 text-green-400"
                            : row.status === "refunded" ? "bg-slate-700 text-slate-300"
                            : "bg-amber-500/20 text-amber-400"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-xs font-mono">
                        <div>{row.id}</div>
                        <div>{row.razorpayPaymentId ?? "—"}</div>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => openDetail(row)}
                          className="text-xs font-bold px-3 py-1 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg transition-colors">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cursor && (
            <div className="p-4 text-center border-t border-slate-800">
              <button onClick={() => runSearch(true)} disabled={loadingMore}
                className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 overflow-y-auto z-50" onClick={closeDetail}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full mt-8 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Payment Detail</h2>
              <button onClick={closeDetail} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
            </div>

            {loadingDetail && <div className="text-center text-slate-400 py-10">Loading…</div>}
            {detailError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{detailError}</div>}

            {detail && (
              <>
                {/* Eligibility badge */}
                {(() => {
                  const elig = refundEligibility(detail.order, detail.refund);
                  return (
                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${TONE_CLASSES[elig.tone]}`}>
                      {elig.label}
                    </span>
                  );
                })()}

                {/* Student information */}
                <section>
                  <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Student Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Student ID: </span><span className="text-white font-mono">{detail.student?.studentId ?? "—"}</span></div>
                    <div><span className="text-slate-500">Name: </span><span className="text-white">{detail.student?.name ?? "—"}</span></div>
                    <div><span className="text-slate-500">Email: </span><span className="text-white">{detail.student?.email ?? "—"}</span></div>
                    <div><span className="text-slate-500">Profile type: </span><span className="text-white">{detail.student?.profileType ?? "—"}</span></div>
                  </div>
                </section>

                {/* Payment information */}
                <section>
                  <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Payment Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Amount: </span><span className="text-white font-bold">{rupees(detail.order.amountPaise)}</span></div>
                    <div><span className="text-slate-500">Status: </span><span className="text-white">{detail.order.status}</span></div>
                    <div><span className="text-slate-500">Internal Order ID: </span><span className="text-white font-mono text-xs">{detail.order.id}</span></div>
                    <div><span className="text-slate-500">Razorpay Order ID: </span><span className="text-white font-mono text-xs">{detail.order.razorpayOrderId}</span></div>
                    <div><span className="text-slate-500">Razorpay Payment ID: </span><span className="text-white font-mono text-xs">{detail.order.razorpayPaymentId ?? "—"}</span></div>
                    <div><span className="text-slate-500">Created: </span><span className="text-white">{fmtDate(detail.order.createdAt)}</span></div>
                    <div><span className="text-slate-500">Paid: </span><span className="text-white">{fmtDate(detail.order.paidAt)}</span></div>
                    {detail.order.refundedAt && <div><span className="text-slate-500">Refunded: </span><span className="text-white">{fmtDate(detail.order.refundedAt)}</span></div>}
                  </div>
                </section>

                {/* Product information */}
                <section>
                  <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Product Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {detail.order.planId && <div><span className="text-slate-500">Plan: </span><span className="text-white">{detail.order.planId}</span></div>}
                    {detail.order.cycle && <div><span className="text-slate-500">Cycle: </span><span className="text-white">{detail.order.cycle}</span></div>}
                    {detail.order.selectedClass !== undefined && <div><span className="text-slate-500">Class: </span><span className="text-white">{detail.order.selectedClass}</span></div>}
                    {detail.order.billingCycle && <div><span className="text-slate-500">Billing cycle: </span><span className="text-white">{detail.order.billingCycle}</span></div>}
                    {detail.order.packId && <div><span className="text-slate-500">Pack: </span><span className="text-white">{detail.order.packId}</span></div>}
                    {detail.order.credits !== undefined && <div><span className="text-slate-500">Credits purchased: </span><span className="text-white">{detail.order.credits}</span></div>}
                  </div>
                </section>

                {/* Current entitlement */}
                <section>
                  <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Current Entitlement</h3>
                  {detail.entitlementBelongsToThisOrder === false && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-400 text-xs mb-2">
                      A newer purchase now backs this student's active entitlement — the balance/status below does not belong exclusively to this order.
                    </div>
                  )}
                  {detail.entitlementBelongsToThisOrder === null && detail.entitlement && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-slate-400 text-xs mb-2">
                      This is a pooled, shared balance — it has no per-order tagging, so it isn't proof the credits from this specific purchase are still unused.
                    </div>
                  )}
                  {detail.entitlement ? (
                    <pre className="bg-slate-950 rounded-xl p-3 text-xs text-slate-300 overflow-x-auto">{JSON.stringify(detail.entitlement, null, 2)}</pre>
                  ) : (
                    <div className="text-slate-500 text-sm">No entitlement record found for this user.</div>
                  )}
                </section>

                {/* Refund history */}
                <section>
                  <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Refund History</h3>
                  {detail.refund ? (
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-slate-500">Status: </span><span className="text-white">{String(detail.refund.status)}</span></div>
                        <div><span className="text-slate-500">Razorpay Refund ID: </span><span className="text-white font-mono text-xs">{String(detail.refund.razorpayRefundId ?? "—")}</span></div>
                        <div><span className="text-slate-500">Reason: </span><span className="text-white">{String(detail.refund.reason ?? "—")}</span></div>
                        <div><span className="text-slate-500">Requested by: </span><span className="text-white font-mono text-xs">{String(detail.refund.requestedBy ?? "—")}</span></div>
                        {!!detail.refund.entitlementAction && (
                          <div className="col-span-2"><span className="text-slate-500">Entitlement action: </span><span className="text-white">{(detail.refund.entitlementAction as EntitlementAction).detail}</span></div>
                        )}
                        {!!detail.refund.errorMessage && (
                          <div className="col-span-2 text-red-400">{String(detail.refund.errorMessage)}</div>
                        )}
                      </div>
                      {detail.refund.status === "needs_reconciliation" && (
                        <div className="flex gap-2 pt-2">
                          <button disabled={submitting} onClick={() => resolveReconciliation("confirmed_refunded")}
                            className="text-xs font-bold px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg transition-colors disabled:opacity-50">
                            Confirm refunded externally
                          </button>
                          <button disabled={submitting} onClick={() => resolveReconciliation("not_actually_refunded")}
                            className="text-xs font-bold px-3 py-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50">
                            Not actually refunded — clear
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-sm">No refund on record for this payment.</div>
                  )}
                </section>

                {/* Refund action */}
                {refundEligibility(detail.order, detail.refund).label === "Eligible for Refund" && (
                  <section className="border-t border-slate-800 pt-4 space-y-3">
                    <h3 className="text-slate-400 text-xs font-bold uppercase">Process a Refund</h3>
                    {actionError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{actionError}</div>}
                    {actionMessage && <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-green-400 text-sm">{actionMessage}</div>}
                    <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required — e.g. customer request)"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
                    <button onClick={submitRefund} disabled={submitting}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
                      {submitting ? "Processing…" : "Process Full Refund"}
                    </button>
                  </section>
                )}
                {actionMessage && refundEligibility(detail.order, detail.refund).label !== "Eligible for Refund" && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-green-400 text-sm">{actionMessage}</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
