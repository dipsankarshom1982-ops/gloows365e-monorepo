// PATH: apps/admin/src/pages/Waitlist.tsx
// Shows all waitlist signups from the website's "Join With Us" form.
// Collection: waitlist — fields: studentName, schoolName, board, class,
// email, phone, source, createdAt.
// Features: live count, search by name/school/email, filter by class/board,
// CSV export, delete entry.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

interface WaitlistEntry {
  id: string;
  studentName: string;
  schoolName: string;
  board: string;
  class: number;
  email: string;
  phone: string;
  source?: string;
  createdAt?: Timestamp;
}

const BOARDS = [
  "CBSE","ICSE","West Bengal Board","Maharashtra Board",
  "Tamil Nadu Board","Karnataka Board","UP Board","Bihar Board",
  "Rajasthan Board","MP Board","Gujarat Board","Other State Board",
];

const CLASSES = [6,7,8,9,10,11,12];

function formatDate(ts?: Timestamp): string {
  if (!ts) return "—";
  const d = ts.toDate();
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function downloadCSV(entries: WaitlistEntry[]) {
  const headers = ["Name","School","Board","Class","Email","Phone","Joined On"];
  const rows = entries.map((e) => [
    e.studentName, e.schoolName, e.board, e.class,
    e.email, e.phone, formatDate(e.createdAt),
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `waitlist_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

export default function Waitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<number | "">("");
  const [filterBoard, setFilterBoard] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "waitlist"), orderBy("createdAt", "desc")),
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WaitlistEntry)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const matchSearch =
        !q ||
        e.studentName?.toLowerCase().includes(q) ||
        e.schoolName?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.phone?.includes(q);
      const matchClass = filterClass === "" || e.class === filterClass;
      const matchBoard = !filterBoard || e.board === filterBoard;
      return matchSearch && matchClass && matchBoard;
    });
  }, [entries, search, filterClass, filterBoard]);

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this entry from the waitlist?")) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "waitlist", id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f0f4ff", marginBottom: 4 }}>
            📋 Waitlist
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            {loading ? "Loading…" : `${entries.length} total · ${filtered.length} shown`}
          </p>
        </div>
        <button
          onClick={() => downloadCSV(filtered)}
          disabled={filtered.length === 0}
          style={{
            background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
            color: "#fff", border: "none", borderRadius: 12,
            padding: "11px 22px", fontWeight: 700, fontSize: 14,
            cursor: filtered.length === 0 ? "not-allowed" : "pointer",
            opacity: filtered.length === 0 ? 0.5 : 1,
          }}
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search name, school, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 260px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
            padding: "11px 16px", color: "#f0f4ff", fontSize: 14, outline: "none",
          }}
        />
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value === "" ? "" : Number(e.target.value))}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "11px 16px", color: "#f0f4ff", fontSize: 14,
            outline: "none", minWidth: 130,
          }}
        >
          <option value="">All Classes</option>
          {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select
          value={filterBoard}
          onChange={(e) => setFilterBoard(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "11px 16px", color: "#f0f4ff", fontSize: 14,
            outline: "none", minWidth: 180,
          }}
        >
          <option value="">All Boards</option>
          {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading waitlist…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
          <p style={{ color: "#94a3b8", fontSize: 15 }}>
            {entries.length === 0 ? "No signups yet. Share the website!" : "No entries match your filters."}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, color: "#f0f4ff" }}>
            <thead>
              <tr style={{ background: "rgba(124,58,237,0.15)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {["Student","School","Board","Class","Email","Phone","Joined",""].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 700, fontSize: 12, letterSpacing: "0.5px", color: "#c4b5fd", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={entry.id}
                  style={{
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)")}
                >
                  <td style={{ padding: "13px 16px", fontWeight: 600 }}>{entry.studentName}</td>
                  <td style={{ padding: "13px 16px", color: "#94a3b8" }}>{entry.schoolName}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ background: "rgba(124,58,237,0.2)", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                      {entry.board}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ background: "rgba(6,182,212,0.15)", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 700, color: "#67e8f9" }}>
                      {entry.class}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", color: "#94a3b8" }}>
                    <a href={`mailto:${entry.email}`} style={{ color: "#a5b4fc", textDecoration: "none" }}>{entry.email}</a>
                  </td>
                  <td style={{ padding: "13px 16px", color: "#94a3b8", fontFamily: "monospace" }}>{entry.phone}</td>
                  <td style={{ padding: "13px 16px", color: "#94a3b8", whiteSpace: "nowrap" }}>{formatDate(entry.createdAt)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      style={{
                        background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                        borderRadius: 8, padding: "5px 10px", color: "#f87171",
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                        opacity: deletingId === entry.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === entry.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Class breakdown */}
      {entries.length > 0 && (
        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {CLASSES.map((c) => {
            const count = entries.filter((e) => e.class === c).length;
            if (!count) return null;
            return (
              <div key={c} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 18px", textAlign: "center", minWidth: 80 }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#c4b5fd" }}>{count}</p>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Class {c}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}