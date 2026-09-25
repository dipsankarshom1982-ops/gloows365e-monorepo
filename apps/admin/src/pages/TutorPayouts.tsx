// PATH: apps/admin/src/pages/TutorPayouts.tsx
// ShikshaHub Phase 5 — admin review queue for tutor payout requests.
// Unlike StarboardPayouts.tsx (which writes credits directly from the
// admin client via a Firestore batch), this goes through
// functions/src/tutorPayouts.ts's Admin-SDK callables — payoutRequests/{id}
// has `allow write: if false` in firestore.rules, same closed-write
// pattern every other ShikshaHub collection uses, since the actual balance
// debit + ledger write needs the same transaction-guarded logic
// requestPayout/markPayoutPaid already implement server-side.
//
// Workflow: pending -> (approve|reject) -> approved -> Process Payout ->
// paid. Rejected/paid/cancelled are terminal.
//
// Automated payouts phase — "Mark Paid" is now "Process Payout": clicking
// it triggers a REAL RazorpayX transfer (functions/src/tutorPayouts.ts's
// markPayoutPaid, via razorpayXClient.ts) instead of just confirming a
// manual one the admin already did outside the app. The approve/reject
// gate above is unchanged — still a human decision before any money can
// move. Once paid, the card shows the RazorpayX status/UTR
// (reconcilePayoutStatuses keeps status fresh until it's terminal).

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

type PayoutRequestStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";
type RazorpayStatus = "queued" | "pending" | "processing" | "processed" | "reversed" | "failed" | "cancelled" | "rejected";

interface PayoutRequest {
  id: string;
  tutorUid: string;
  tutorName?: string;
  requestedAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  payoutAmount: number;
  method: "bank_transfer" | "upi";
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  status: PayoutRequestStatus;
  adminNote?: string;
  requestedAt?: { toDate?: () => Date };
  razorpayPayoutId?: string;
  razorpayStatus?: RazorpayStatus;
  razorpayUtr?: string | null;
}

type Filter = "pending" | "approved" | "paid" | "rejected" | "all";

const reviewPayoutRequestFn = httpsCallable<
  { requestId: string; action: "approve" | "reject"; note?: string },
  { status: PayoutRequestStatus }
>(functions, "reviewPayoutRequest");

const markPayoutPaidFn = httpsCallable<
  { requestId: string; note?: string },
  { status: PayoutRequestStatus; razorpayStatus?: RazorpayStatus; razorpayUtr?: string | null }
>(functions, "markPayoutPaid");

const RAZORPAY_STATUS_COLORS: Record<RazorpayStatus, string> = {
  queued:     "text-amber-400",
  pending:    "text-amber-400",
  processing: "text-blue-400",
  processed:  "text-green-400",
  reversed:   "text-red-400",
  failed:     "text-red-400",
  cancelled:  "text-slate-400",
  rejected:   "text-red-400",
};

const STATUS_COLORS: Record<PayoutRequestStatus, string> = {
  pending:   "bg-amber-500/15 text-amber-400",
  approved:  "bg-blue-500/15 text-blue-400",
  paid:      "bg-green-500/15 text-green-400",
  rejected:  "bg-red-500/15 text-red-400",
  cancelled: "bg-slate-700 text-slate-400",
};

