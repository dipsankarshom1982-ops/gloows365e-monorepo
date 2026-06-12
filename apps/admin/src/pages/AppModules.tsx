import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import ToggleSwitch from "../components/ToggleSwitch";
import { useAuth } from "../context/AuthContext";

interface AppModule {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  isEnabled: boolean;
  isComingSoon?: boolean;
  order?: number;
}

export default function AppModules() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canManage = isAdmin || isSuperAdmin;

  const [modules, setModules] = useState<AppModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, "appModules")).then((snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AppModule))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      // Moderators only see enabled modules; admins/superAdmins see all
      setModules(canManage ? data : data.filter((m) => m.isEnabled));
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, field: "isEnabled" | "isComingSoon", current: boolean) => {
    await updateDoc(doc(db, "appModules", id), { [field]: !current });
    setModules((prev) => prev.map((m) => m.id === id ? { ...m, [field]: !current } : m));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🧩 App Modules</h1>
        <p className="text-slate-400 text-sm mt-1">
          {canManage
            ? "Enable or disable features across the app"
            : "Showing active modules only — admin access required to manage"}
        </p>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : modules.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          No modules configured yet. Add documents to the <code className="text-indigo-400">appModules</code> collection.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {m.icon && <span className="text-3xl">{m.icon}</span>}
                  <div>
                    <p className="text-white font-bold">{m.name}</p>
                    {m.description && <p className="text-slate-400 text-xs mt-0.5">{m.description}</p>}
                  </div>
                </div>
                {m.isComingSoon && (
                  <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0">
                    SOON
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <ToggleSwitch
                  value={m.isEnabled}
                  onChange={() => toggle(m.id, "isEnabled", m.isEnabled)}
                  label={m.isEnabled ? "Enabled" : "Disabled"}
                  disabled={!canManage}
                />
                {canManage && (
                  <button
                    onClick={() => toggle(m.id, "isComingSoon", m.isComingSoon ?? false)}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                      m.isComingSoon
                        ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                    }`}
                  >
                    Coming Soon
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
