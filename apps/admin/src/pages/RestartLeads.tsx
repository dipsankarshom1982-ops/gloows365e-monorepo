// PATH: admin-web/src/pages/RestartLeads.tsx
// Full leads management for Restart My Education programme.
// Features: status management, partner assignment, notes, Excel/CSV export.

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import * as XLSX from "xlsx";

interface Lead {
  id:              string;
  name:            string;
  mobile:          string;
  state:           string;
  district:        string;
  language:        string;
  age:             number;
  lastClassPassed: string;
  currentOccupation: string;
  interestedInContinuingEducation: boolean;
  consentGiven:    boolean;
  status:          LeadStatus;
  assignedPartner: string;
  notes:           string;
  source:          string;
  createdAt:       any;
}

type LeadStatus = "New" | "Verified" | "Assigned" | "Contacted" | "Admitted" | "Closed";

const STATUSES: LeadStatus[] = ["New", "Verified", "Assigned", "Contacted", "Admitted", "Closed"];

const STATUS_COLORS: Record<LeadStatus, string> = {
  New:       "bg-blue-500/10 text-blue-400",
  Verified:  "bg-purple-500/10 text-purple-400",
  Assigned:  "bg-amber-500/10 text-amber-400",
  Contacted: "bg-cyan-500/10 text-cyan-400",
  Admitted:  "bg-green-500/10 text-green-400",
  Closed:    "bg-slate-500/10 text-slate-400",
};

type FilterStatus = LeadStatus | "All";

export default function RestartLeads() {
  const [leads,       setLeads]       = useState<Lead[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<FilterStatus>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [saving,      setSaving]      = useState(false);

  // Edit form state
  const [editStatus,  setEditStatus]  = useState<LeadStatus>("New");
  const [editPartner, setEditPartner] = useState("");
  const [editNotes,   setEditNotes]   = useState("");

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, "educationLeads"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    setEditStatus(lead.status);
    setEditPartner(lead.assignedPartner || "");
    setEditNotes(lead.notes || "");
  };

  const saveEdit = async () => {
    if (!editingLead) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "educationLeads", editingLead.id), {
        status:          editStatus,
        assignedPartner: editPartner,
        notes:           editNotes,
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === editingLead.id
            ? { ...l, status: editStatus, assignedPartner: editPartner, notes: editNotes }
            : l
        )
      );
      setEditingLead(null);
    } finally {
      setSaving(false);
    }
  };

  // Export to Excel
  const exportExcel = () => {
    const data = filtered.map((l) => ({
      Name:              l.name,
      Mobile:            l.mobile,
      State:             l.state,
      District:          l.district,
      Language:          l.language,
      Age:               l.age,
      "Last Class":      l.lastClassPassed,
      Occupation:        l.currentOccupation,
      "Interested in Ed": l.interestedInContinuingEducation ? "Yes" : "Just exploring",
      Status:            l.status,
      "Assigned Partner":l.assignedPartner,
      Notes:             l.notes,
      Source:            l.source,
      Date:              l.createdAt?.toDate?.()?.toLocaleDateString("en-IN") ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Restart Leads");
    XLSX.writeFile(wb, `restart-leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Name","Mobile","State","District","Language","Age","Last Class","Occupation","Interested","Status","Partner","Notes","Date"];
    const rows = filtered.map((l) => [
      l.name, l.mobile, l.state, l.district, l.language, l.age,
      l.lastClassPassed, l.currentOccupation,
      l.interestedInContinuingEducation ? "Yes" : "Exploring",
      l.status, l.assignedPartner, l.notes.replace(/,/g, ";"),
      l.createdAt?.toDate?.()?.toLocaleDateString("en-IN") ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `restart-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = leads.filter((l) => {
    const matchStatus = filter === "All" || l.status === filter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || l.name.toLowerCase().includes(q) ||
      l.mobile.includes(q) || l.state.toLowerCase().includes(q) ||
      l.district.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<LeadStatus, number>);

  const inp = "bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 w-full";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">🎓 Restart Education Leads</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage guidance requests from adults looking to restart their education
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors border border-slate-700"
          >
            ↓ CSV
          </button>
          <button
            onClick={exportExcel}
            className="bg-green-700 hover:bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
          >
            ↓ Excel
          </button>
          <button
            onClick={fetchLeads}
            className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-sm px-3 py-2 rounded-xl transition-colors border border-slate-700"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3">
        {STATUSES.map((s) => (
          <div
            key={s}
            className={`bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center cursor-pointer transition-all ${filter === s ? "border-green-600" : ""}`}
            onClick={() => setFilter(filter === s ? "All" : s)}
          >
            <div className="text-xl font-black text-white">{counts[s] ?? 0}</div>
            <div className={`text-xs mt-0.5 font-semibold ${STATUS_COLORS[s].split(" ")[1]}`}>{s}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search name, mobile, state..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 flex-1 min-w-[200px]"
        />
        {(["All", ...STATUSES] as (FilterStatus)[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              filter === s
                ? "bg-green-700 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {s} {s !== "All" ? `(${counts[s as LeadStatus] ?? 0})` : `(${leads.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-white font-bold">
            {filtered.length} {filter === "All" ? "total" : filter.toLowerCase()} leads
          </h2>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-16">Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-16">No leads found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Mobile</th>
                  <th className="text-left p-4">Location</th>
                  <th className="text-left p-4">Profile</th>
                  <th className="text-left p-4">Interest</th>
                  <th className="text-center p-4">Status</th>
                  <th className="text-left p-4">Partner</th>
                  <th className="text-left p-4">Date</th>
                  <th className="text-center p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="p-4">
                      <div className="text-white font-semibold">{lead.name}</div>
                      <div className="text-slate-400 text-xs">{lead.language}</div>
                    </td>
                    <td className="p-4 text-slate-300 font-mono text-xs">{lead.mobile}</td>
                    <td className="p-4 text-slate-400 text-xs">
                      {lead.district}<br />{lead.state}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="text-slate-300">{lead.lastClassPassed || "—"}</div>
                      <div className="text-slate-400">{lead.currentOccupation || "—"}</div>
                      {lead.age ? <div className="text-slate-500">Age: {lead.age}</div> : null}
                    </td>
                    <td className="p-4 text-center">
                      {lead.interestedInContinuingEducation
                        ? <span className="text-green-400 font-bold text-xs">Yes ✓</span>
                        : <span className="text-slate-400 text-xs">Exploring</span>
                      }
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[lead.status]}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-xs max-w-[120px] truncate">
                      {lead.assignedPartner || "—"}
                    </td>
                    <td className="p-4 text-slate-500 text-xs whitespace-nowrap">
                      {lead.createdAt?.toDate?.()?.toLocaleDateString("en-IN") ?? "—"}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => openEdit(lead)}
                        className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingLead && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingLead(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Update Lead</h3>
              <button onClick={() => setEditingLead(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-800 rounded-xl p-3 text-sm">
              <div className="text-white font-semibold">{editingLead.name}</div>
              <div className="text-slate-400 text-xs">{editingLead.mobile} · {editingLead.district}, {editingLead.state}</div>
              <div className="text-slate-400 text-xs">{editingLead.lastClassPassed} · {editingLead.currentOccupation}</div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                className={inp}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">Assigned Partner / Advisor</label>
              <input
                type="text"
                value={editPartner}
                onChange={(e) => setEditPartner(e.target.value)}
                placeholder="Partner or advisor name"
                className={inp}
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">Internal Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes visible only to admin team..."
                rows={3}
                className={inp + " resize-none"}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold rounded-xl py-2.5 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={() => setEditingLead(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl py-2.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
