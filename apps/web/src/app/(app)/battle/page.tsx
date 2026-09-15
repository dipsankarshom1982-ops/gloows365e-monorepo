"use client";

// PATH: apps/web/src/app/(app)/battle/page.tsx
// Exact mirror of mobile app/(drawer)/(tabs)/skillbattle.tsx
// Features: All/Live/Upcoming/Completed tab bar, battle cards with status badges,
// prize pool, participant count, VCoin rewards, time left, rank cards, upload CTA

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useStudentProfile } from "@gloows/shared-logic";
import BannerCarousel from "@/components/BannerCarousel";

// ─── Types (mirrors mobile) ────────────────────────────────────
type BattleTab = "all" | "live" | "upcoming" | "completed";

interface Battle {
  id:               string;
  title:            string;
  description:      string;
  type:             string;
  sponsor?:         string;
  sponsorLogo?:     string;
  month?:           string;
  startDate?:       string;
  endDate?:         string;
  isActive:         boolean;
  eligibleClasses:  unknown;
  totalPool?:       string;
  bannerImage?:     string;
  participantCount?: number;
  vcoin_india?:     number;
  vcoin_state?:     number;
  vcoin_district?:  number;
  vcoin_local?:     number;
}

type BattleStatus = "live" | "upcoming" | "completed";

// ─── Helpers (exact mirrors) ──────────────────────────────────
function getBattleStatus(battle: Battle): BattleStatus {
  const now   = Date.now();
  const start = battle.startDate ? new Date(battle.startDate).getTime() : 0;
  const end   = battle.endDate   ? new Date(battle.endDate).getTime()   : Infinity;
  if (now < start) return "upcoming";
  if (now > end)   return "completed";
  return "live";
}

function getTimeLeft(endDate?: string): string {
  if (!endDate) return "Ongoing";
  const diff = new Date(endDate).getTime() - Date.now();
  if (isNaN(diff) || diff <= 0) return "Ended";
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

const normalizeEligibleClasses = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return (raw as (string | number)[]).map(String);
  if (typeof raw === "number") return [String(raw)];
  if (typeof raw === "string" && raw.includes(",")) return raw.split(",").map((s) => s.trim());
  return [String(raw)];
};

const getMedalEmoji = (r: number) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "";

// ─── Tab config ────────────────────────────────────────────────
const TABS: { key: BattleTab; label: string; icon: string }[] = [
  { key: "all",       label: "All",       icon: "⊞" },
  { key: "live",      label: "Live",      icon: "⏺" },
  { key: "upcoming",  label: "Upcoming",  icon: "⏰" },
  { key: "completed", label: "Completed", icon: "✓"  },
];

