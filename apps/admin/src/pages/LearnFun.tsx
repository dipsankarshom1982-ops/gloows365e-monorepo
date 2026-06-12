import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import DrawerForm from "../components/DrawerForm";
import ToggleSwitch from "../components/ToggleSwitch";

type Tab = "missions" | "games" | "badges";

interface Mission { id: string; title: string; description?: string; coinsReward?: number; isActive: boolean; date?: string; }
interface Game    { id: string; title: string; description?: string; gameType?: string; isActive: boolean; }
interface Badge   { id: string; title: string; description?: string; iconUrl?: string; criteria?: string; isActive: boolean; }

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function LearnFun() {
  const [tab, setTab]             = useState<Tab>("missions");
  const [missions, setMissions]   = useState<Mission[]>([]);
  const [games, setGames]         = useState<Game[]>([]);
  const [badges, setBadges]       = useState<Badge[]>([]);
  const [loading, setLoading]     = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [mForm, setMForm] = useState({ title: "", description: "", coinsReward: 5, date: "", isActive: true });
  const [gForm, setGForm] = useState({ title: "", description: "", gameType: "quiz", isActive: true });
  const [bForm, setBForm] = useState({ title: "", description: "", iconUrl: "", criteria: "", isActive: true });

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "dailyFunLearnMissions")),
      getDocs(collection(db, "LearnFunGames")),
      getDocs(collection(db, "LearnFunBadges")),
    ]).then(([mSnap, gSnap, bSnap]) => {
      setMissions(mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Mission)));
      setGames(gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Game)));
      setBadges(bSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Badge)));
      setLoading(false);
    });
  }, []);

  const saveMission = async () => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "dailyFunLearnMissions"), { ...mForm, coinsReward: Number(mForm.coinsReward), createdAt: serverTimestamp() });
      setMissions((prev) => [...prev, { id: ref.id, ...mForm, coinsReward: Number(mForm.coinsReward) }]);
      setDrawerOpen(false); setMForm({ title: "", description: "", coinsReward: 5, date: "", isActive: true });
    } finally { setSaving(false); }
  };

  const saveGame = async () => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "LearnFunGames"), { ...gForm, createdAt: serverTimestamp() });
      setGames((prev) => [...prev, { id: ref.id, ...gForm }]);
      setDrawerOpen(false); setGForm({ title: "", description: "", gameType: "quiz", isActive: true });
    } finally { setSaving(false); }
  };

  const saveBadge = async () => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "LearnFunBadges"), { ...bForm, createdAt: serverTimestamp() });
      setBadges((prev) => [...prev, { id: ref.id, ...bForm }]);
      setDrawerOpen(false); setBForm({ title: "", description: "", iconUrl: "", criteria: "", isActive: true });
    } finally { setSaving(false); }
  };

  const toggleItem = async (col: string, id: string, current: boolean, setter: (fn: (prev: any[]) => any[]) => void) => {
    await updateDoc(doc(db, col, id), { isActive: !current });
    setter((prev: { id: string; isActive: boolean }[]) => prev.map((i) => i.id === id ? { ...i, isActive: !current } : i));
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "missions", label: "📅 Daily Missions", count: missions.length },
    { key: "games",    label: "🕹️ Games",          count: games.length },
    { key: "badges",   label: "🏅 Badges",          count: badges.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-black text-white">🎮 LearnFun</h1></div>
        <button onClick={() => setDrawerOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">+ Add {tab.slice(0, -1)}</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === t.key ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            {t.label} <span className="ml-1 text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? <div className="text-center text-slate-400 py-16">Loading…</div> : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-slate-400 text-xs uppercase"><th className="text-left p-4">Title</th><th className="text-left p-4">Details</th><th className="text-right p-4">Active</th></tr></thead>
            <tbody>
              {(tab === "missions" ? missions : tab === "games" ? games : badges).map((item: any, i: number) => (
                <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {item.iconUrl && <img src={item.iconUrl} alt="" className="w-6 h-6 rounded" />}
                      <p className="text-white font-medium">{item.title}</p>
                    </div>
                    {item.description && <p className="text-slate-400 text-xs mt-0.5">{item.description}</p>}
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {tab === "missions" && item.coinsReward && <span>🪙 {item.coinsReward} coins{item.date ? ` · ${item.date}` : ""}</span>}
                    {tab === "games" && item.gameType && <span className="bg-slate-800 px-2 py-0.5 rounded capitalize">{item.gameType}</span>}
                    {tab === "badges" && item.criteria && <span>{item.criteria}</span>}
                  </td>
                  <td className="p-4 text-right">
                    <ToggleSwitch value={item.isActive} onChange={() =>
                      toggleItem(
                        tab === "missions" ? "dailyFunLearnMissions" : tab === "games" ? "LearnFunGames" : "LearnFunBadges",
                        item.id, item.isActive,
                        tab === "missions" ? setMissions : tab === "games" ? setGames : setBadges
                      )
                    } />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mission Drawer */}
      {tab === "missions" && (
        <DrawerForm open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Daily Mission"
          footer={<><button onClick={saveMission} disabled={saving || !mForm.title} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm">{saving ? "Saving…" : "Save"}</button><button onClick={() => setDrawerOpen(false)} className="text-slate-400 px-4 text-sm">Cancel</button></>}
        >
          <div><label className={labelCls}>Title *</label><input value={mForm.title} onChange={(e) => setMForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Description</label><input value={mForm.description} onChange={(e) => setMForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Coins Reward</label><input type="number" min={0} value={mForm.coinsReward} onChange={(e) => setMForm((f) => ({ ...f, coinsReward: Number(e.target.value) }))} className={inputCls} /></div>
            <div><label className={labelCls}>Date</label><input type="date" value={mForm.date} onChange={(e) => setMForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} /></div>
          </div>
          <ToggleSwitch value={mForm.isActive} onChange={(v) => setMForm((f) => ({ ...f, isActive: v }))} label="Active" />
        </DrawerForm>
      )}

      {/* Game Drawer */}
      {tab === "games" && (
        <DrawerForm open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Game"
          footer={<><button onClick={saveGame} disabled={saving || !gForm.title} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm">{saving ? "Saving…" : "Save"}</button><button onClick={() => setDrawerOpen(false)} className="text-slate-400 px-4 text-sm">Cancel</button></>}
        >
          <div><label className={labelCls}>Title *</label><input value={gForm.title} onChange={(e) => setGForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Description</label><input value={gForm.description} onChange={(e) => setGForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Game Type</label><select value={gForm.gameType} onChange={(e) => setGForm((f) => ({ ...f, gameType: e.target.value }))} className={inputCls}><option value="quiz">Quiz</option><option value="flashcard">Flashcard</option><option value="memory">Memory</option><option value="word">Word</option></select></div>
          <ToggleSwitch value={gForm.isActive} onChange={(v) => setGForm((f) => ({ ...f, isActive: v }))} label="Active" />
        </DrawerForm>
      )}

      {/* Badge Drawer */}
      {tab === "badges" && (
        <DrawerForm open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Badge"
          footer={<><button onClick={saveBadge} disabled={saving || !bForm.title} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm">{saving ? "Saving…" : "Save"}</button><button onClick={() => setDrawerOpen(false)} className="text-slate-400 px-4 text-sm">Cancel</button></>}
        >
          <div><label className={labelCls}>Title *</label><input value={bForm.title} onChange={(e) => setBForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Description</label><input value={bForm.description} onChange={(e) => setBForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Icon URL</label><input value={bForm.iconUrl} onChange={(e) => setBForm((f) => ({ ...f, iconUrl: e.target.value }))} className={inputCls} placeholder="https://…" /></div>
          <div><label className={labelCls}>Criteria</label><input value={bForm.criteria} onChange={(e) => setBForm((f) => ({ ...f, criteria: e.target.value }))} className={inputCls} placeholder="Complete 10 missions" /></div>
          <ToggleSwitch value={bForm.isActive} onChange={(v) => setBForm((f) => ({ ...f, isActive: v }))} label="Active" />
        </DrawerForm>
      )}
    </div>
  );
}
