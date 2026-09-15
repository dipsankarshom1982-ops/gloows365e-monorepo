import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import DrawerForm from "../components/DrawerForm";
import StatusBadge from "../components/StatusBadge";
import { db } from "../lib/firebase";

// Fulfillment side of VidyaStar Starboard prizes AND V-Coins Surprise
// Gifts — both create one prizeClaims/{id} doc per prize (Starboard
// prizes in StarboardPayouts.tsx; surprise gifts in
// VCoinLeaderboard.tsx's assign-gift flow, periodType "surprise_gift").
// This page is where admin ships gift_voucher/physical prizes once a
// student has submitted their delivery details from the mobile app's "My
// Prizes" screen (app/my-prizes.tsx).

type PrizeStatus = "auto_credited" | "unclaimed" | "claimed" | "shipped" | "delivered";
type PrizeType = "gift_voucher" | "physical" | "vcoin";

interface ClaimInfo { name: string; address: string; whatsapp: string; email: string; }
interface DeliveryInfo { courierName?: string; trackingId?: string; }

interface PrizeClaim {
  id: string;
  uid: string;
  name?: string;
  prizeType: PrizeType;
  prizeValue: string;
  medalEmoji?: string;
  rank: number;
  periodType: string;
  periodKey: string;
  payoutLabel: string;
  wonAt?: { toDate?: () => Date };
  status: PrizeStatus;
  claimInfo?: ClaimInfo;
  deliveryInfo?: DeliveryInfo;
  // "YYYY-MM-DD" — admin-set, shown to the student once they've claimed
  // ("your prize will reach you by …"), independent of actual shipping
  // (can be set before a courier/tracking ID even exists).
  expectedDeliveryDate?: string;
}

function prizeLabel(c: PrizeClaim): string {
  return c.periodType === "surprise_gift"
    ? `🎁 Surprise Gift · ${c.periodKey.replace("surprise_gift_", "")}`
    : `Rank #${c.rank} · ${c.periodKey}`;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "pending",   label: "🕓 Pending Fulfillment (claimed)" },
  { value: "unclaimed", label: "⏳ Not Yet Claimed" },
  { value: "shipped",   label: "🚚 Shipped" },
  { value: "delivered", label: "✅ Delivered" },
  { value: "all",       label: "All (incl. V-Coins)" },
];

function formatDate(ts?: { toDate?: () => Date }): string {
  return ts?.toDate ? ts.toDate().toLocaleDateString("en-IN") : "—";
}

