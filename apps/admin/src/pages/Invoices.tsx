// PATH: apps/admin/src/pages/Invoices.tsx
// Invoices — superAdmin-only (Admin Billing & Invoice Panel V1, 2026-09-11).
//
// Read-only search/browse/detail view across every invoice document (the
// synthetic invoices written by aiGuruSubscription.ts/seekho.ts today, and
// any future native-Subscription invoice — see functions/src/financial/
// invoice.ts and functions/src/razorpaySubscriptions.ts), backed by
// functions/src/invoiceSearch.ts's searchInvoices — superAdmin-gated,
// read-only, reading the invoices collection that is otherwise closed to
// every client except "own doc, own uid" (firestore.rules). This page
// never writes anything: there is no edit/mark-paid/regenerate action
// anywhere here, matching invoices' own immutability (`allow write: if
// false` in firestore.rules) — an invoice is a record of what actually
// happened, not something an admin panel corrects.
//
// Visual language deliberately reused from PaymentManagement.tsx (same
// filter-grid, table, and slide-over detail-panel conventions) rather than
// inventing a new design system for this page.
//
// One callable, not two: unlike Payment Management's searchPaymentOrders +
// getPaymentDetail split (needed there because a payment order requires a
// separate entitlement/refund join), an invoice row already carries every
// field a detail view needs — see invoiceSearch.ts's header. Selecting a
// row here just opens a panel over data already in hand from the search
// response; no second network call.

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

type InvoiceStatus = "paid" | "pending" | "failed";