// ─── Battle Card ───────────────────────────────────────────────
function BattleCard({ battle, studentClass }: { battle: Battle; studentClass: string }) {
  const router = useRouter();
  const status = getBattleStatus(battle);
  const eligibleClasses = normalizeEligibleClasses(battle.eligibleClasses);
  const eligible = eligibleClasses.length === 0 || eligibleClasses.includes(studentClass);
  const isLive      = status === "live";
  const isUpcoming  = status === "upcoming";
  const isCompleted = status === "completed";
  const timeLeft    = getTimeLeft(battle.endDate);

  const accent = "#ff9f43";

  // Status badge
  const statusConfig = {
    live:      { bg: "rgba(239,68,68,0.15)",    border: "rgba(239,68,68,0.3)",    color: "#ef4444", label: "🔴 LIVE" },
    upcoming:  { bg: "rgba(245,158,11,0.12)",   border: "rgba(245,158,11,0.3)",   color: "#f59e0b", label: "⏰ UPCOMING" },
    completed: { bg: "rgba(107,114,128,0.15)",  border: "rgba(107,114,128,0.25)", color: "#9ca3af", label: "✓ ENDED" },
  }[status];

  return (
    <div style={{
      background: "#1a1a2e", borderRadius: 20, overflow: "hidden",
      border: `1.5px solid ${isLive ? "rgba(255,159,67,0.4)" : "rgba(255,255,255,0.06)"}`,
      boxShadow: isLive ? "0 4px 20px rgba(255,159,67,0.15)" : "0 2px 8px rgba(0,0,0,0.2)",
    }}>

      {/* Banner / header */}
      <div style={{
        height: battle.bannerImage ? 150 : 80,
        background: battle.bannerImage
          ? `url(${battle.bannerImage}) center/cover`
          : `linear-gradient(135deg, #1a1a2e, #2d2d4e)`,
        position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14,
      }}>
        {battle.bannerImage && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)" }} />
        )}

        {/* Type badge */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          background: "rgba(255,159,67,0.25)", border: "1px solid rgba(255,159,67,0.5)",
          borderRadius: 20, padding: "3px 10px",
          zIndex: 1,
        }}>
          <span style={{ color: "#ff9f43", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
            {battle.type || "Sponsored"}
          </span>
        </div>

        {/* Status badge */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: statusConfig.bg, border: `1px solid ${statusConfig.border}`,
          borderRadius: 8, padding: "3px 9px", zIndex: 1,
        }}>
          <span style={{ color: statusConfig.color, fontSize: 10, fontWeight: 800 }}>
            {statusConfig.label}
          </span>
        </div>

        {/* Time left badge (live only) */}
        {isLive && (
          <div style={{
            position: "absolute", top: 42, right: 12,
            background: "rgba(255,209,102,0.2)", borderRadius: 20,
            padding: "3px 8px", display: "flex", alignItems: "center", gap: 4, zIndex: 1,
          }}>
            <span style={{ color: "#ffd166", fontSize: 11, fontWeight: 700 }}>⏱ {timeLeft}</span>
          </div>
        )}

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 900, lineHeight: 1.35 }}>{battle.title}</div>
          {battle.sponsor && (
            <div style={{ color: "rgba(255,159,67,0.85)", fontSize: 10, fontWeight: 700, marginTop: 3 }}>
              by {battle.sponsor}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.5 }}>
          {battle.description}
        </div>

        {/* Stats chips */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {battle.participantCount != null && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
            }}>
              👥 {battle.participantCount} joined
            </div>
          )}
          {battle.month && (
            <div style={{
              padding: "5px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
            }}>
              📅 {battle.month}
            </div>
          )}
        </div>

        {/* Prize pool */}
        {battle.totalPool && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,159,67,0.08)", border: "1px solid rgba(255,159,67,0.2)",
            borderRadius: 14, padding: 12,
          }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,159,67,0.7)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Prize Pool
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#ff9f43" }}>{battle.totalPool}</div>
            </div>
            {/* VCoin rewards */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              {battle.vcoin_india    && <span style={{ fontSize: 9, fontWeight: 700, color: "#63b3ed" }}>🇮🇳 {battle.vcoin_india} V</span>}
              {battle.vcoin_state    && <span style={{ fontSize: 9, fontWeight: 700, color: "#63b3ed" }}>🗺️ {battle.vcoin_state} V</span>}
              {battle.vcoin_district && <span style={{ fontSize: 9, fontWeight: 700, color: "#63b3ed" }}>📍 {battle.vcoin_district} V</span>}
            </div>
          </div>
        )}

        {/* Upcoming banner */}
        {isUpcoming && battle.startDate && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 10, padding: 10,
          }}>
            <span style={{ color: "#f59e0b", fontSize: 14 }}>⏰</span>
            <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700 }}>
              Starts {new Date(battle.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        )}

        {/* Not eligible */}
        {studentClass && !eligible && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,107,157,0.1)", border: "1px solid rgba(255,107,157,0.3)",
            borderRadius: 10, padding: 9,
          }}>
            <span style={{ color: "#ff6b9d", fontSize: 13 }}>🔒</span>
            <span style={{ color: "#ff6b9d", fontSize: 11, fontWeight: 700 }}>
              Class {studentClass} not eligible · Requires Class 6–12
            </span>
          </div>
        )}

        {/* CTA */}
        <button
          disabled={!isLive || !eligible}
          onClick={() => {
            if (!isLive || !eligible) return;
            const qs = new URLSearchParams({
              battleId: battle.id,
              battleTitle: battle.title ?? "",
              battleType: battle.type ?? "",
              month: battle.month ?? "",
            });
            router.push(`/create-reel?${qs.toString()}`);
          }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "13px 0", borderRadius: 14, border: "none", cursor: isLive && eligible ? "pointer" : "not-allowed",
            background: isLive && eligible ? accent : "rgba(255,255,255,0.08)",
            color: "#fff", fontSize: 14, fontWeight: 800,
            opacity: isLive && eligible ? 1 : 0.5,
            width: "100%",
          }}
        >
          <span>{isCompleted ? "🔒" : isUpcoming ? "⏰" : !eligible ? "🔒" : "🎬"}</span>
          {isCompleted
            ? "Battle Ended"
            : isUpcoming
            ? "Coming Soon"
            : !eligible
            ? "Not Eligible"
            : "🚀 Upload Reel"}
        </button>

        {/* View results for completed */}
        {isCompleted && (
          <button style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "11px 0", borderRadius: 14, border: "none", cursor: "pointer",
            background: "#374151", color: "#fff", fontSize: 13, fontWeight: 800,
            width: "100%", marginTop: 4,
          }}>
            🏆 View Final Results
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function SkillBattlePage() {
  const { studentProfile } = useStudentProfile();
  const [battles,    setBattles]    = useState<Battle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");
  const [activeTab,  setActiveTab]  = useState<BattleTab>("live");

  const studentClass = String(studentProfile?.class ?? "");

  const fetchBattles = useCallback(async () => {
    setError("");
    try {
      const db   = getFirestore();
      const snap = await getDocs(collection(db, "skillBattles"));
      // FIX (bug report — "skill battle logic bugs"): this listed every
      // skillBattles doc unconditionally, including ones admin has
      // isActive:false (draft/disabled) — mobile's equivalent
      // (skillbattle.tsx) already filters these out; web was showing
      // battles students shouldn't see yet.
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Battle))
        .filter((b) => b.isActive === true);
      setBattles(data);
    } catch (e) {
      setError("Failed to load battles. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBattles(); }, [fetchBattles]);

  // Tab counts
  const now          = Date.now();
  const liveBattles      = battles.filter((b) => getBattleStatus(b) === "live");
  const upcomingBattles  = battles.filter((b) => getBattleStatus(b) === "upcoming");
  const completedBattles = battles.filter((b) => getBattleStatus(b) === "completed");

  const filteredBattles =
    activeTab === "all"       ? battles.filter((b) => getBattleStatus(b) !== "completed")
    : activeTab === "live"      ? liveBattles
    : activeTab === "upcoming"  ? upcomingBattles
    : completedBattles;

  const tabCount = (k: BattleTab) =>
    k === "all" ? battles.filter((b) => getBattleStatus(b) !== "completed").length
    : k === "live" ? liveBattles.length
    : k === "upcoming" ? upcomingBattles.length
    : completedBattles.length;

  const accent = "#ff9f43";

  return (
    <div>
      {/* ── Admin banners (Banners.tsx) ── */}
      <BannerCarousel screen="skillbattle" />

      {/* ── Student notice ── */}
      {studentProfile?.name && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          margin: "10px 16px 0",
          padding: "7px 12px", borderRadius: 10,
          background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)",
        }}>
          <span style={{ fontSize: 14 }}>👤</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
            {studentProfile.name} · Class {studentProfile.class} · {(studentProfile as any)?.location?.district ?? ""}
          </span>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 14px",
        overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {TABS.map((tab) => {
          const count    = tabCount(tab.key);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 12px", borderRadius: 20, border: `1px solid ${isActive ? accent : "rgba(255,159,67,0.2)"}`,
                background: isActive ? accent : "rgba(255,255,255,0.03)",
                color: isActive ? "#fff" : "var(--text-muted)",
                fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {count > 0 && (
                <span style={{
                  background: isActive ? "rgba(255,255,255,0.25)" : "rgba(255,159,67,0.2)",
                  color: isActive ? "#fff" : accent,
                  borderRadius: 10, padding: "0 5px", fontSize: 9, fontWeight: 800,
                }}>
                  {count}
                </span>
              )}
              {tab.key === "live" && count > 0 && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block", marginLeft: 2 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          margin: "8px 16px", padding: "8px 12px", borderRadius: 10,
          background: "rgba(255,107,157,0.1)", border: "1px solid rgba(255,107,157,0.3)",
        }}>
          <span style={{ color: "#ff6b9d", fontSize: 13 }}>⚠</span>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#ff6b9d" }}>{error}</span>
          <button onClick={fetchBattles} style={{ color: "var(--accent)", fontSize: 11, fontWeight: 800, background: "none", border: "none", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 12 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading battles…</span>
        </div>
      ) : filteredBattles.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 12 }}>
          <span style={{ fontSize: 44 }}>
            {activeTab === "live" ? "🎯" : activeTab === "upcoming" ? "⏰" : activeTab === "completed" ? "🏆" : "🎯"}
          </span>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
            {activeTab === "live" ? "No live battles" : activeTab === "upcoming" ? "No upcoming battles" : activeTab === "completed" ? "No completed battles" : "No battles"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Check back soon</div>
          <button
            onClick={fetchBattles}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            🔄 Refresh
          </button>
        </div>
      ) : (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40 }}>
          {filteredBattles.map((battle) => (
            <BattleCard key={battle.id} battle={battle} studentClass={studentClass} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}