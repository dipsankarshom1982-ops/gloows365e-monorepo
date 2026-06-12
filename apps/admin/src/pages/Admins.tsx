import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import DrawerPanel from "../components/DrawerPanel";
import { ALL_PERMISSIONS, PERMISSION_SECTIONS } from "../lib/permissions";

interface Admin {
  uid: string;
  email: string;
  name: string;
  role: "superAdmin" | "admin" | "moderator";
  permissions: string[];
  isActive: boolean;
}

const ROLE_STYLES: Record<string, string> = {
  superAdmin: "bg-amber-500/20 text-amber-300",
  admin:      "bg-indigo-500/20 text-indigo-300",
  moderator:  "bg-slate-700 text-slate-300",
};

const createAdminFn = httpsCallable<
  { email: string; name: string; role: string },
  { uid: string; email: string }
>(functions, "createAdmin");

export default function Admins() {
  const { user, isSuperAdmin } = useAuth();
  const [admins, setAdmins]     = useState<Admin[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState("");
  const [error, setError]       = useState("");
  const [form, setForm]         = useState({ email: "", name: "", role: "admin" as Admin["role"] });

  // Permission drawer state
  const [permTarget, setPermTarget]     = useState<Admin | null>(null);
  const [editPerms, setEditPerms]       = useState<string[]>([]);
  const [savingPerms, setSavingPerms]   = useState(false);

  useEffect(() => {
    getDocs(collection(db, "admins")).then((snap) => {
      setAdmins(snap.docs.map((d) => d.data() as Admin));
      setLoading(false);
    });
  }, []);

  const toggleActive = async (uid: string, current: boolean) => {
    if (!isSuperAdmin) return;
    await updateDoc(doc(db, "admins", uid), { isActive: !current });
    setAdmins((prev) => prev.map((a) => a.uid === uid ? { ...a, isActive: !current } : a));
  };

  const handleAdd = async () => {
    if (!form.email || !form.name) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await createAdminFn({ email: form.email, name: form.name, role: form.role });
      const { uid, email } = result.data;
      setAdmins((prev) => [
        ...prev.filter((a) => a.uid !== uid),
        { uid, email, name: form.name, role: form.role, permissions: [], isActive: true },
      ]);
      setSuccess(`✅ Invite sent to ${email}. They'll receive a password-reset email.`);
      setForm({ email: "", name: "", role: "admin" });
      setShowForm(false);
    } catch (e: any) {
      setError(e.message ?? "Failed to create admin.");
    } finally { setSaving(false); }
  };

  // Open permission drawer
  const openPermissions = (a: Admin) => {
    setPermTarget(a);
    setEditPerms(a.permissions ?? []);
  };

  const togglePerm = (key: string) => {
    setEditPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setEditPerms(ALL_PERMISSIONS.map((p) => p.key));
  const clearAll  = () => setEditPerms([]);

  const savePermissions = async () => {
    if (!permTarget) return;
    setSavingPerms(true);
    try {
      await updateDoc(doc(db, "admins", permTarget.uid), { permissions: editPerms });
      setAdmins((prev) => prev.map((a) => a.uid === permTarget.uid ? { ...a, permissions: editPerms } : a));
      setPermTarget(null);
    } finally { setSavingPerms(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">👑 Admins</h1>
          <p className="text-slate-400 text-sm mt-1">{admins.length} admin(s) registered</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setShowForm((v) => !v); setError(""); setSuccess(""); }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            + Onboard Admin
          </button>
        )}
      </div>

      {/* Banners */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-green-400 text-sm"
          >{success}</motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm"
          >{error}</motion.div>
        )}
      </AnimatePresence>

      {/* Onboard form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4"
          >
            <div>
              <h2 className="text-white font-bold">Onboard New Admin</h2>
              <p className="text-slate-400 text-xs mt-1">
                We'll create their account and email them a link to set their own password.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email address"
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Admin["role"] }))}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              >
                <option value="admin">admin</option>
                <option value="moderator">moderator</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} disabled={saving || !form.email || !form.name}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors"
              >
                {saving ? "Sending invite…" : "Send Invite"}
              </button>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white px-5 py-2 text-sm">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No admins yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Admin</th>
                <th className="text-left p-4">Role</th>
                <th className="text-left p-4">Permissions</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.uid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <p className="text-white font-medium">{a.name}</p>
                    <p className="text-slate-400 text-xs">{a.email}</p>
                    <p className="text-slate-600 text-xs font-mono">{a.uid.slice(0, 16)}…</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${ROLE_STYLES[a.role] ?? ROLE_STYLES.moderator}`}>
                      {a.role}
                    </span>
                  </td>
                  <td className="p-4">
                    {a.role === "superAdmin" ? (
                      <span className="text-amber-400 text-xs font-bold">All access</span>
                    ) : a.permissions?.includes("all") ? (
                      <span className="text-indigo-400 text-xs font-bold">All modules</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {(a.permissions ?? []).slice(0, 4).map((p) => (
                          <span key={p} className="bg-slate-800 text-slate-400 text-xs px-1.5 py-0.5 rounded">{p}</span>
                        ))}
                        {(a.permissions ?? []).length > 4 && (
                          <span className="text-slate-500 text-xs">+{(a.permissions ?? []).length - 4} more</span>
                        )}
                        {!(a.permissions ?? []).length && (
                          <span className="text-slate-600 text-xs italic">No access</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isSuperAdmin && a.role !== "superAdmin" && (
                        <button
                          onClick={() => openPermissions(a)}
                          className="text-xs font-bold px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg transition-colors"
                        >
                          🔑 Permissions
                        </button>
                      )}
                      {isSuperAdmin && a.uid !== user?.uid && (
                        <button
                          onClick={() => toggleActive(a.uid, a.isActive)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                            a.isActive
                              ? "bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400"
                              : "bg-red-500/20 text-red-400 hover:bg-green-500/20 hover:text-green-400"
                          }`}
                        >
                          {a.isActive ? "Active" : "Inactive"}
                        </button>
                      )}
                      {a.uid === user?.uid && (
                        <span className="text-slate-500 text-xs italic">You</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Permission Drawer */}
      <DrawerPanel
        open={!!permTarget}
        onClose={() => setPermTarget(null)}
        title={`Permissions — ${permTarget?.name ?? ""}`}
        subtitle={permTarget?.email}
      >
        {permTarget && (
          <div className="space-y-5">
            {/* Quick actions */}
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg font-bold transition-colors">
                Select All
              </button>
              <button onClick={clearAll} className="text-xs px-3 py-1.5 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-lg font-bold transition-colors">
                Clear All
              </button>
            </div>

            {/* Permission sections */}
            {PERMISSION_SECTIONS.map(({ section, items }) => (
              <div key={section}>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">{section}</p>
                <div className="space-y-1">
                  {items.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={editPerms.includes(perm.key)}
                        onChange={() => togglePerm(perm.key)}
                        className="w-4 h-4 rounded accent-indigo-500"
                      />
                      <span className="text-slate-300 text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Save */}
            <div className="pt-2 border-t border-slate-800 flex gap-3">
              <button
                onClick={savePermissions}
                disabled={savingPerms}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                {savingPerms ? "Saving…" : "Save Permissions"}
              </button>
              <button onClick={() => setPermTarget(null)} className="text-slate-400 hover:text-white px-4 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </DrawerPanel>
    </div>
  );
}
