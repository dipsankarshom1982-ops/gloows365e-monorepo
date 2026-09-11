"use client";

// PATH: apps/web/src/app/(app)/referral/page.tsx
// Mirrors mobile app/referral/index.tsx
// Shows referral code, stats, milestone progress, how-it-works, history, share CTA

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  getFirestore, doc, onSnapshot,
  collection, query, orderBy, limit, getDoc, where,
} from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";

// ─── Types ────────────────────────────────────────────────────
// Matches the top-level `referrals` collection written by the
// `applyReferral` cloud function (see mobile services/referralService.ts) —
// NOT a users/{uid}/referrals subcollection, which nothing ever writes to.
interface ReferralDoc {
  id:        string;
  referrerId: string;
  refereeId: string;
  status:    "pending" | "completed" | "expired";
  createdAt: { toDate?: () => Date } | null;
}

interface ReferralConfig {
  referrerCoins: number;
  refereeCoins:  number;
  giftEnabled:   boolean;
  giftLabel:     string;
  milestones:    { every: number; giftLabel: string }[];
}

const DEFAULT_CONFIG: ReferralConfig = {
  referrerCoins: 50,
  refereeCoins:  20,
  giftEnabled:   false,
  giftLabel:     "",
  milestones:    [],
};

// ─── Hook ────────────────────────────────────────────────────
function useReferral() {
  const { user } = useStudentProfile();
  const uid = user?.uid ?? "";

  const [referralCode,        setReferralCode]        = useState("—");
  const [referralCount,       setReferralCount]       = useState(0);
  const [referralCoinsEarned, setReferralCoinsEarned] = useState(0);
  const [referrals,           setReferrals]           = useState<ReferralDoc[]>([]);
  const [config,              setConfig]              = useState<ReferralConfig>(DEFAULT_CONFIG);
  const [loading,             setLoading]             = useState(true);

  useEffect(() => {
    if (!uid) return;
    const db = getFirestore();

    // User profile → referral code + stats
    const unsubUser = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setReferralCode(d.referralCode ?? uid.slice(0, 6).toUpperCase());
        setReferralCount(d.referralCount ?? 0);
        setReferralCoinsEarned(d.referralCoinsEarned ?? 0);
      }
      setLoading(false);
    });

    // Referral history — top-level `referrals` collection, scoped to this
    // user as referrer. (Previously read users/{uid}/referrals, a
    // subcollection nothing ever writes to — this list was always empty.)
    const q = query(
      collection(db, "referrals"),
      where("referrerId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubRefs = onSnapshot(q, (snap) => {
      setReferrals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralDoc)));
    }, () => {});

    // Config — same appConfig/referralConfig doc admin's Referrals.tsx and
    // mobile's referralService.ts read/write. (Previously read
    // referralConfig/config, a different/always-empty doc — admin-set
    // coin amounts and milestones never reached this page.)
    getDoc(doc(db, "appConfig", "referralConfig")).then((snap) => {
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as ReferralConfig);
    }).catch(() => {});

    return () => { unsubUser(); unsubRefs(); };
  }, [uid]);

  // Next milestone — first configured tier not yet reached. progressCount is
  // the plain completedCount (matching "{progressCount}/{every}" rendering
  // below); it used to be computed modulo milestones[0].every regardless of
  // which tier was actually found, which produced a wrong "X more to unlock"
  // once a user passed the first configured milestone.
  const completedCount   = referrals.filter((r) => r.status === "completed").length;
  const upcomingMilestone = config.milestones.find((m) => completedCount < m.every);
  const nextMilestone = upcomingMilestone
    ? { ...upcomingMilestone, progressCount: completedCount }
    : null;

  return { referralCode, referralCount, referralCoinsEarned, referrals, config, nextMilestone, loading };
}

