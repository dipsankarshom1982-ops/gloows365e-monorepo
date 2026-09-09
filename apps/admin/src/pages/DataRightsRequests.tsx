import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "../lib/firebase";
import StatusBadge from "../components/StatusBadge";

// DPDP Act 2023 — read-only audit trail of exportMyData / eraseMyAccount
// requests (functions/src/dataRights.ts writes these, clients never can —
// see firestore.rules). Lets whoever handles compliance demonstrate the
// 30-day SLA mentioned in the Privacy Policy is actually being met.

interface DataRightsRequest {
  id: string;
  uid?: string;
  type?: "export" | "erase";
  status?: "processing" | "completed" | "failed";
  requestedAt?: { toDate?: () => Date };
  completedAt?: { toDate?: () => Date };
  error?: string;
}

const PAGE = 25;

function formatDate(ts?: { toDate?: () => Date }): string {
  return ts?.toDate ? ts.toDate().toLocaleString("en-IN") : "—";
}

function statusVariant(status?: string): "success" | "warning" | "error" | "default" {
  if (status === "completed") return "success";
  if (status === "processing") return "warning";
  if (status === "failed") return "error";
  return "default";
}

export default function DataRightsRequests() {
  const [requests, setRequests] = useState<DataRightsRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [typeFilter, setType]   = useState("all");
  const [lastDoc, setLastDoc]   = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore]   = useState(true);

  const loadPage = async (after?: QueryDocumentSnapshot<DocumentData> | null) => {
    setLoading(true);
    let q = query(collection(db, "dataRightsLog"), orderBy("requestedAt", "desc"), limit(PAGE));
    if (after) q = query(collection(db, "dataRightsLog"), orderBy("requestedAt", "desc"), startAfter(after), limit(PAGE));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DataRightsRequest));
    setRequests((prev) => after ? [...prev, ...docs] : docs);
    setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
    setHasMore(snap.docs.length === PAGE);
    setLoading(false);
  };

  useEffect(() => { loadPage(); }, []);

  const filtered = requests.filter((r) => typeFilter === "all" || r.type === typeFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🔐 Data Rights Requests</h1>
        <p className="text-slate-400 text-sm mt-1">
          {requests.length} loaded · export &amp; erasure requests under the DPDP Act, 2023
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={typeFilter} onChange={(e) => setType(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="export">Export</option>
          <option value="erase">Erase</option>
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading && !requests.length ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No requests found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">User UID</th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Requested</th>
                <th className="text-left p-4">Completed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-slate-300 font-mono text-xs">{r.uid ?? "—"}</td>
                  <td className="p-4 text-slate-300 capitalize">{r.type === "erase" ? "🗑️ Erase" : "📥 Export"}</td>
                  <td className="p-4">
                    <StatusBadge label={r.status ?? "unknown"} variant={statusVariant(r.status)} />
                    {r.status === "failed" && r.error && (
                      <p className="text-red-400/70 text-xs mt-1 max-w-xs truncate" title={r.error}>{r.error}</p>
                    )}
                  </td>
                  <td className="p-4 text-slate-400 text-xs">{formatDate(r.requestedAt)}</td>
                  <td className="p-4 text-slate-400 text-xs">{formatDate(r.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hasMore && !loading && (
          <div className="p-4 text-center border-t border-slate-800">
            <button onClick={() => loadPage(lastDoc)} className="text-indigo-400 hover:text-indigo-300 text-sm font-bold">Load More</button>
          </div>
        )}
      </div>
    </div>
  );
}
