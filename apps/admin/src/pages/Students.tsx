import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, limit, startAfter, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
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
  studentId?: string;
}

const getHistoryFn = httpsCallable<{ userId: string }, { subscriptions: Record<string, unknown>[] }>(
  functions, "getUserSubscriptionHistory"
);
const adminEraseStudentFn = httpsCallable<{ uid: string }, { success: boolean }>(
  functions, "adminEraseStudent"
);

const PAGE = 20;
// Student IDs are always "GLS" + 6 digits (see functions/src/studentId.ts)
// — matching this shape is what tells search to also fire the dedicated
// Firestore lookup below, instead of only filtering the page already loaded.
const STUDENT_ID_RE = /^GLS\d{4,}$/i;

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

  // Tester role — lives on users/{uid}.role, not students/{uid}. Loaded
  // lazily per-student (when their drawer opens) rather than for the whole
  // list, since role checks at list-scale would mean one extra read per row.
  const [testerIds, setTesterIds]   = useState<Set<string>>(new Set());
  const [roleLoading, setRoleLoading] = useState(false);
  const [savingRole, setSavingRole]   = useState(false);

  // Direct student-ID lookup — the loaded `students` page only holds the
  // most recent PAGE-sized window, so a search for a student ID belonging
  // to someone outside that window needs its own targeted query rather
  // than filtering what's already in memory.
  const [idLookupResult,  setIdLookupResult]  = useState<Student | null>(null);
  const [idLookupLoading, setIdLookupLoading] = useState(false);

  const [deleting, setDeleting] = useState(false);

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

  // Live student-ID lookup — debounced, fires only when the search box
  // holds something shaped like a student ID (GLS + digits).
  useEffect(() => {
    const term = search.trim().toUpperCase();
    if (!STUDENT_ID_RE.test(term)) { setIdLookupResult(null); return; }

    let cancelled = false;
    setIdLookupLoading(true);
    const t = setTimeout(async () => {
      try {
        const snap = await getDocs(query(collection(db, "students"), where("studentId", "==", term), limit(1)));
        if (cancelled) return;
        setIdLookupResult(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Student));
      } catch {
        if (!cancelled) setIdLookupResult(null);
      } finally {
        if (!cancelled) setIdLookupLoading(false);
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  const openProfile = async (s: Student) => {
    setSelected(s);
    setLH(true);
    setRoleLoading(true);
    try {
      const res = await getHistoryFn({ userId: s.id });
      setHistory(res.data.subscriptions);
    } catch { setHistory([]); }
    finally { setLH(false); }

    try {
      const userSnap = await getDoc(doc(db, "users", s.id));
      const role = userSnap.exists() ? (userSnap.data().role as string | undefined) : undefined;
      setTesterIds((prev) => {
        const next = new Set(prev);
        if (role === "tester") next.add(s.id); else next.delete(s.id);
        return next;
      });
    } catch { /* leave testerIds unchanged on read failure */ }
    finally { setRoleLoading(false); }
  };

  // Tester role is stored on users/{uid}.role (not students/{uid}) — this is
  // what FeatureFlagsContext / AppConfigContext check on web and mobile to
  // bypass admin-disabled features/modules entirely for QA accounts.
  //
  // Only ever writes "tester" or "student" — never touches any other role
  // (e.g. "admin") a user might already have, so toggling tester off can't
  // accidentally demote someone with a different elevated role.
  const toggleTester = async (uid: string) => {
    const isCurrentlyTester = testerIds.has(uid);
    setSavingRole(true);
    try {
      if (isCurrentlyTester) {
        const snap = await getDoc(doc(db, "users", uid));
        const currentRole = snap.exists() ? (snap.data().role as string | undefined) : undefined;
        // Only reset to "student" if the role is actually "tester" right now —
        // never overwrite an unrelated role that happened to change in between.
        if (currentRole === "tester") {
          await setDoc(doc(db, "users", uid), { role: "student" }, { merge: true });
        }
      } else {
        await setDoc(doc(db, "users", uid), { role: "tester" }, { merge: true });
      }
      setTesterIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyTester) next.delete(uid); else next.add(uid);
        return next;
      });
    } finally { setSavingRole(false); }
  };

  // Cascading delete of every collection/subcollection keyed to this
  // student's uid, plus their storage files and Auth account — same
  // routine the DPDP self-erasure flow uses (functions/src/dataRights.ts),
  // just admin-triggered against an arbitrary uid instead of "self".
  // Irreversible, hence the typed-confirmation gate.
  const handleDeleteStudent = async (s: Student) => {
    const typed = window.prompt(
      `This permanently deletes ALL data for "${s.name ?? s.email ?? s.id}" (${s.studentId ?? s.id}) — profile, activity, subscriptions, and their login. This cannot be undone.\n\nType DELETE to confirm.`
    );
    if (typed !== "DELETE") return;

    setDeleting(true);
    try {
      await adminEraseStudentFn({ uid: s.id });
      setStudents((prev) => prev.filter((row) => row.id !== s.id));
      if (idLookupResult?.id === s.id) setIdLookupResult(null);
      setSelected(null);
    } catch (err: any) {
      window.alert(err?.message ?? "Failed to delete student. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (s.name ?? "").toLowerCase().includes(q)
      || (s.email ?? "").toLowerCase().includes(q)
      || (s.phone ?? "").includes(q)
      || (s.studentId ?? "").toLowerCase().includes(q);
    const matchClass = classFilter === "all" || s.class === classFilter;
    return matchSearch && matchClass;
  });

  // The direct student-ID lookup can find someone outside the currently
  // loaded page — surface them as a distinct "Found by Student ID" result
  // rather than folding them into `filtered` (which only ever reflects
  // what's actually in the `students` state).
  const idLookupIsExtra = !!idLookupResult && !filtered.some((s) => s.id === idLookupResult.id);

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
          placeholder="Search by name, email, phone or Student ID (e.g. GLS000123)…"
        />
        <select value={classFilter} onChange={(e) => setClass(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        >
          {classes.map((c) => <option key={c} value={c}>{c === "all" ? "All Classes" : `Class ${c}`}</option>)}
        </select>
      </div>

      {/* Direct Student-ID match — shown when the search box holds a
          Student ID that resolves to someone outside the loaded page. */}
      {idLookupLoading && (
        <div className="text-slate-400 text-xs px-1">Looking up Student ID…</div>
      )}
      {idLookupIsExtra && idLookupResult && (
        <div
          className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-indigo-500/15 transition-colors"
          onClick={() => openProfile(idLookupResult)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-sm">
              {idLookupResult.profilePic ? <img src={idLookupResult.profilePic} alt="" className="w-full h-full object-cover" /> : "👤"}
            </div>
            <div>
              <p className="text-white font-medium">{idLookupResult.name ?? "—"}</p>
              <p className="text-indigo-300 text-xs font-mono">{idLookupResult.studentId} · found by Student ID</p>
            </div>
          </div>
          <button className="text-indigo-400 hover:text-indigo-300 text-xs">View →</button>
        </div>
      )}

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
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{s.name ?? "—"}</p>
                          {testerIds.has(s.id) && <StatusBadge label="🧪 Tester" variant="purple" />}
                        </div>
                        <p className="text-slate-500 text-xs">{s.email ?? s.phone ?? s.id}</p>
                        {s.studentId && <p className="text-indigo-400/80 text-[11px] font-mono">{s.studentId}</p>}
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
                { label: "Student ID", value: selected.studentId ?? "— (not yet assigned)" },
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

            <div className="bg-slate-800 rounded-xl p-4 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-300 text-sm font-bold">🧪 Tester Access</p>
                {roleLoading ? (
                  <span className="text-slate-500 text-xs">Checking…</span>
                ) : testerIds.has(selected.id) ? (
                  <StatusBadge label="Tester" variant="purple" />
                ) : (
                  <StatusBadge label="Regular student" variant="default" />
                )}
              </div>
              <p className="text-slate-500 text-xs mb-3 leading-relaxed">
                Testers see every feature and module regardless of what's toggled off in
                Feature Control or App Modules — useful for QA accounts that need to verify
                disabled features still work correctly.
              </p>
              <button
                onClick={() => toggleTester(selected.id)}
                disabled={roleLoading || savingRole}
                className={`w-full text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                  testerIds.has(selected.id)
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                }`}
              >
                {savingRole
                  ? "Saving…"
                  : testerIds.has(selected.id)
                    ? "Remove Tester Access"
                    : "Grant Tester Access"}
              </button>
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

            <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20">
              <p className="text-red-400 text-sm font-bold mb-2">⚠️ Danger Zone</p>
              <p className="text-slate-500 text-xs mb-3 leading-relaxed">
                Permanently deletes this student's profile, activity, subscriptions and login.
                This cannot be undone.
              </p>
              <button
                onClick={() => handleDeleteStudent(selected)}
                disabled={deleting}
                className="w-full text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                {deleting ? "Deleting…" : "🗑️ Delete Student Data"}
              </button>
            </div>
          </div>
        )}
      </DrawerPanel>
    </div>
  );
}