function statusVariant(status: PrizeStatus): "success" | "warning" | "default" | "info" {
  if (status === "delivered" || status === "auto_credited") return "success";
  if (status === "shipped") return "info";
  if (status === "claimed") return "warning";
  return "default";
}

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function PrizeDeliveries() {
  const [claims, setClaims]   = useState<PrizeClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<PrizeClaim | null>(null);
  const [courierName, setCourierName] = useState("");
  const [trackingId, setTrackingId]   = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [saving, setSaving]           = useState(false);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "prizeClaims"), orderBy("wonAt", "desc")));
    setClaims(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrizeClaim)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = claims.filter((c) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return c.status === "claimed";
    return c.status === statusFilter;
  }).filter((c) => statusFilter === "all" ? true : c.prizeType !== "vcoin");

  const openShip = (c: PrizeClaim) => {
    setEditing(c);
    setCourierName(c.deliveryInfo?.courierName ?? "");
    setTrackingId(c.deliveryInfo?.trackingId ?? "");
    setExpectedDate(c.expectedDeliveryDate ?? "");
    setDrawerOpen(true);
  };

  // One drawer covers both stages: on a still-"claimed" prize, saving with
  // courier+tracking blank just updates the expected delivery date (no
  // status change, so admin can promise a date before actually shipping);
  // filling in courier+tracking there also transitions it to "shipped",
  // same as calling this from an already-"shipped" row to correct details.
  const saveDelivery = async () => {
    if (!editing) return;
    const hasCourierInfo = !!(courierName.trim() && trackingId.trim());
    if (!hasCourierInfo && !expectedDate && editing.status === "shipped") {
      alert("Enter both courier name and tracking ID, or set an expected delivery date.");
      return;
    }
    setSaving(true);
    try {
      const update: Record<string, unknown> = {};
      if (expectedDate) update.expectedDeliveryDate = expectedDate;
      if (hasCourierInfo) {
        update.status = "shipped";
        update.deliveryInfo = {
          courierName: courierName.trim(),
          trackingId: trackingId.trim(),
          shippedAt: serverTimestamp(),
        };
      }
      if (Object.keys(update).length === 0) {
        alert("Nothing to save — enter an expected date or courier + tracking details.");
        setSaving(false);
        return;
      }
      await updateDoc(doc(db, "prizeClaims", editing.id), update);
      setDrawerOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const markDelivered = async (c: PrizeClaim) => {
    if (!confirm(`Mark this prize as delivered to ${c.claimInfo?.name ?? c.name ?? c.uid}?`)) return;
    await updateDoc(doc(db, "prizeClaims", c.id), {
      status: "delivered",
      "deliveryInfo.deliveredAt": serverTimestamp(),
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">📦 Prize Deliveries</h1>
        <p className="text-slate-400 text-sm mt-1">
          Fulfillment for VidyaStar Starboard prizes (award in Starboard Payouts) and V-Coins Surprise
          Gifts (assign in V-Coins Leaderboard) — both land here once a student claims.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-slate-400 text-xs font-semibold mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          >
            {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <button onClick={load} className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-2.5 transition-colors">↻ Refresh</button>
        <span className="text-slate-500 text-xs">{filtered.length} shown</span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Nothing here.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="text-left p-4">Student</th>
                  <th className="text-left p-4">Prize</th>
                  <th className="text-left p-4">Won</th>
                  <th className="text-left p-4">Delivery Details</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <p className="text-white font-medium">{c.name || c.claimInfo?.name || "—"}</p>
                      <p className="text-slate-500 text-xs font-mono">{c.uid.slice(0, 12)}…</p>
                    </td>
                    <td className="p-4">
                      <p className="text-white">{c.medalEmoji} {c.prizeValue}</p>
                      <p className="text-slate-500 text-xs">{prizeLabel(c)}</p>
                    </td>
                    <td className="p-4 text-slate-400 text-xs">{formatDate(c.wonAt)}</td>
                    <td className="p-4 text-slate-300 text-xs max-w-[220px]">
                      {c.claimInfo ? (
                        <>
                          <p>{c.claimInfo.address}</p>
                          <p className="text-slate-500 mt-1">📱 {c.claimInfo.whatsapp} · ✉️ {c.claimInfo.email}</p>
                          {c.expectedDeliveryDate && (
                            <p className="text-amber-400 mt-1">📅 Expected {c.expectedDeliveryDate}</p>
                          )}
                        </>
                      ) : <span className="text-slate-600">Not claimed yet</span>}
                    </td>
                    <td className="p-4"><StatusBadge label={c.status} variant={statusVariant(c.status)} /></td>
                    <td className="p-4 text-right">
                      {c.status === "claimed" && (
                        <button onClick={() => openShip(c)} className="text-indigo-400 hover:text-indigo-300 text-xs px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">
                          {c.expectedDeliveryDate ? "Update / Ship" : "Set Date / Ship"}
                        </button>
                      )}
                      {c.status === "shipped" && (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-slate-400 text-xs">{c.deliveryInfo?.courierName} — {c.deliveryInfo?.trackingId}</span>
                          <div className="flex gap-1">
                            <button onClick={() => openShip(c)} className="text-indigo-400 hover:text-indigo-300 text-xs px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">Edit</button>
                            <button onClick={() => markDelivered(c)} className="text-green-400 hover:text-green-300 text-xs px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">Mark Delivered</button>
                          </div>
                        </div>
                      )}
                      {c.status === "delivered" && <span className="text-green-400 text-xs">✓ {c.deliveryInfo?.courierName} — {c.deliveryInfo?.trackingId}</span>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DrawerForm open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Update Delivery"
        footer={
          <>
            <button onClick={saveDelivery} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        {editing && (
          <>
            <div className="bg-slate-800 rounded-xl p-3 text-sm text-slate-300">
              <p className="font-bold text-white">{editing.medalEmoji} {editing.prizeValue}</p>
              <p className="text-xs mt-1">To: {editing.claimInfo?.name} — {editing.claimInfo?.address}</p>
              <p className="text-xs">📱 {editing.claimInfo?.whatsapp} · ✉️ {editing.claimInfo?.email}</p>
            </div>
            <div>
              <label className={labelCls}>Expected Delivery Date</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
              <p className="text-slate-500 text-xs mt-1">Shown to the student right away — doesn't require shipping details yet.</p>
            </div>
            <div><label className={labelCls}>Courier Name {editing.status === "shipped" ? "" : "(fill in once you actually ship)"}</label><input value={courierName} onChange={(e) => setCourierName(e.target.value)} className={inputCls} placeholder="e.g. Delhivery, Blue Dart, India Post" /></div>
            <div><label className={labelCls}>Tracking ID</label><input value={trackingId} onChange={(e) => setTrackingId(e.target.value)} className={inputCls} placeholder="e.g. DL123456789IN" /></div>
          </>
        )}
      </DrawerForm>
    </div>
  );
}
