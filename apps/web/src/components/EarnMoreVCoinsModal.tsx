"use client";

// PATH: apps/web/src/components/EarnMoreVCoinsModal.tsx
// Mirrors mobile components/EarnMoreVCoinsModal.tsx. Shown from
// (app)/vidyastar/page.tsx when joinContest() reports insufficient_balance.
// Each option routes to a screen that actually credits V-Coins for that
// action — see services/vCoinsService.ts's creditVCoins callers.

import { useRouter } from "next/navigation";

interface Props {
  visible: boolean;
  onClose: () => void;
  required: number;
  balance: number;
  contestTitle?: string;
}

const EARN_OPTIONS = [
  { key: "reels",       emoji: "▶️", label: "Watch Reels",        sub: "+1 V-Coin per reel",       gradient: "linear-gradient(135deg, #7c2d12, #ea580c)", route: "/reels" },
  { key: "quiz",        emoji: "❓", label: "Daily Streak Quiz",   sub: "Answer today's question",  gradient: "linear-gradient(135deg, #7c3aed, #a855f7)", route: "/daily-streak-quiz" },
  { key: "video",       emoji: "🎥", label: "Watch Videos",        sub: "+3 V-Coins per video",      gradient: "linear-gradient(135deg, #1e40af, #3b82f6)", route: "/reels" },
  { key: "skillbattle", emoji: "⚡", label: "Skill Battle",        sub: "Win up to 50 V-Coins",      gradient: "linear-gradient(135deg, #065f46, #059669)", route: "/battle" },
];

export default function EarnMoreVCoinsModal({ visible, onClose, required, balance, contestTitle }: Props) {
  const router = useRouter();
  if (!visible) return null;
  const shortfall = Math.max(0, required - balance);

  const goEarn = (route: string) => {
    onClose();
    router.push(route);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)", borderTopLeftRadius: 28, borderTopRightRadius: 28,
          width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", paddingBottom: 24,
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(148,163,184,0.4)", margin: "10px auto 4px" }} />

        <div style={{
          margin: 16, borderRadius: 20, padding: 20, textAlign: "center",
          background: "linear-gradient(135deg, #92400e, #d97706, #f59e0b)",
        }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🪙</div>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>Not enough V-Coins</div>
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 600, marginTop: 6, lineHeight: "17px" }}>
            {contestTitle
              ? `"${contestTitle}" needs ${required} V-Coins — you have ${balance}.`
              : `This contest needs ${required} V-Coins — you have ${balance}.`}
          </div>
          <div style={{
            display: "inline-block", marginTop: 12, background: "rgba(255,255,255,0.22)",
            borderRadius: 20, padding: "6px 14px", border: "1px solid rgba(255,255,255,0.4)",
          }}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>Earn {shortfall} more to join</span>
          </div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 800, marginLeft: 20, marginBottom: 10, color: "var(--text)" }}>
          Ways to earn V-Coins
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "0 16px", justifyContent: "space-between" }}>
          {EARN_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => goEarn(opt.route)}
              style={{
                width: "47%", minWidth: 140, minHeight: 100, borderRadius: 16, border: "none", cursor: "pointer",
                padding: 14, textAlign: "left", background: opt.gradient,
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: 24 }}>{opt.emoji}</span>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, marginTop: 4 }}>{opt.label}</span>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 600 }}>{opt.sub}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 18, marginLeft: 20, marginRight: 20, width: "calc(100% - 40px)",
            padding: "12px 0", borderRadius: 14, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
