"use client";

// PATH: apps/web/src/app/(app)/my-prizes/page.tsx
// Mirrors mobile app/my-prizes.tsx — see that file's header comment for the
// full prizeClaims data model. Each doc is created by the admin's Starboard
// Payouts screen when a prize is awarded; gift_voucher/physical prizes need
// the student to submit delivery details here before admin can ship them
// (see admin's PrizeDeliveries.tsx).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";

// ─── Currently-winning preview — same rank→prize matching admin's
// Starboard Payouts screen uses (prizeRowForRank in
// apps/admin/src/pages/StarboardPayouts.tsx) and the Starboard page itself.
// Only monthly/yearly periods carry real prizes (see Starboard's
// isPrizeTab) — this is a live, provisional preview of what a student
// would win if the period ended right now; the actual prizeClaims doc
// below only appears once admin runs the payout at period end.
type PeriodTab = "monthly" | "yearly";
const PRIZE_TABS: PeriodTab[] = ["monthly", "yearly"];
type PrizeType = "gift_voucher" | "physical" | "vcoin";
interface PrizeRow { rankMin: number; rankMax: number; prizeType: PrizeType; prizeValue: string; medalEmoji: string; badge: string; }

const pad = (n: number) => String(n).padStart(2, "0");
function currentPeriodKey(type: PeriodTab): string {
  const d = new Date();
  if (type === "monthly") return `monthly_${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return `yearly_${d.getFullYear()}`;
}
function prizeRowForRank(rows: PrizeRow[], rank: number): PrizeRow | null {
  return rows.find((r) => rank >= r.rankMin && rank <= r.rankMax) ?? null;
}
function formatPrizeReward(row: PrizeRow): string {
  return row.prizeType === "vcoin" ? `${row.prizeValue} V-Coins` : row.prizeValue;
}

interface CurrentStanding { tab: PeriodTab; rank: number; prizeRow: PrizeRow; }

// One-shot (not live-ticking) — this is a supplementary preview, not the
// primary Starboard ranking view, so a snapshot on page load is enough.
function useCurrentStandings(uid: string, userClass: string | null): CurrentStanding[] | null {
  const [standings, setStandings] = useState<CurrentStanding[] | null>(null);
  useEffect(() => {
    if (!uid) { setStandings([]); return; }
    let cancelled = false;
    (async () => {
      const db = getFirestore();
      const results: CurrentStanding[] = [];
      for (const tab of PRIZE_TABS) {
        try {
          const col = collection(db, "leaderboard", tab, "entries");
          const q = userClass
            ? query(col, where("class", "==", userClass), orderBy("points", "desc"), limit(100))
            : query(col, orderBy("points", "desc"), limit(100));
          const [entriesSnap, configSnap] = await Promise.all([
            getDocs(q),
            getDoc(doc(db, "vidyastarConfig", currentPeriodKey(tab))),
          ]);
          const rank = entriesSnap.docs.findIndex((d) => d.id === uid) + 1;
          if (rank <= 0) continue;
          const rows = (configSnap.exists() ? (configSnap.data().prizeRows ?? []) : []) as PrizeRow[];
          const prizeRow = prizeRowForRank(rows, rank);
          if (prizeRow) results.push({ tab, rank, prizeRow });
        } catch { /* skip this tab on error, don't block the others */ }
      }
      if (!cancelled) setStandings(results);
    })();
    return () => { cancelled = true; };
  }, [uid, userClass]);
  return standings;
}

type PrizeStatus = "auto_credited" | "unclaimed" | "claimed" | "shipped" | "delivered";

interface ClaimInfo { name: string; address: string; whatsapp: string; email: string; }
interface DeliveryInfo { courierName?: string; trackingId?: string; }

interface PrizeClaim {
  id: string;
  uid: string;
  prizeType: "gift_voucher" | "physical" | "vcoin";
  prizeValue: string;
  medalEmoji?: string;
  rank: number;
  periodType: string;
  periodKey: string;
  wonAt?: { toDate?: () => Date };
  status: PrizeStatus;
  claimInfo?: ClaimInfo;
  deliveryInfo?: DeliveryInfo;
}

const STATUS_CFG: Record<PrizeStatus, { label: string; color: string; bg: string }> = {
  auto_credited: { label: "Credited to V-Coins", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  unclaimed:     { label: "Claim Now",            color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  claimed:       { label: "Pending Delivery",      color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  shipped:       { label: "Shipped",               color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
  delivered:     { label: "Delivered",             color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

function formatDate(ts?: { toDate?: () => Date }): string {
  return ts?.toDate ? ts.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default function MyPrizesPage() {
  const router = useRouter();
  const { studentProfile } = useStudentProfile();
  const uid = getAuth().currentUser?.uid ?? "";
  const userClass = studentProfile?.class != null ? String(studentProfile.class) : null;
  const standings = useCurrentStandings(uid, userClass);

  const [prizes, setPrizes]   = useState<PrizeClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const [claiming, setClaiming] = useState<PrizeClaim | null>(null);
  const [name, setName]         = useState("");
  const [address, setAddress]   = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail]       = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const db = getFirestore();
    const q = query(collection(db, "prizeClaims"), where("uid", "==", uid), orderBy("wonAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPrizes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrizeClaim)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  const openClaim = (prize: PrizeClaim) => {
    setClaiming(prize);
    setError("");
    setName(studentProfile?.name ?? "");
    setAddress("");
    setWhatsapp(studentProfile?.phone ?? "");
    setEmail(studentProfile?.email ?? getAuth().currentUser?.email ?? "");
  };

  const submitClaim = async () => {
    if (!claiming) return;
    if (!name.trim() || !address.trim() || !whatsapp.trim() || !email.trim()) {
      setError("Please fill in your name, address, WhatsApp number, and email.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(whatsapp.trim())) {
      setError("Enter a valid 10-digit WhatsApp number.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const db = getFirestore();
      await updateDoc(doc(db, "prizeClaims", claiming.id), {
        status: "claimed",
        claimInfo: {
          name: name.trim(),
          address: address.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim().toLowerCase(),
          claimedAt: serverTimestamp(),
        },
      });
      setClaiming(null);
    } catch (e: any) {
      setError(e.message ?? "Couldn't submit your claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1px solid var(--border)", borderRadius: 12,
    padding: "12px 14px", fontSize: 14, color: "var(--text)", background: "var(--bg-card)",
    marginBottom: 4,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginTop: 12, marginBottom: 6, display: "block" };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 40 }}>
      <div style={{ padding: "24px 20px 8px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b", marginBottom: 4 }}>🏆 My Prizes</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Prizes you've won on the VidyaStar Starboard</p>
      </div>

      {standings && standings.length > 0 && (
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8 }}>🔮 Currently Winning</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {standings.map((s) => (
              <div key={s.tab} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: 12, padding: "10px 12px",
              }}>
                <span style={{ fontSize: 22 }}>{s.prizeRow.medalEmoji || "🎁"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
                    {s.prizeRow.prizeType === "vcoin" ? `🪙 ${formatPrizeReward(s.prizeRow)}` : formatPrizeReward(s.prizeRow)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Rank #{s.rank} · {s.tab.charAt(0).toUpperCase() + s.tab.slice(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
            * Based on your current rank — confirmed once the period ends and admin pays out.
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>
      ) : prizes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 30px" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🎁</div>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No prizes yet — climb the Starboard leaderboard to start winning!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 20px" }}>
          {prizes.map((p) => {
            const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.unclaimed;
            return (
              <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 14, background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 30 }}>{p.medalEmoji ?? "🎁"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                      {p.prizeType === "vcoin" ? `🪙 ${p.prizeValue} V-Coins` : p.prizeValue}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Rank #{p.rank} · {p.periodType.charAt(0).toUpperCase() + p.periodType.slice(1)} · {formatDate(p.wonAt)}
                    </div>
                  </div>
                </div>

                <div style={{ alignSelf: "flex-start", borderRadius: 8, padding: "5px 10px", background: cfg.bg }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{cfg.label}</span>
                </div>

                {p.status === "unclaimed" && (
                  <button
                    onClick={() => openClaim(p)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, padding: "11px 0", background: "#6366f1", border: "none", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
                  >
                    🎁 Claim Prize
                  </button>
                )}

                {(p.status === "claimed" || p.status === "shipped" || p.status === "delivered") && p.claimInfo && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    <div>📍 Delivering to: {p.claimInfo.name}, {p.claimInfo.address}</div>
                    <div>📱 {p.claimInfo.whatsapp} · ✉️ {p.claimInfo.email}</div>
                  </div>
                )}

                {(p.status === "shipped" || p.status === "delivered") && p.deliveryInfo?.trackingId && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    🚚 {p.deliveryInfo.courierName ?? "Courier"} — {p.deliveryInfo.trackingId}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: "24px 20px 0" }}>
        <button
          onClick={() => router.back()}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "#6366f1", border: "none", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          ← Back
        </button>
      </div>

      {/* Claim form */}
      {claiming && (
        <div
          onClick={() => !submitting && setClaiming(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", background: "var(--bg)", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}
          >
            <h2 style={{ fontSize: 19, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Claim your prize</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
              {claiming.prizeType === "physical" ? "We'll ship this to your address." : "We'll email/deliver your voucher using these details."}
            </p>

            <label style={labelStyle}>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" style={inputStyle} />

            <label style={labelStyle}>Delivery Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House no., street, city, state, pincode" rows={3} style={{ ...inputStyle, resize: "vertical" }} />

            <label style={labelStyle}>WhatsApp Number</label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" style={inputStyle} />

            <label style={labelStyle}>Email ID</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />

            {error && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{error}</p>}

            <button
              onClick={submitClaim}
              disabled={submitting}
              style={{ width: "100%", marginTop: 20, padding: "15px 0", borderRadius: 14, background: "#6366f1", border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Submitting…" : "Submit Claim"}
            </button>
            <button
              onClick={() => setClaiming(null)}
              disabled={submitting}
              style={{ width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
