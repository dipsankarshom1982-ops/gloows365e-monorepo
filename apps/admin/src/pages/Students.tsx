import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import DrawerPanel from "../components/DrawerPanel";
import StatusBadge from "../components/StatusBadge";

interface Student {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  class?: string;
  school?: string;
  createdAt?: { toDate?: () => Date };
  profilePic?: string;
}

const getHistoryFn = httpsCallable<{ userId: string }, { subscriptions: Record<string, unknown>[] }>(
  functions, "getUserSubscriptionHistory"
);

const PAGE = 20;

export default function Students() {
  const [students, setStudents]   = useState<Student[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [classFilter, setClass]   = useState("all");
  const [lastDoc, setLastDoc]     = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore]     = useState(true);
  const [selected, setSelected]   = useState<Student | null>(null);
  const [history, setHistory]     = useState<Record<string, unknown>[]>([]);
  const [loadingHistory, setLH]   = useState(false);

  const loadPage = async (after?: QueryDocumentSnapshot<DocumentData> | null) => {
    setLoading(true);
    let q = query(collection(db, "students"), orderBy("createdAt", "desc"), limit(PAGE));
    if (after) q = query(collection(db, "students"), orderBy("createdAt", "desc"), startAfter(after), limit(PAGE));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
    setStudents((prev) => after ? [...prev, ...docs] : docs);
    setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
    setHasMore(snap.docs.length === PAGE);
    setLoading(false);
  };

  useEffect(() => { loadPage(); }, []);

  const openProfile = async (s: Student) => {
    setSelected(s);
    setLH(true);
    try {
      const res = await getHistoryFn({ userId: s.id });
      setHistory(res.data.subscriptions);
    } catch { setHistory([]); }
    finally { setLH(false); }
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (s.name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q) || (s.phone ?? "").includes(q);
    const matchClass = classFilter === "all" || s.class === classFilter;
    return matchSearch && matchClass;
  });

  const classes = ["all", "6", "7", "8", "9", "10", "11", "12"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">👥 Students</h1>
        <p className="text-slate-400 text-sm mt-1">{students.length} loaded</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-indigo-500"
          placeholder="Search by name, email or phone…"
        />
        <select value={classFilter} onChange={(e) => setClass(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        >
          {classes.map((c) => <option key={c} value={c}>{c === "all" ? "All Classes" : `Class ${c}`}</option>)}
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading && !students.length ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Student</th>
                <th className="text-left p-4">Class</th>
                <th className="text-left p-4">School</th>
                <th className="text-left p-4">Joined</th>
                <th className="text-right p-4">Profile</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => openProfile(s)}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-sm">
                        {s.profilePic ? <img src={s.profilePic} alt="" className="w-full h-full object-cover" /> : "👤"}
                      </div>
                      <div>
                        <p className="text-white font-medium">{s.name ?? "—"}</p>
                        <p className="text-slate-500 text-xs">{s.email ?? s.phone ?? s.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300">{s.class ? `Class ${s.class}` : "—"}</td>
                  <td className="p-4 text-slate-400 text-xs max-w-[160px] truncate">{s.school ?? "—"}</td>
                  <td className="p-4 text-slate-400 text-xs">
                    {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="p-4 text-right"><button className="text-indigo-400 hover:text-indigo-300 text-xs">View →</button></td>
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

      <DrawerPanel open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? "Student Profile"} subtitle={selected?.email ?? selected?.phone ?? selected?.id}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Class", value: selected.class ? `Class ${selected.class}` : "—" },
                { label: "School", value: selected.school ?? "—" },
                { label: "Phone", value: selected.phone ?? "—" },
                { label: "UID", value: selected.id },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800 rounded-xl p-3">
                  <p className="text-slate-500 text-xs mb-1">{label}</p>
                  <p className="text-white text-sm font-medium truncate">{value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase mb-3">Subscription History</p>
              {loadingHistory ? (
                <p className="text-slate-400 text-sm">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-slate-500 text-sm">No subscriptions found.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((sub, i) => (
                    <div key={i} className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{String(sub.planName ?? sub.planId ?? "Plan")}</p>
                        <p className="text-slate-400 text-xs capitalize">{String(sub.source ?? "")} · {String(sub.status ?? "")}</p>
                      </div>
                      <StatusBadge
                        label={String(sub.status ?? "unknown")}
                        variant={sub.status === "active" ? "success" : sub.status === "expired" ? "error" : "default"}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DrawerPanel>
    </div>
  );
}