// ─── Main ─────────────────────────────────────────────────────
export default function ReferralPage() {
  const { referralCode, referralCount, referralCoinsEarned, referrals, config, nextMilestone, loading } = useReferral();
  const [copied, setCopied] = useState(false);

  const completedReferrals = referrals.filter((r) => r.status === "completed");
  const progressPercent    = nextMilestone
    ? Math.min((nextMilestone.progressCount / nextMilestone.every) * 100, 100)
    : 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = `Join me on Gloows365E — India's smartest learning app! 🚀\n\nUse my referral code: ${referralCode}\n\nYou'll get ${config.refereeCoins} VCoins as a welcome bonus!\n\nDownload now: https://gloows365.in`;
    if (navigator.share) {
      await navigator.share({ title: "Join Gloows365E with my code", text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ paddingBottom: 100, background: "var(--bg)" }}>

      {/* ── Hero banner ── */}
      <div style={{
        margin: "12px 14px 16px",
        background: "linear-gradient(135deg, #3B0764, #6D28D9)",
        borderRadius: 20, padding: 24, textAlign: "center",
      }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🎁</div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          Invite friends, earn VCoins!
        </div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
          You get {config.referrerCoins} VCoins · Your friend gets {config.refereeCoins} VCoins
        </div>
        {config.giftEnabled && config.giftLabel && (
          <div style={{
            marginTop: 10, display: "inline-block",
            background: "rgba(255,255,255,0.15)", borderRadius: 20,
            padding: "6px 14px",
          }}>
            <span style={{ color: "#FDE68A", fontSize: 13 }}>🎀 Friend also gets: {config.giftLabel}</span>
          </div>
        )}
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "flex", gap: 10, margin: "0 14px 14px" }}>
        {[
          { num: referralCount,       label: "Total referred",  color: "#fff" },
          { num: referralCoinsEarned, label: "VCoins earned",   color: "#A78BFA" },
          { num: completedReferrals.length, label: "Completed", color: "#34D399" },
        ].map(({ num, label, color }) => (
          <div key={label} style={{
            flex: 1, background: "rgba(255,255,255,0.05)",
            borderRadius: 14, padding: 14, textAlign: "center",
          }}>
            <div style={{ color, fontSize: 24, fontWeight: 800 }}>{num}</div>
            <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Milestone progress ── */}
      {nextMilestone && (
        <div style={{
          margin: "0 14px 14px",
          background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
              🏆 Next reward: {nextMilestone.giftLabel}
            </span>
            <span style={{ color: "#A78BFA", fontSize: 13, fontWeight: 700 }}>
              {nextMilestone.progressCount}/{nextMilestone.every}
            </span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ width: `${progressPercent}%`, height: "100%", background: "#7C3AED", borderRadius: 6 }} />
          </div>
          <div style={{ color: "#64748b", fontSize: 11 }}>
            {nextMilestone.every - nextMilestone.progressCount} more referrals to unlock
          </div>
        </div>
      )}

      {/* ── Your code ── */}
      <div style={{ margin: "0 14px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16 }}>
        <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 10 }}>Your referral code</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#A78BFA", fontSize: 28, fontWeight: 900, letterSpacing: 3 }}>
            {referralCode}
          </span>
          <button onClick={handleCopy} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(124,58,237,0.2)", border: "none", borderRadius: 10,
            padding: "10px 14px", cursor: "pointer",
            color: copied ? "#34D399" : "#A78BFA", fontSize: 14, fontWeight: 600,
          }}>
            {copied ? "✓ Copied!" : "⎘ Copy"}
          </button>
        </div>
        <div style={{ color: "#64748b", fontSize: 11, marginTop: 10 }}>
          Share this code with friends. They enter it during signup.
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{ margin: "0 14px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16 }}>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>How it works</div>
        {[
          { icon: "📤", step: "1", text: "Share your code with a friend" },
          { icon: "👤", step: "2", text: "Friend signs up with your code" },
          { icon: "🎁", step: "3", text: `You get ${config.referrerCoins} VCoins — they get ${config.refereeCoins} VCoins` },
        ].map((item) => (
          <div key={item.step} style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "rgba(124,58,237,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>
              {item.icon}
            </div>
            <div style={{ justifyContent: "center", display: "flex", flexDirection: "column" }}>
              <div style={{ color: "#94a3b8", fontSize: 11 }}>Step {item.step}</div>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginTop: 1 }}>{item.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Referral history ── */}
      {referrals.length > 0 && (
        <div style={{ margin: "0 14px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16 }}>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            Referral history ({referrals.length})
          </div>
          {referrals.slice(0, 10).map((item) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              paddingBottom: 12, marginBottom: 12,
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 18,
                background: "rgba(124,58,237,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                👤
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                  Friend {item.refereeId.slice(0, 8)}…
                </div>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                  {item.createdAt?.toDate?.()
                    ? item.createdAt.toDate!().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </div>
              </div>
              <div style={{
                borderRadius: 20, padding: "3px 8px",
                background: item.status === "completed" ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)",
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: item.status === "completed" ? "#34D399" : "#FBBF24",
                }}>
                  {item.status === "completed" ? "✓ Joined" : "Pending"}
                </span>
              </div>
              {item.status === "completed" && (
                <span style={{ color: "#A78BFA", fontSize: 13, fontWeight: 700 }}>
                  +{config.referrerCoins} 🪙
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Sticky Share CTA ── */}
      <div style={{
        position: "fixed", bottom: 64, left: 0, right: 0,
        padding: 16, background: "rgba(7,4,18,0.95)",
        borderTop: "1px solid rgba(255,255,255,0.08)", zIndex: 50,
      }}>
        <button onClick={handleShare} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: "#7C3AED", border: "none", borderRadius: 16,
          padding: "16px 0", fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer",
        }}>
          📤 Share & Earn {config.referrerCoins} VCoins
        </button>
      </div>
    </div>
  );
}