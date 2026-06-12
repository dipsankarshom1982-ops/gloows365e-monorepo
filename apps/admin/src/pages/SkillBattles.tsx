// PATH: admin-web/src/pages/SkillBattles.tsx
// 4 tabs: Battles list | Create/Edit | Reel Approval | Leaderboard

import {
  collection, deleteDoc, doc, getDocs,
  query, serverTimestamp,
  setDoc, updateDoc, where
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import MediaUpload from "../components/MediaUpload";
import { db, functions } from "../lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "battles" | "create" | "approval" | "leaderboard";
type BattleStatus = "live" | "upcoming" | "completed";
type Scope = "india" | "state" | "district" | "local";

interface PhysicalPrize {
  rankMin: number; rankMax: number;
  item: string; quantity: number;
  estimatedValue: string; badge: string; medalEmoji: string;
}

interface Battle {
  id:               string;
  title:            string;
  description:      string;
  sponsor:          string;
  sponsorLogo:      string;
  bannerImage:      string;
  month:            string;
  startDate:        string;
  endDate:          string;
  isActive:         boolean;
  eligibleClasses:  string;
  totalPool:        string;
  winnerCount:      number;
  vcoin_india:      number;
  vcoin_state:      number;
  vcoin_district:   number;
  vcoin_local:      number;
  physicalPrizes:   PhysicalPrize[];
  statePrizes:      PhysicalPrize[];
  districtPrizes:   PhysicalPrize[];
  localPrizes:      PhysicalPrize[];
  participantCount: number;
  createdAt:        any;
}

interface Reel {
  id:              string;
  userId:          string;
  name:            string;
  school:          string;
  class:           string;
  profilePic:      string;
  location:        { district: string; state: string };
  battleId:        string;
  battleTitle:     string;
  month:           string;
  mediaUrl:        string;
  thumbnail:       string;
  status:          "pending" | "in_review" | "approved" | "rejected";
  rejectionReason: string;
  createdAt:       any;
  likes:           number;
  views:           number;
  shares:          number;
  comments:        number;
}

interface BoardEntry {
  userId: string; name: string; profilePic: string;
  school: string; class: string;
  location: { district: string; state: string; pincode: string };
  score: number; likes: number; views: number; shares: number; comments: number;
}

const SCORE_WEIGHTS = { likes: 5, views: 1, shares: 8, comments: 3, watchtime: 0.1 };
const computeScore  = (p: any) =>
  (p.likes || 0) * SCORE_WEIGHTS.likes +
  (p.views || 0) * SCORE_WEIGHTS.views +
  (p.shares || 0) * SCORE_WEIGHTS.shares +
  (p.comments || 0) * SCORE_WEIGHTS.comments +
  (p.watchTime || 0) * SCORE_WEIGHTS.watchtime;

const getBattleStatus = (b: Battle): BattleStatus => {
  const now   = Date.now();
  const start = b.startDate ? new Date(b.startDate).getTime() : 0;
  const end   = b.endDate   ? new Date(b.endDate).getTime()   : Infinity;
  if (now < start) return "upcoming";
  if (now > end)   return "completed";
  return "live";
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const approveContentFn = httpsCallable<
  { collection: string; docId: string; action: "approve" | "reject" | "in_review"; reason?: string },
  { success: boolean }
>(functions, "approveContent");

const I  = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-500";
const LB = "text-slate-300 text-xs font-bold uppercase tracking-wide block mb-2";

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BattleStatus }) {
  const m: Record<BattleStatus, string> = {
    live:      "bg-red-500/20 text-red-400 border-red-500/30",
    upcoming:  "bg-amber-500/20 text-amber-400 border-amber-500/30",
    completed: "bg-slate-600/30 text-slate-400 border-slate-600/30",
  };
  const labels = { live: "🔴 Live", upcoming: "⏰ Upcoming", completed: "✅ Completed" };
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${m[status]}`}>{labels[status]}</span>;
}

// ─── Prize rows editor ────────────────────────────────────────────────────────
function PrizeEditor({ prizes, onChange, label }: {
  prizes: PhysicalPrize[];
  onChange: (p: PhysicalPrize[]) => void;
  label: string;
}) {
  const EMPTY: PhysicalPrize = { rankMin: 1, rankMax: 1, item: "", quantity: 1, estimatedValue: "", badge: "Champion", medalEmoji: "🥇" };
  const update = (i: number, field: keyof PhysicalPrize, val: any) =>
    onChange(prizes.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={LB}>{label}</label>
        <button type="button" onClick={() => onChange([...prizes, { ...EMPTY }])}
          className="text-indigo-400 text-xs font-bold hover:text-indigo-300">+ Add Row</button>
      </div>
      {prizes.length === 0 && <p className="text-slate-500 text-xs">No prizes configured.</p>}
      {prizes.map((row, i) => (
        <div key={i} className="flex gap-2 items-end flex-wrap bg-slate-800/50 rounded-xl p-3">
          <div className="w-16"><label className="text-slate-500 text-xs mb-1 block">Min Rank</label>
            <input type="number" min={1} value={row.rankMin} onChange={(e) => update(i, "rankMin", Number(e.target.value))} className="w-full bg-slate-700 text-white rounded-lg px-2 py-2 text-xs" /></div>
          <div className="w-16"><label className="text-slate-500 text-xs mb-1 block">Max Rank</label>
            <input type="number" min={1} value={row.rankMax} onChange={(e) => update(i, "rankMax", Number(e.target.value))} className="w-full bg-slate-700 text-white rounded-lg px-2 py-2 text-xs" /></div>
          <div className="flex-1 min-w-[140px]"><label className="text-slate-500 text-xs mb-1 block">Item / Prize</label>
            <input value={row.item} onChange={(e) => update(i, "item", e.target.value)} placeholder="Dell Laptop i5" className="w-full bg-slate-700 text-white rounded-lg px-2 py-2 text-xs" /></div>
          <div className="w-20"><label className="text-slate-500 text-xs mb-1 block">Est. Value</label>
            <input value={row.estimatedValue} onChange={(e) => update(i, "estimatedValue", e.target.value)} placeholder="₹45,000" className="w-full bg-slate-700 text-white rounded-lg px-2 py-2 text-xs" /></div>
          <div className="w-16"><label className="text-slate-500 text-xs mb-1 block">Qty</label>
            <input type="number" min={1} value={row.quantity} onChange={(e) => update(i, "quantity", Number(e.target.value))} className="w-full bg-slate-700 text-white rounded-lg px-2 py-2 text-xs" /></div>
          <div className="flex-1 min-w-[100px]"><label className="text-slate-500 text-xs mb-1 block">Badge</label>
            <input value={row.badge} onChange={(e) => update(i, "badge", e.target.value)} placeholder="Champion" className="w-full bg-slate-700 text-white rounded-lg px-2 py-2 text-xs" /></div>
          <button type="button" onClick={() => onChange(prizes.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 text-lg leading-none pb-0.5">×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 1: Battle list ───────────────────────────────────────────────────────
function BattleList({ battles, loading, onEdit, onRefresh }: {
  battles: Battle[]; loading: boolean;
  onEdit: (b: Battle) => void; onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<"all" | BattleStatus>("all");

  const filtered = filter === "all" ? battles : battles.filter((b) => getBattleStatus(b) === filter);

  const handleToggle = async (b: Battle) => {
    await updateDoc(doc(db, "skillBattles", b.id), { isActive: !b.isActive });
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this battle permanently?")) return;
    await deleteDoc(doc(db, "skillBattles", id));
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "live", "upcoming", "completed"] as const).map((f) => {
          const cnt = f === "all" ? battles.length : battles.filter((b) => getBattleStatus(b) === f).length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors flex items-center gap-2 ${filter === f ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
              {f === "live" ? "🔴" : f === "upcoming" ? "⏰" : f === "completed" ? "✅" : "⚔️"} {f}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === f ? "bg-white/20" : "bg-slate-700"}`}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {loading ? <div className="p-12 text-center text-slate-400">Loading battles…</div>
        : filtered.length === 0 ? <div className="p-12 text-center text-slate-400">No battles in this filter.</div>
        : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="text-white font-bold text-base">{b.title}</h3>
                    <StatusBadge status={getBattleStatus(b)} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${b.isActive ? "bg-green-500/15 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                      {b.isActive ? "● Active" : "○ Inactive"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                    {b.startDate && <span>🟢 {b.startDate}</span>}
                    {b.endDate   && <span>🔴 {b.endDate}</span>}
                    {b.month     && <span>📅 {b.month}</span>}
                    {b.sponsor   && <span>⚡ {b.sponsor}</span>}
                    <span>👥 {b.participantCount ?? 0} participants</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {b.vcoin_india    > 0 && <span className="bg-indigo-500/15 text-indigo-400 text-xs px-2 py-1 rounded-lg font-bold">🌏 India: {b.vcoin_india} VC</span>}
                    {b.vcoin_state    > 0 && <span className="bg-purple-500/15 text-purple-400 text-xs px-2 py-1 rounded-lg font-bold">🗺️ State: {b.vcoin_state} VC</span>}
                    {b.vcoin_district > 0 && <span className="bg-sky-500/15 text-sky-400 text-xs px-2 py-1 rounded-lg font-bold">🏙️ Dist: {b.vcoin_district} VC</span>}
                    {b.vcoin_local    > 0 && <span className="bg-teal-500/15 text-teal-400 text-xs px-2 py-1 rounded-lg font-bold">📍 Local: {b.vcoin_local} VC</span>}
                    {b.totalPool      && <span className="bg-amber-500/15 text-amber-400 text-xs px-2 py-1 rounded-lg font-bold">🎁 Pool: {b.totalPool}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => onEdit(b)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">Edit</button>
                  <button onClick={() => handleToggle(b)} className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${b.isActive ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-green-600/20 hover:bg-green-600/30 text-green-400"}`}>
                    {b.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="text-red-400 hover:text-red-300 text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors">Delete</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Create / Edit battle ─────────────────────────────────────────────
function CreateBattle({ editBattle, onSaved, onCancel }: {
  editBattle: Battle | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const EMPTY = {
    title: "", description: "", sponsor: "", sponsorLogo: "", bannerImage: "",
    startDate: "", endDate: "", eligibleClasses: "6,7,8,9,10,11,12",
    totalPool: "", winnerCount: 10,
    vcoin_india: 500, vcoin_state: 200, vcoin_district: 100, vcoin_local: 50,
    physicalPrizes: [] as PhysicalPrize[],
    statePrizes:    [] as PhysicalPrize[],
    districtPrizes: [] as PhysicalPrize[],
    localPrizes:    [] as PhysicalPrize[],
    isActive: true,
  };

  const [form,   setForm]   = useState({ ...EMPTY, ...(editBattle ?? {}) });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    if (editBattle) setForm({ ...EMPTY, ...editBattle });
    else setForm({ ...EMPTY });
  }, [editBattle]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-derive month from startDate
  const onStartDateChange = (val: string) => {
    set("startDate", val);
    if (val) {
      const d = new Date(val);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      set("month", m);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim())   { setError("Title is required"); return; }
    if (!form.startDate)      { setError("Start date is required"); return; }
    if (!form.endDate)        { setError("End date is required"); return; }
    if (form.startDate >= form.endDate) { setError("End date must be after start date"); return; }
    setSaving(true); setError("");
    try {
      const id = editBattle?.id ?? `battle_${Date.now()}`;
      const month = form.startDate
        ? (() => { const d = new Date(form.startDate); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })()
        : currentMonth();

      await setDoc(doc(db, "skillBattles", id), {
        title:           form.title.trim(),
        description:     form.description,
        sponsor:         form.sponsor,
        sponsorLogo:     form.sponsorLogo,
        bannerImage:     form.bannerImage,
        month,
        startDate:       form.startDate,
        endDate:         form.endDate,
        isActive:        form.isActive,
        eligibleClasses: form.eligibleClasses,
        totalPool:       form.totalPool,
        winnerCount:     Number(form.winnerCount),
        vcoin_india:     Number(form.vcoin_india),
        vcoin_state:     Number(form.vcoin_state),
        vcoin_district:  Number(form.vcoin_district),
        vcoin_local:     Number(form.vcoin_local),
        physicalPrizes:  form.physicalPrizes,
        statePrizes:     form.statePrizes,
        districtPrizes:  form.districtPrizes,
        localPrizes:     form.localPrizes,
        participantCount: editBattle?.participantCount ?? 0,
        type: "sponsored",
        updatedAt: serverTimestamp(),
        ...(editBattle ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });

      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved(); }, 1500);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-black text-lg">{editBattle ? "✏️ Edit Battle" : "⚔️ Create New Battle"}</h2>
        {editBattle && <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm">Cancel edit</button>}
      </div>

      {saved  && <div className="bg-green-500/15 border border-green-500/30 rounded-xl p-4 text-green-400 font-semibold text-sm">✅ Battle {editBattle ? "updated" : "created"} successfully!</div>}
      {error  && <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">⚠️ {error}</div>}

      {/* Basic info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-slate-300 font-bold text-sm uppercase tracking-wide">Basic Info</h3>
        <div><label className={LB}>Title *</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Science Genius Battle — June 2025" className={I} /></div>
        <div><label className={LB}>Description</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className={I + " resize-none"} placeholder="What this battle is about…" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={LB}>Sponsor Name</label>
            <input value={form.sponsor} onChange={(e) => set("sponsor", e.target.value)} placeholder="e.g. BYJU'S" className={I} /></div>
          <div>
            <MediaUpload
              label="Sponsor Logo"
              storagePath="skillbattles/sponsors"
              value={form.sponsorLogo}
              onChange={(url) => set("sponsorLogo", url)}
              placeholder="https://… or upload below"
            />
          </div>
        </div>
        <MediaUpload
          label="Banner Image (optional)"
          storagePath="skillbattles/banners"
          value={form.bannerImage}
          onChange={(url) => set("bannerImage", url)}
          placeholder="https://… or upload below"
        />
        <div><label className={LB}>Eligible Classes</label>
          <input value={form.eligibleClasses} onChange={(e) => set("eligibleClasses", e.target.value)} placeholder="6,7,8,9,10,11,12" className={I} />
          <p className="text-slate-500 text-xs mt-1">Comma-separated class numbers</p></div>
      </div>

      {/* Schedule */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-slate-300 font-bold text-sm uppercase tracking-wide">Schedule</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={LB}>Start Date & Time *</label>
            <input type="datetime-local" value={form.startDate} onChange={(e) => onStartDateChange(e.target.value)} className={I} /></div>
          <div><label className={LB}>End Date & Time *</label>
            <input type="datetime-local" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={I} /></div>
        </div>
        {form.startDate && form.endDate && (
          <div className="bg-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400">
            📅 Month key (auto-derived): <span className="text-white font-mono font-bold">
              {(() => { const d = new Date(form.startDate); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })()}
            </span>
            {" · "}
            Duration: {Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000*60*60*24))} days
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={() => set("isActive", !form.isActive)} className={`relative w-12 h-6 rounded-full transition-colors ${form.isActive ? "bg-indigo-600" : "bg-slate-700"}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.isActive ? "left-7" : "left-1"}`} />
          </button>
          <span className="text-slate-300 text-sm font-semibold">{form.isActive ? "Active — visible to students" : "Inactive — hidden from students"}</span>
        </div>
      </div>

      {/* VCoins */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-slate-300 font-bold text-sm uppercase tracking-wide">🪙 VCoin Reward Pools</h3>
        <p className="text-slate-500 text-xs">Top 10 per scope earn VCoins distributed by the rank curve (30%/20%/14%/10%…)</p>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={LB}>🌏 India Pool (VCoins)</label>
            <input type="number" min={0} value={form.vcoin_india} onChange={(e) => set("vcoin_india", e.target.value)} className={I} /></div>
          <div><label className={LB}>🗺️ State Pool (VCoins)</label>
            <input type="number" min={0} value={form.vcoin_state} onChange={(e) => set("vcoin_state", e.target.value)} className={I} /></div>
          <div><label className={LB}>🏙️ District Pool (VCoins)</label>
            <input type="number" min={0} value={form.vcoin_district} onChange={(e) => set("vcoin_district", e.target.value)} className={I} /></div>
          <div><label className={LB}>📍 Local Pool (VCoins)</label>
            <input type="number" min={0} value={form.vcoin_local} onChange={(e) => set("vcoin_local", e.target.value)} className={I} /></div>
        </div>
      </div>

      {/* Cash prizes */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-slate-300 font-bold text-sm uppercase tracking-wide">💰 Cash Prizes (India — All India leaderboard)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={LB}>Total Cash Pool (₹)</label>
            <input value={form.totalPool} onChange={(e) => set("totalPool", e.target.value)} placeholder="e.g. ₹1,00,000 in prizes" className={I} /></div>
          <div><label className={LB}>Number of Cash Winners</label>
            <input type="number" min={1} value={form.winnerCount} onChange={(e) => set("winnerCount", e.target.value)} className={I} /></div>
        </div>
        <p className="text-slate-500 text-xs">Cash amounts are shown as display text in skillboard.tsx. Students see this in the India prize track.</p>
      </div>

      {/* Physical prizes per scope */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6">
        <h3 className="text-slate-300 font-bold text-sm uppercase tracking-wide">🏆 Physical Prizes</h3>
        <p className="text-slate-500 text-xs">Set per-scope physical prizes (laptops, tablets, certificates, etc.)</p>
        <PrizeEditor prizes={form.physicalPrizes} onChange={(v) => set("physicalPrizes", v)} label="🌏 India Physical Prizes" />
        <div className="border-t border-slate-800 pt-4">
          <PrizeEditor prizes={form.statePrizes} onChange={(v) => set("statePrizes", v)} label="🗺️ State Physical Prizes" />
        </div>
        <div className="border-t border-slate-800 pt-4">
          <PrizeEditor prizes={form.districtPrizes} onChange={(v) => set("districtPrizes", v)} label="🏙️ District Physical Prizes" />
        </div>
        <div className="border-t border-slate-800 pt-4">
          <PrizeEditor prizes={form.localPrizes} onChange={(v) => set("localPrizes", v)} label="📍 Local Physical Prizes" />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black px-8 py-3 rounded-xl text-sm transition-colors w-full">
        {saving ? "Saving…" : saved ? "✅ Saved!" : editBattle ? "💾 Update Battle" : "🚀 Create Battle"}
      </button>
    </div>
  );
}

// ─── Tab 3: Reel approval ─────────────────────────────────────────────────────
function ReelApproval({ battles }: { battles: Battle[] }) {
  type ReelFilter = "pending" | "in_review" | "approved" | "rejected" | "all";
  const [reels,      setReels]      = useState<Reel[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<ReelFilter>("pending");
  const [battleFilter, setBattleFilter] = useState("all");
  const [rejReason,  setRejReason]  = useState("");
  const [rejectingId,setRejectingId]= useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadReels = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "posts"), where("isSkillBattle", "==", true)));
      const all  = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reel));
      all.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setReels(all);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadReels(); }, []);

  const filteredReels = reels.filter((r) => {
    if (battleFilter !== "all" && r.battleId !== battleFilter) return false;
    if (filter === "all") return true;
    return r.status === filter;
  });

  const counts: Record<ReelFilter, number> = {
    all:       reels.length,
    pending:   reels.filter((r) => r.status === "pending").length,
    in_review: reels.filter((r) => r.status === "in_review").length,
    approved:  reels.filter((r) => r.status === "approved").length,
    rejected:  reels.filter((r) => r.status === "rejected").length,
  };

  const handleAction = async (id: string, action: "approve" | "reject" | "in_review", reason?: string) => {
    setProcessing(id);
    try {
      await approveContentFn({ collection: "posts", docId: id, action, reason });
      setReels((prev) => prev.map((r) => r.id === id
        ? { ...r, status: action === "approve" ? "approved" : action === "in_review" ? "in_review" : "rejected", rejectionReason: reason ?? r.rejectionReason }
        : r
      ));
      if (action === "reject") { setRejectingId(null); setRejReason(""); }
    } finally { setProcessing(null); }
  };

  const statusCfg = {
    pending:   { label: "⏳ Pending",   cls: "bg-amber-500/20 text-amber-400" },
    in_review: { label: "🔍 In Review", cls: "bg-blue-500/20 text-blue-400"  },
    approved:  { label: "✅ Approved",  cls: "bg-green-500/20 text-green-400" },
    rejected:  { label: "❌ Rejected",  cls: "bg-red-500/20 text-red-400"    },
  };

  return (
    <div className="space-y-4">
      {/* Battle selector */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Filter by battle</label>
          <select value={battleFilter} onChange={(e) => setBattleFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none">
            <option value="all">All battles</option>
            {battles.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.month})</option>)}
          </select>
        </div>
        <button onClick={loadReels} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm px-4 py-2 rounded-xl transition-colors self-end">🔄 Refresh</button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {(["pending","in_review","approved","rejected","all"] as ReelFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors capitalize flex items-center gap-2 ${filter === f ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
            {f.replace("_", " ")}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === f ? "bg-white/20" : "bg-slate-700"}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? <div className="p-12 text-center text-slate-400">Loading reels…</div>
        : filteredReels.length === 0 ? <div className="p-12 text-center text-slate-400">No reels in this filter.</div>
        : (
        <div className="space-y-4">
          {filteredReels.map((reel, i) => {
            const cfg = statusCfg[reel.status] ?? statusCfg.pending;
            const isProcessing = processing === reel.id;
            return (
              <motion.div key={reel.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-28 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 relative">
                    {reel.thumbnail
                      ? <img src={reel.thumbnail} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>}
                    <span className={`absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold px-1 py-0.5 rounded ${cfg.cls}`}>{cfg.label}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-bold text-sm">{reel.name || "Student"}</p>
                        <p className="text-slate-400 text-xs">{reel.school} · Class {reel.class}</p>
                        <p className="text-slate-500 text-xs">📍 {reel.location?.district}, {reel.location?.state}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-indigo-400 text-xs font-bold truncate max-w-[140px]">{reel.battleTitle || reel.battleId}</p>
                        <p className="text-slate-500 text-xs">{reel.month}</p>
                        {reel.createdAt?.toDate && <p className="text-slate-500 text-xs">{reel.createdAt.toDate().toLocaleDateString("en-IN")}</p>}
                      </div>
                    </div>

                    {/* Engagement */}
                    <div className="flex gap-3 mt-2 text-xs text-slate-400">
                      <span>👁 {reel.views ?? 0}</span>
                      <span>❤️ {reel.likes ?? 0}</span>
                      <span>🔄 {reel.shares ?? 0}</span>
                      <span>💬 {reel.comments ?? 0}</span>
                    </div>

                    {reel.status === "rejected" && reel.rejectionReason && (
                      <p className="text-red-400 text-xs mt-1">Reason: {reel.rejectionReason}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {reel.mediaUrl && (
                      <a href={reel.mediaUrl} target="_blank" rel="noreferrer"
                        className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-2 rounded-lg text-center transition-colors">▶ Play</a>
                    )}
                    {reel.status !== "approved" && (
                      <button disabled={isProcessing} onClick={() => handleAction(reel.id, "approve")}
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                        {isProcessing ? "…" : "✓ Approve"}
                      </button>
                    )}
                    {reel.status !== "in_review" && reel.status !== "approved" && (
                      <button disabled={isProcessing} onClick={() => handleAction(reel.id, "in_review")}
                        className="bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                        {isProcessing ? "…" : "🔍 Review"}
                      </button>
                    )}
                    {reel.status !== "rejected" && (
                      <button disabled={isProcessing} onClick={() => setRejectingId(reel.id)}
                        className="bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                        ✕ Reject
                      </button>
                    )}
                    {reel.status === "approved" && (
                      <button disabled={isProcessing} onClick={() => handleAction(reel.id, "reject", "Removed by admin")}
                        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                        Unpublish
                      </button>
                    )}
                  </div>
                </div>

                {/* Rejection reason input */}
                {rejectingId === reel.id && (
                  <div className="px-4 pb-4 flex gap-2">
                    <input value={rejReason} onChange={(e) => setRejReason(e.target.value)} placeholder="Rejection reason (optional)"
                      className="flex-1 bg-slate-800 border border-red-500/40 text-white rounded-xl px-4 py-2 text-sm focus:outline-none" />
                    <button onClick={() => handleAction(reel.id, "reject", rejReason)}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl text-sm">Confirm</button>
                    <button onClick={() => setRejectingId(null)}
                      className="bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Leaderboard ───────────────────────────────────────────────────────
function Leaderboard({ battles }: { battles: Battle[] }) {
  const [entries,       setEntries]       = useState<BoardEntry[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [battleId,      setBattleId]      = useState("all");
  const [scope,         setScope]         = useState<Scope>("india");
  const [classFilter,   setClassFilter]   = useState("all");
  const [month,         setMonth]         = useState(currentMonth());

  const load = async () => {
    setLoading(true);
    try {
      const selectedBattle = battles.find((b) => b.id === battleId);
      const queryMonth = battleId !== "all" && selectedBattle ? selectedBattle.month : month;

      const constraints: any[] = [
        where("isSkillBattle", "==", true),
        where("status",        "==", "approved"),
        where("month",         "==", queryMonth),
      ];
      if (classFilter !== "all") constraints.push(where("class", "==", classFilter));
      if (battleId    !== "all") constraints.push(where("battleId", "==", battleId));

      if (scope === "state") {
        // Can't filter by scope without student location — show all for admin
      }

      const snap = await getDocs(query(collection(db, "posts"), ...constraints));
      const userMap = new Map<string, BoardEntry & { watchTime: number }>();
      snap.docs.forEach((d) => {
        const p = d.data();
        const uid = p.userId as string;
        if (!uid) return;
        const score = computeScore(p);
        const prev = userMap.get(uid);
        if (prev) {
          prev.score    += score;
          prev.likes    += p.likes    || 0;
          prev.views    += p.views    || 0;
          prev.shares   += p.shares   || 0;
          prev.comments += p.comments || 0;
          prev.watchTime+= p.watchTime|| 0;
        } else {
          userMap.set(uid, {
            userId: uid, name: p.name ?? "", profilePic: p.profilePic ?? "",
            school: p.school ?? "", class: p.class ?? "",
            location: p.location ?? { district: "", state: "", pincode: "" },
            score, likes: p.likes || 0, views: p.views || 0,
            shares: p.shares || 0, comments: p.comments || 0, watchTime: p.watchTime || 0,
          });
        }
      });
      const sorted = [...userMap.values()].sort((a, b) => b.score - a.score);
      setEntries(sorted);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [battleId, scope, classFilter, month]);

  const medal = (r: number) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`;
  const fmt   = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Battle</label>
          <select value={battleId} onChange={(e) => setBattleId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none">
            <option value="all">All battles</option>
            {battles.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
        {battleId === "all" && (
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
          </div>
        )}
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Class</label>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none">
            <option value="all">All Classes</option>
            {["6","7","8","9","10","11","12"].map((c) => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-2xl font-black text-white">{entries.length}</p>
          <p className="text-slate-400 text-xs mt-1">Participants</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-2xl font-black text-indigo-400">{entries[0]?.score.toLocaleString() ?? "—"}</p>
          <p className="text-slate-400 text-xs mt-1">Top score</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-2xl font-black text-amber-400">
            {entries.length > 0 ? Math.round(entries.reduce((a,b) => a + b.score, 0) / entries.length).toLocaleString() : "—"}
          </p>
          <p className="text-slate-400 text-xs mt-1">Avg score</p>
        </div>
      </div>

      <p className="text-slate-500 text-xs">Score = likes×5 + shares×8 + comments×3 + views×1 + watchTime×0.1 — same formula as mobile app</p>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="p-12 text-center text-slate-400">Loading…</div>
          : entries.length === 0 ? <div className="p-12 text-center text-slate-400">No approved reels found for these filters.</div>
          : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Rank</th>
                <th className="text-left p-4">Student</th>
                <th className="text-left p-4">School</th>
                <th className="text-right p-4">Score</th>
                <th className="text-right p-4">Likes</th>
                <th className="text-right p-4">Views</th>
                <th className="text-right p-4">Shares</th>
                <th className="text-left p-4">Location</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <motion.tr key={e.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i < 3 ? "bg-amber-500/5" : ""}`}>
                  <td className="p-4 text-xl">{medal(i + 1)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {e.profilePic
                        ? <img src={e.profilePic} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">{e.name?.[0] ?? "?"}</div>}
                      <div>
                        <p className="text-white font-semibold text-sm">{e.name || "—"}</p>
                        <p className="text-slate-500 text-xs">Class {e.class}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400 text-xs max-w-[140px] truncate">{e.school || "—"}</td>
                  <td className="p-4 text-right text-white font-bold">{e.score.toLocaleString()}</td>
                  <td className="p-4 text-right text-slate-300">{fmt(e.likes)}</td>
                  <td className="p-4 text-right text-slate-300">{fmt(e.views)}</td>
                  <td className="p-4 text-right text-slate-300">{fmt(e.shares)}</td>
                  <td className="p-4 text-xs text-slate-400">
                    {e.location?.district ? `${e.location.district}, ${e.location.state}` : "—"}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SkillBattles() {
  const [tab,       setTab]       = useState<Tab>("battles");
  const [battles,   setBattles]   = useState<Battle[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editBattle,setEditBattle]= useState<Battle | null>(null);

  const loadBattles = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "skillBattles"));
      const all  = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Battle));
      all.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setBattles(all);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadBattles(); }, []);

  const pendingReelCount = 0; // fetched lazily in approval tab

  const TABS: { key: Tab; label: string }[] = [
    { key: "battles",     label: "⚔️ Battles"      },
    { key: "create",      label: editBattle ? "✏️ Edit" : "➕ Create" },
    { key: "approval",    label: "🎬 Reel Approval" },
    { key: "leaderboard", label: "🏆 Leaderboard"   },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-black text-white">⚔️ Skill Battles</h1>
        <p className="text-slate-400 text-sm mt-1">Create battles, approve reels, and view live rankings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-bold transition-colors relative ${tab === t.key ? "text-white" : "text-slate-400 hover:text-slate-200"}`}>
            {t.label}
            {tab === t.key && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {tab === "battles" && (
        <BattleList battles={battles} loading={loading} onRefresh={loadBattles}
          onEdit={(b) => { setEditBattle(b); setTab("create"); }} />
      )}
      {tab === "create" && (
        <CreateBattle editBattle={editBattle} onSaved={() => { loadBattles(); setEditBattle(null); }}
          onCancel={() => { setEditBattle(null); setTab("battles"); }} />
      )}
      {tab === "approval" && <ReelApproval battles={battles} />}
      {tab === "leaderboard" && <Leaderboard battles={battles} />}
    </div>
  );
}