interface InvoiceRow {
  invoiceId: string;
  source: string;
  uid: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  status: string;
  planId: string | null;
  planName: string | null;
  currency: string;
  totalAmountPaise: number;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpayInvoiceId: string | null;
  razorpaySubscriptionId: string | null;
  invoiceUrl: string | null;
  shortUrl: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const searchInvoicesFn = httpsCallable<
  {
    uid?: string; status?: InvoiceStatus; planId?: string;
    startDate?: string; endDate?: string; minAmountPaise?: number; maxAmountPaise?: number;
    cursor?: string; pageSize?: number;
  },
  { rows: InvoiceRow[]; nextCursor: string | null }
>(functions, "searchInvoices");

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_CLASSES: Record<string, string> = {
  paid:    "bg-green-500/20 text-green-400",
  pending: "bg-amber-500/20 text-amber-400",
  failed:  "bg-red-500/20 text-red-400",
};

const SOURCE_LABELS: Record<string, string> = {
  aiguru_subscription: "AI Guru Subscription",
  seekho_subscription: "Seekho Subscription",
  razorpay_native_subscription: "Razorpay Subscription",
};

export default function Invoices() {
  const [uid, setUid] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // Entered/displayed in rupees (matching rupees() display everywhere else
  // on this page) — converted to paise only at the API call boundary.
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [selected, setSelected] = useState<InvoiceRow | null>(null);

  const runSearch = async (append = false) => {
    setSearchError("");
    if (append) setLoadingMore(true); else { setLoading(true); setRows([]); setCursor(null); }
    setHasSearched(true);
    try {
      const res = await searchInvoicesFn({
        uid: uid.trim() || undefined,
        status: status || undefined,
        planId: planId.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minAmountPaise: minAmount ? Math.round(parseFloat(minAmount) * 100) : undefined,
        maxAmountPaise: maxAmount ? Math.round(parseFloat(maxAmount) * 100) : undefined,
        cursor: append ? cursor ?? undefined : undefined,
        pageSize: 20,
      });
      const data = res.data;
      setRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
      setCursor(data.nextCursor);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial general browse — same convention as Payment Management, which
  // loads a filter-free recent-orders page on mount rather than starting
  // on an empty screen.
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = (row: InvoiceRow) => setSelected(row);
  const closeDetail = () => setSelected(null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">🧾 Invoices</h1>
        <p className="text-slate-400 text-sm mt-1">
          Read-only search across every subscription invoice. Nothing on this page can edit, delete, or regenerate an invoice.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">User ID (uid)</label>
            <input value={uid} onChange={(e) => setUid(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="Firebase uid" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "" | InvoiceStatus)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Any</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Plan ID</label>
            <input value={planId} onChange={(e) => setPlanId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="planId" />
          </div>
          <div />
          <div>
            <label className="block text-xs text-slate-500 mb-1">From date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Min amount (₹)</label>
            <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max amount (₹)</label>
            <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={() => runSearch(false)} disabled={loading}
            className="text-sm font-bold px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors disabled:opacity-50">
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {searchError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{searchError}</div>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">No invoices found for this search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Student</th>
                    <th className="text-left p-3">Plan</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Invoice ID</th>
                    <th className="text-right p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.invoiceId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors align-top">
                      <td className="p-3 text-slate-400 text-xs">{fmtDate(row.paidAt ?? row.createdAt)}</td>
                      <td className="p-3">
                        <div className="text-white text-xs font-mono">{row.studentId ?? "—"}</div>
                        <div className="text-slate-300 text-xs">{row.studentName ?? "—"}</div>
                        <div className="text-slate-600 text-xs">{row.studentEmail ?? ""}</div>
                      </td>
                      <td className="p-3 text-slate-400 text-xs">
                        {row.planName ?? row.planId ?? "—"}
                        <div className="text-slate-600">{SOURCE_LABELS[row.source] ?? row.source}</div>
                      </td>
                      <td className="p-3 text-right text-white font-bold tabular-nums">{rupees(row.totalAmountPaise)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${STATUS_CLASSES[row.status] ?? "bg-slate-700 text-slate-300"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-xs font-mono">
                        <div>{row.invoiceId}</div>
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
              <h2 className="text-white font-bold text-lg">Invoice Detail</h2>
              <button onClick={closeDetail} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${STATUS_CLASSES[selected.status] ?? "bg-slate-700 text-slate-300"}`}>
              {selected.status}
            </span>

            {/* Student information */}
            <section>
              <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Student Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Student ID: </span><span className="text-white font-mono">{selected.studentId ?? "—"}</span></div>
                <div><span className="text-slate-500">Name: </span><span className="text-white">{selected.studentName ?? "—"}</span></div>
                <div><span className="text-slate-500">Email: </span><span className="text-white">{selected.studentEmail ?? "—"}</span></div>
                <div><span className="text-slate-500">User ID: </span><span className="text-white font-mono text-xs">{selected.uid}</span></div>
              </div>
            </section>

            {/* Invoice information */}
            <section>
              <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Invoice Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Amount: </span><span className="text-white font-bold">{rupees(selected.totalAmountPaise)}</span> <span className="text-slate-600">{selected.currency}</span></div>
                <div><span className="text-slate-500">Invoice ID: </span><span className="text-white font-mono text-xs">{selected.invoiceId}</span></div>
                <div><span className="text-slate-500">Source: </span><span className="text-white">{SOURCE_LABELS[selected.source] ?? selected.source}</span></div>
                <div><span className="text-slate-500">Issued: </span><span className="text-white">{fmtDate(selected.issuedAt)}</span></div>
                <div><span className="text-slate-500">Paid: </span><span className="text-white">{fmtDate(selected.paidAt)}</span></div>
                <div><span className="text-slate-500">Created: </span><span className="text-white">{fmtDate(selected.createdAt)}</span></div>
                {selected.billingPeriodStart && (
                  <div><span className="text-slate-500">Billing period start: </span><span className="text-white">{fmtDate(selected.billingPeriodStart)}</span></div>
                )}
                {selected.billingPeriodEnd && (
                  <div><span className="text-slate-500">Billing period end: </span><span className="text-white">{fmtDate(selected.billingPeriodEnd)}</span></div>
                )}
              </div>
            </section>

            {/* Product information */}
            <section>
              <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Product Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selected.planId && <div><span className="text-slate-500">Plan: </span><span className="text-white">{selected.planId}</span></div>}
                {selected.planName && <div><span className="text-slate-500">Plan name: </span><span className="text-white">{selected.planName}</span></div>}
              </div>
            </section>

            {/* Razorpay references */}
            <section>
              <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Razorpay References</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Order ID: </span><span className="text-white font-mono text-xs">{selected.razorpayOrderId ?? "—"}</span></div>
                <div><span className="text-slate-500">Payment ID: </span><span className="text-white font-mono text-xs">{selected.razorpayPaymentId ?? "—"}</span></div>
                <div><span className="text-slate-500">Invoice ID (Razorpay): </span><span className="text-white font-mono text-xs">{selected.razorpayInvoiceId ?? "—"}</span></div>
                <div><span className="text-slate-500">Subscription ID: </span><span className="text-white font-mono text-xs">{selected.razorpaySubscriptionId ?? "—"}</span></div>
              </div>
            </section>

            {/* Invoice document — only shown when a real URL exists; never
                a fabricated "Download PDF" affordance (matching the
                customer-facing billing UI's same explicit rule). */}
            {(selected.invoiceUrl || selected.shortUrl) && (
              <section>
                <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Invoice Document</h3>
                <a
                  href={selected.shortUrl ?? selected.invoiceUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-bold px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg transition-colors"
                >
                  View Invoice
                </a>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
