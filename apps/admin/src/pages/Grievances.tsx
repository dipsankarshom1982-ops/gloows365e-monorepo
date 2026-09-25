import { addDoc, collection, getDoc, getDocs, doc, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import DrawerForm from "../components/DrawerForm";
import StatusBadge from "../components/StatusBadge";
import { db } from "../lib/firebase";

// DPDP Act 2023 — grievance-redressal tracker. Grievances arrive via
// support@gloows365.in (no in-app grievance form yet — see privacy policy),
// so this is a manual log the compliance/support team fills in, not an
// automated inbox. Exists so there's a demonstrable record of grievances
// received and resolved within the SLA published in the Privacy Policy.

interface Grievance {
  id: string;
  raisedBy: string;
  contact?: string;
  channel: string;
  subject: string;
  description?: string;
  status: "open" | "in-progress" | "resolved";
  resolutionNotes?: string;
  raisedAt?: { toDate?: () => Date };
  resolvedAt?: { toDate?: () => Date };
}

const EMPTY = {
  raisedBy: "", contact: "", channel: "email", subject: "", description: "",
  status: "open" as Grievance["status"], resolutionNotes: "",
};

// Published at publicConfig/grievanceOfficer — publicly readable (no auth
// required, see firestore.rules) so the mobile app's Privacy Policy screen
// and the public website's privacy.html can both display it without asking
// anyone to log in. The DPDP Act, 2023 requires a named individual, not
// just a role/email, so this stays blank until someone fills it in here.
interface GrievanceOfficer {
  name: string;
  designation: string;
  email: string;
  phone: string;
}

const EMPTY_OFFICER: GrievanceOfficer = { name: "", designation: "", email: "", phone: "" };

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const textareaCls = `${inputCls} resize-none`;
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

function formatDate(ts?: { toDate?: () => Date }): string {
  return ts?.toDate ? ts.toDate().toLocaleDateString("en-IN") : "—";
}

function statusVariant(status: string): "success" | "warning" | "default" {
  if (status === "resolved") return "success";
  if (status === "in-progress") return "warning";
  return "default";
}

export default function Grievances() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading]       = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<Grievance | null>(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);

  const [officer, setOfficer]           = useState<GrievanceOfficer>(EMPTY_OFFICER);
  const [officerLoading, setOfficerLoading] = useState(true);
  const [officerSaving, setOfficerSaving]   = useState(false);
  const [officerSaved, setOfficerSaved]     = useState(false);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "grievances"), orderBy("raisedAt", "desc")));
    setGrievances(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Grievance)));
    setLoading(false);
  };

  const loadOfficer = async () => {
    setOfficerLoading(true);
    const snap = await getDoc(doc(db, "publicConfig", "grievanceOfficer"));
    if (snap.exists()) setOfficer({ ...EMPTY_OFFICER, ...(snap.data() as Partial<GrievanceOfficer>) });
    setOfficerLoading(false);
  };

  useEffect(() => { load(); loadOfficer(); }, []);

  const saveOfficer = async () => {
    setOfficerSaving(true);
    try {
      await setDoc(doc(db, "publicConfig", "grievanceOfficer"), { ...officer, updatedAt: serverTimestamp() });
      setOfficerSaved(true);
      setTimeout(() => setOfficerSaved(false), 2500);
    } finally {
      setOfficerSaving(false);
    }
  };

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setDrawerOpen(true); };
  const openEdit = (g: Grievance) => {
    setEditing(g);
    setForm({
      raisedBy: g.raisedBy, contact: g.contact ?? "", channel: g.channel, subject: g.subject,
      description: g.description ?? "", status: g.status, resolutionNotes: g.resolutionNotes ?? "",
    });
    setDrawerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const resolvedFields = form.status === "resolved" ? { resolvedAt: serverTimestamp() } : {};
      if (editing) {
        await updateDoc(doc(db, "grievances", editing.id), { ...form, ...resolvedFields });
      } else {
        await addDoc(collection(db, "grievances"), { ...form, raisedAt: serverTimestamp() });
      }
      setDrawerOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">📮 Grievances</h1>
          <p className="text-slate-400 text-sm mt-1">{grievances.length} logged · grievance redressal under the DPDP Act, 2023</p>
        </div>
        <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          + Log Grievance
        </button>
      </div>

      {/* Published publicly — see privacy.tsx (mobile) and privacy.html
          (website), both of which read publicConfig/grievanceOfficer. */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-white font-bold text-lg">👤 Grievance Officer Details</h2>
          <p className="text-slate-400 text-sm mt-1">
            Shown publicly on the app's Privacy Policy screen and the website — the DPDP Act, 2023
            requires a named individual, not just a role or email.
          </p>
        </div>
        {officerLoading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input value={officer.name} onChange={(e) => setOfficer((o) => ({ ...o, name: e.target.value }))} className={inputCls} placeholder="e.g. Priya Sharma" />
              </div>
              <div>
                <label className={labelCls}>Designation</label>
                <input value={officer.designation} onChange={(e) => setOfficer((o) => ({ ...o, designation: e.target.value }))} className={inputCls} placeholder="e.g. Grievance Officer" />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input value={officer.email} onChange={(e) => setOfficer((o) => ({ ...o, email: e.target.value }))} className={inputCls} placeholder="support@gloows365.in" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input value={officer.phone} onChange={(e) => setOfficer((o) => ({ ...o, phone: e.target.value }))} className={inputCls} placeholder="Optional" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveOfficer} disabled={officerSaving || !officer.name || !officer.email}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
                {officerSaving ? "Saving…" : "Save"}
              </button>
              {officerSaved && <span className="text-green-400 text-sm font-semibold">✓ Saved — live on app &amp; website</span>}
              {!officer.name && !officerSaving && <span className="text-amber-400 text-sm">⚠ Not set — Privacy Policy shows a placeholder until this is saved</span>}
            </div>
          </>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : grievances.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No grievances logged.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Raised By</th>
                <th className="text-left p-4">Subject</th>
                <th className="text-left p-4">Channel</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Raised</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grievances.map((g, i) => (
                <motion.tr key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-4">
                    <p className="text-white font-medium">{g.raisedBy}</p>
                    <p className="text-slate-500 text-xs">{g.contact ?? "—"}</p>
                  </td>
                  <td className="p-4 text-slate-300 max-w-xs truncate">{g.subject}</td>
                  <td className="p-4"><span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-lg capitalize">{g.channel}</span></td>
                  <td className="p-4"><StatusBadge label={g.status} variant={statusVariant(g.status)} /></td>
                  <td className="p-4 text-slate-400 text-xs">{formatDate(g.raisedAt)}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => openEdit(g)} className="text-indigo-400 hover:text-indigo-300 text-xs px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">Manage</button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DrawerForm open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? "Manage Grievance" : "Log Grievance"}
        footer={
          <>
            <button onClick={save} disabled={saving || !form.raisedBy || !form.subject} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        <div><label className={labelCls}>Raised By *</label><input value={form.raisedBy} onChange={(e) => setForm((f) => ({ ...f, raisedBy: e.target.value }))} className={inputCls} placeholder="Name" /></div>
        <div><label className={labelCls}>Contact</label><input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className={inputCls} placeholder="Email or phone" /></div>
        <div>
          <label className={labelCls}>Channel</label>
          <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} className={inputCls}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="in-app">In-App</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div><label className={labelCls}>Subject *</label><input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={inputCls} placeholder="Short summary" /></div>
        <div><label className={labelCls}>Description</label><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={textareaCls} rows={3} placeholder="Full grievance details" /></div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Grievance["status"] }))} className={inputCls}>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div><label className={labelCls}>Resolution Notes</label><textarea value={form.resolutionNotes} onChange={(e) => setForm((f) => ({ ...f, resolutionNotes: e.target.value }))} className={textareaCls} rows={3} placeholder="How this was resolved" /></div>
      </DrawerForm>
    </div>
  );
}