function fmtDate(ts?: { toDate?: () => Date }): string {
  const d = ts?.toDate?.();
  return d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default function TutorPayouts() {
  const [items, setItems]     = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("pending");
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const loadQueue = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "payoutRequests"), orderBy("requestedAt", "desc")));
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayoutRequest)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); }, []);

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const pendingCount = items.filter((i) => i.status === "pending").length;

  async function handleReview(id: string, action: "approve" | "reject") {
    if (action === "reject") {
      const note = window.prompt("Rejection reason (shown to the tutor):");
      if (note === null) return;
      await runAction(id, () => reviewPayoutRequestFn({ requestId: id, action, note }));
    } else {
      if (!window.confirm("Approve this payout request? You'll still need to transfer the money yourself and mark it paid afterward.")) return;
      await runAction(id, () => reviewPayoutRequestFn({ requestId: id, action }));
    }
  }

  async function handleProcessPayout(id: string) {
    if (!window.confirm("Process this payout via RazorpayX now? This triggers a REAL bank transfer and debits the tutor's earnings balance — it cannot be undone.")) return;
    const note = window.prompt("Optional note:") ?? undefined;
    await runAction(id, () => markPayoutPaidFn({ requestId: id, note: note || undefined }));
  }

  async function runAction(id: string, fn: () => Promise<unknown>) {
    setActingOn(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      await fn();
      await loadQueue();
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [id]: e?.message ?? "Action failed." }));
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">💸 Tutor Payouts</h1>
        <p className="text-slate-400 text-sm mt-1">
          Review Instant Help earnings withdrawal requests. Approving does NOT move any money —
          Process Payout does, via a real RazorpayX transfer.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["pending", "approved", "paid", "rejected", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors capitalize ${
              filter === f ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {f}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
        <button onClick={loadQueue} className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-2 transition-colors ml-auto">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-16">No {filter === "all" ? "" : filter} payout requests.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white font-bold">{item.tutorName || "Unnamed tutor"}</div>
                  <div className="text-slate-500 text-xs font-mono">{item.tutorUid.slice(0, 14)}…</div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[item.status]}`}>
                  {item.status}
                </span>
              </div>

              <div className="bg-slate-800 rounded-xl p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Requested</span><span className="text-white font-bold">₹{item.requestedAmount}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Commission ({item.commissionPercent}%)</span><span className="text-slate-300">−₹{item.commissionAmount}</span></div>
                <div className="flex justify-between border-t border-slate-700 pt-1 mt-1"><span className="text-slate-300 font-semibold">Tutor receives</span><span className="text-green-400 font-bold">₹{item.payoutAmount}</span></div>
              </div>

              <div className="text-xs text-slate-400 space-y-0.5">
                <div>Method: <span className="text-slate-300 font-semibold">{item.method === "upi" ? "UPI" : "Bank Transfer"}</span></div>
                <div>Name: <span className="text-slate-300">{item.accountHolderName || "—"}</span></div>
                {item.method === "upi"
                  ? <div>UPI ID: <span className="text-slate-300 font-mono">{item.upiId || "—"}</span></div>
                  : <>
                      <div>A/C: <span className="text-slate-300 font-mono">{item.accountNumber || "—"}</span></div>
                      <div>IFSC: <span className="text-slate-300 font-mono">{item.ifsc || "—"}</span></div>
                    </>
                }
                <div>Requested: {fmtDate(item.requestedAt)}</div>
                {item.adminNote && <div className="text-slate-500 italic mt-1">Note: {item.adminNote}</div>}
                {item.razorpayStatus && (
                  <div className="pt-1 mt-1 border-t border-slate-800">
                    RazorpayX: <span className={`font-semibold capitalize ${RAZORPAY_STATUS_COLORS[item.razorpayStatus]}`}>{item.razorpayStatus}</span>
                    {item.razorpayUtr && <> · UTR <span className="text-slate-300 font-mono">{item.razorpayUtr}</span></>}
                  </div>
                )}
              </div>

              {item.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReview(item.id, "reject")}
                    disabled={actingOn === item.id}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleReview(item.id, "approve")}
                    disabled={actingOn === item.id}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              )}
              {item.status === "approved" && (
                <button
                  onClick={() => handleProcessPayout(item.id)}
                  disabled={actingOn === item.id}
                  className="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                >
                  {actingOn === item.id ? "Processing via RazorpayX…" : "💸 Process Payout"}
                </button>
              )}
              {rowError[item.id] && <p className="text-red-400 text-xs font-semibold">{rowError[item.id]}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
