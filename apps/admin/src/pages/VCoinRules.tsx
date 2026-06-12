import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import ToggleSwitch from "../components/ToggleSwitch";

interface VCoinRule {
  id: string;
  action: string;
  description?: string;
  coins: number;
  type: "earn" | "spend";
  isActive: boolean;
}

export default function VCoinRules() {
  const [rules, setRules]     = useState<VCoinRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editCoins, setEditCoins] = useState(0);

  useEffect(() => {
    getDocs(collection(db, "vCoinRules")).then((snap) => {
      setRules(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VCoinRule)));
      setLoading(false);
    });
  }, []);

  const startEdit = (r: VCoinRule) => { setEditId(r.id); setEditCoins(r.coins); };

  const saveCoins = async (id: string) => {
    await updateDoc(doc(db, "vCoinRules", id), { coins: editCoins });
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, coins: editCoins } : r));
    setEditId(null);
  };

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "vCoinRules", id), { isActive: !current });
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, isActive: !current } : r));
  };

  const earn  = rules.filter((r) => r.type === "earn");
  const spend = rules.filter((r) => r.type === "spend");

  const RuleTable = ({ items, title }: { items: VCoinRule[]; title: string }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-white font-bold">{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-sm">No rules configured.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
              <th className="text-left p-4">Action</th>
              <th className="text-left p-4">Description</th>
              <th className="text-right p-4">V-Coins</th>
              <th className="text-right p-4">Active</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="p-4">
                  <span className="font-mono text-indigo-400 text-xs">{r.action}</span>
                </td>
                <td className="p-4 text-slate-400">{r.description ?? "—"}</td>
                <td className="p-4 text-right">
                  {editId === r.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        value={editCoins}
                        onChange={(e) => setEditCoins(Number(e.target.value))}
                        onKeyDown={(e) => { if (e.key === "Enter") saveCoins(r.id); if (e.key === "Escape") setEditId(null); }}
                        className="w-20 bg-slate-800 border border-indigo-500 text-white rounded-lg px-2 py-1 text-xs text-right focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveCoins(r.id)} className="text-green-400 hover:text-green-300 text-xs">✓</button>
                      <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(r)}
                      className="text-white font-bold tabular-nums hover:text-indigo-400 transition-colors"
                      title="Click to edit"
                    >
                      🪙 {r.coins}
                    </button>
                  )}
                </td>
                <td className="p-4 text-right">
                  <ToggleSwitch value={r.isActive} onChange={() => toggle(r.id, r.isActive)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (loading) return <div className="text-center text-slate-400 py-16">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🪙 V-Coin Rules</h1>
        <p className="text-slate-400 text-sm mt-1">Configure how V-Coins are earned and spent. Click a coin value to edit.</p>
      </div>
      <RuleTable items={earn}  title="🟢 Earn Rules" />
      <RuleTable items={spend} title="🔴 Spend Rules" />
    </div>
  );
}
