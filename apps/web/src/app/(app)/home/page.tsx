"use client";

// PATH: apps/web/src/app/(app)/home/page.tsx
// Full mirror of mobile app/(drawer)/(tabs)/home.tsx
// Section order: Stories · AI Guru · Skill Battle Preview · VidyaStar Preview ·
// Home Ads Carousel · Discover Preview · Knowledge Hub · Referral Card

import { useEffect, useState, useMemo, useCallback, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  getFirestore, collection, getDocs, getDoc, query,
  where, limit, onSnapshot, doc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useFeatureFlags, useStudentProfile } from "@gloows/shared-logic";
import { useContests } from "@/hooks/useContests";
import { useUserContests } from "@/hooks/useUserContests";
import { useAppTranslation } from "@/context/LanguageContext";
import { AdminShortReelsSection, CreatorReelsSection, SkillBattleReelsSection } from "./_sections/ShortVideos";
import StoryComponent from "@/components/Story";
import { useAdFeed } from "@/hooks/useAdFeed";
import { useAdFrequency } from "@/hooks/useAdFrequency";
import FeedAdCard from "@/components/ads/FeedAdCard";
import ScholarshipAdCard from "@/components/ads/ScholarshipAdCard";
import { discountPct, fetchFeaturedProducts, type GloStoreProduct } from "@/lib/glostore";
import BannerCarousel from "@/components/BannerCarousel";
import { subscribeToStreakProgress } from "@/services/dailyStreakQuizService";
import { useCountdown, formatCountdown, formatCountdownDHM } from "@/hooks/useCountdown";
import { useContestBanner } from "@/hooks/useContestBanner";

// ─── Types ────────────────────────────────────────────────────
interface Battle {
  id: string; title: string; sponsor?: string;
  startDate?: string; endDate?: string; isActive?: unknown;
  totalPool?: string; participantCount?: number;
  vcoin_india?: number; vcoin_state?: number; vcoin_district?: number;
}

interface Contest {
  id: string; title: string; periodKey?: string;
  startTime?: any; endTime?: any; startDate?: any; endDate?: any;
  description?: string; order?: number; isFeatured?: boolean;
  targetClass?: string[] | string;
}

// Prizes live only in VidyaStar Config (vidyastarConfig/{periodKey}.prizeRows)
// — Create Contest's old free-text Prize field was removed since it
// duplicated this. The card teaser shows the top (lowest rankMin) tier.
type PrizeType = "gift_voucher" | "physical" | "vcoin";
interface PrizeRow { rankMin: number; rankMax: number; prizeType: PrizeType; prizeValue: string; medalEmoji: string; badge: string; }

function formatPrize(row: PrizeRow): string {
  return row.prizeType === "vcoin" ? `${row.prizeValue} V-Coins` : row.prizeValue;
}
function topPrize(rows: PrizeRow[] | undefined): PrizeRow | null {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => a.rankMin - b.rankMin)[0];
}

function usePrizesByPeriod() {
  const [prizesByPeriod, setPrizesByPeriod] = useState<Record<string, PrizeRow[]>>({});
  useEffect(() => {
    getDocs(collection(getFirestore(), "vidyastarConfig")).then((snap) => {
      const map: Record<string, PrizeRow[]> = {};
      snap.docs.forEach((d) => { map[d.id] = (d.data().prizeRows ?? []) as PrizeRow[]; });
      setPrizesByPeriod(map);
    }).catch(() => {});
  }, []);
  return prizesByPeriod;
}

// The lesson banner (emoji/gradient) is now generated per viewing student's
// language, cached under contests/{id}/lessons/{language} — not worth
// fetching per-language just to color this small preview card, so it
// always uses this fixed look. See functions/src/contestLesson.ts.
const DEFAULT_CONTEST_BANNER = { gradStart: "#1a0a2e", gradEnd: "#7c3aed", emoji: "🌟" };

interface AdItem {
  id: string; title?: string; imageUrl: string; sponsorName?: string;
  label?: string; actionType?: string; targetRoute?: string; externalUrl?: string;
  isActive: boolean; startDate?: any; endDate?: any; order?: number;
}

interface KBVideo {
  id: string; title: string; thumbnailUrl?: string; videoUrl?: string;
  category?: string; duration?: string; viewsCount?: number;
}

// ─── Helpers ──────────────────────────────────────────────────
function getTimeLeft(endDate?: string) {
  if (!endDate) return "Ongoing";
  const diff = new Date(endDate).getTime() - Date.now();
  if (isNaN(diff) || diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}
function isLive(b: Battle) {
  const now = Date.now();
  const s = b.startDate ? new Date(b.startDate).getTime() : 0;
  const e = b.endDate ? new Date(b.endDate).getTime() : Infinity;
  return now >= s && now <= e;
}
function parseDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string") return new Date(t);
  return null;
}
function getContestStatus(item: Contest) {
  const now = new Date();
  const start = parseDate(item.startTime ?? item.startDate);
  const end = parseDate(item.endTime ?? item.endDate);
  if (end && end < now) return "ended";
  if (start && start <= now && (!end || end > now)) return "live";
  return "upcoming";
}

// "12 Aug 2026" — plain calendar date, no time, for the completed chip and
// the far-out upcoming badge (mirrors vidyastar/page.tsx's formatChipDate).
function formatChipDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
function fmtNum(n?: number) {
  if (!n) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ─── Section Header ───────────────────────────────────────────
function SectionHeader({ title, sub, viewLabel = "See All", onView, accentIcon }: {
  title: string; sub?: string; viewLabel?: string; onView?: () => void; accentIcon?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {accentIcon && (
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>{accentIcon}</div>
        )}
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      {onView && (
        <button onClick={onView} style={{
          background: "rgba(139,92,246,0.12)", border: "none", cursor: "pointer",
          borderRadius: 20, padding: "6px 12px",
          display: "flex", alignItems: "center", gap: 3,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6" }}>{viewLabel}</span>
          <span style={{ color: "#8b5cf6", fontSize: 14 }}>›</span>
        </button>
      )}
    </div>
  );
}

// ─── Skeleton pulse ───────────────────────────────────────────
function Skeleton({ w, h, r = 12 }: { w: number | string; h: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(90deg, var(--bg-card) 25%, rgba(148,163,184,0.1) 50%, var(--bg-card) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 1: Stories
// ══════════════════════════════════════════════════════════════
function StoriesSection() {
  return <StoryComponent />;
}

// ══════════════════════════════════════════════════════════════
// SECTION 2: AI Guru Hero Card
// ══════════════════════════════════════════════════════════════
function AiGuruCard() {
  const { t } = useAppTranslation();
  const router = useRouter();
  return (
    <div onClick={() => router.push("/ai-guru")} style={{
      borderRadius: 20, cursor: "pointer",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      padding: 18,
      border: "1px solid rgba(99,102,241,0.35)",
      position: "relative", overflow: "hidden",
      boxShadow: "0 6px 24px rgba(99,102,241,0.25)",
    }}>
      <div style={{
        position: "absolute", width: 160, height: 160, borderRadius: "50%",
        background: "rgba(99,102,241,0.18)", top: -40, right: -40,
      }}/>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 20, padding: "4px 10px" }}>
          <span style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 700 }}>✨ {t("poweredByAI", "Powered by AI")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, padding: "4px 9px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }}/>
          <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700 }}>{t("onlineLabel", "Online")}</span>
        </div>
      </div>
      {/* Main */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 44 }}>🤖</span>
        <div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 22, letterSpacing: 0.3 }}>{t("aiGuru", "AI Guru")}</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>{t("aiGuruSubtitle", "Your personal AI-powered study companion")}</div>
        </div>
      </div>
      {/* Chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[t("askAnything", "Ask Anything"), t("instantAnswers", "Instant Answers"), t("studyHelp", "Study Help")].map((f) => (
          <div key={f} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 10px" }}>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600 }}>{f}</span>
          </div>
        ))}
      </div>
      {/* CTA */}
      <div style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 12, padding: "12px 0", textAlign: "center" }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: 0.3 }}>{t("startChatting", "Start Chatting →")}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 2b: Daily Streak Quiz Card — same layout as AiGuruCard above,
// re-themed. Streak count comes from subscribeToStreakProgress, the same
// real-time listener on studentDailyStreakProgress/{uid} the quiz screen's
// own header uses, so this stays in sync the instant a submission commits.
// ══════════════════════════════════════════════════════════════
function DailyStreakQuizCard() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const unsub = subscribeToStreakProgress((progress) => setStreak(progress?.currentStreak ?? 0));
    return unsub;
  }, []);

  return (
    <div onClick={() => router.push("/daily-streak-quiz")} style={{
      borderRadius: 20, cursor: "pointer",
      background: "linear-gradient(135deg, #451a03, #92400e, #78350f)",
      padding: 18,
      border: "1px solid rgba(251,191,36,0.35)",
      position: "relative", overflow: "hidden",
      boxShadow: "0 6px 24px rgba(251,146,60,0.25)",
    }}>
      <div style={{
        position: "absolute", width: 160, height: 160, borderRadius: "50%",
        background: "rgba(251,191,36,0.15)", top: -40, right: -40,
      }}/>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 20, padding: "4px 10px" }}>
          <span style={{ color: "#fde68a", fontSize: 11, fontWeight: 700 }}>🎯 {t("dailyChallenge", "Daily Challenge")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, padding: "4px 9px" }}>
          <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>🔥 {streak} {t("dayStreak", "Day Streak")}</span>
        </div>
      </div>
      {/* Main */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 44 }}>🔥</span>
        <div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 22, letterSpacing: 0.3 }}>{t("dailyStreakQuiz", "Daily Streak Quiz")}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 }}>{t("dailyStreakQuizSubtitle", "Answer today's question — keep your streak alive")}</div>
        </div>
      </div>
      {/* CTA */}
      <div style={{ background: "linear-gradient(90deg, #f59e0b, #ea580c)", borderRadius: 12, padding: "12px 0", textAlign: "center" }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: 0.3 }}>{t("playTodaysQuiz", "Play Today's Quiz →")}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 3: Skill Battle Preview (live battles horizontal scroll)
// ══════════════════════════════════════════════════════════════
const BATTLE_GRADIENTS = [
  ["#0f0c29","#302b63","#24243e"],
  ["#1a0533","#4c1d95","#6d28d9"],
  ["#1c0a00","#7c2d12","#b45309"],
  ["#052e16","#065f46","#0f766e"],
  ["#0c1a2e","#1e3a5f","#1d4ed8"],
];

function SkillBattlePreviewSection() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, "skillBattles"));
        const all = snap.docs.map((d) => {
          const raw = d.data();
          const cleaned: Record<string, unknown> = {};
          Object.entries(raw).forEach(([k, v]) => { cleaned[k.trim()] = v; });
          return { id: d.id, ...cleaned } as Battle;
        });
        const live = all.filter((b) => Boolean(b.isActive) && isLive(b))
          .sort((a, b) => new Date(b.startDate || "").getTime() - new Date(a.startDate || "").getTime())
          .slice(0, 5);
        setBattles(live);
      } catch { setBattles([]); }
      finally { setLoading(false); }
    })();
  }, []);

  if (!loading && battles.length === 0) return null;

  return (
    <div style={{ marginBlock: 14 }}>
      <div style={{ padding: "0 16px" }}>
        <SectionHeader
          title={t("skillBattlePreviewTitle", "Skill Battles")}
          sub="Live now · Compete & win prizes"
          viewLabel={t("seeAll", "See All")}
          onView={() => router.push("/battle")}
          accentIcon="⚔️"
        />
      </div>
      <div style={{ overflowX: "auto", padding: "0 16px 4px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {loading
            ? [0,1].map(i => <Skeleton key={i} w={200} h={240} r={20}/>)
            : battles.map((battle, idx) => {
                const g = BATTLE_GRADIENTS[idx % BATTLE_GRADIENTS.length];
                const timeLeft = getTimeLeft(battle.endDate);
                const totalVC = (battle.vcoin_india || 0) + (battle.vcoin_state || 0) + (battle.vcoin_district || 0);
                return (
                  <button key={battle.id} onClick={() => router.push("/battle")} style={{
                    flexShrink: 0, width: 200, minHeight: 240, border: "none", cursor: "pointer",
                    borderRadius: 20, overflow: "hidden",
                    background: `linear-gradient(135deg, ${g[0]}, ${g[1]}, ${g[2]})`,
                    padding: 16, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    position: "relative", boxShadow: "0 6px 20px rgba(99,102,241,0.3)",
                  }}>
                    <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }}/>
                    {/* LIVE badge */}
                    <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }}/>
                      <div style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 8, padding: "3px 8px" }}>
                        <span style={{ color: "#fca5a5", fontSize: 10, fontWeight: 800 }}>🔴 LIVE · {timeLeft}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 36, marginBottom: 6 }}>🏆</span>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: "20px", marginBottom: 4, textAlign: "left" }}>{battle.title}</div>
                    {battle.sponsor && <div style={{ color: "rgba(251,191,36,0.9)", fontSize: 10, fontWeight: 700, marginBottom: 8, textAlign: "left" }}>⚡ {battle.sponsor}</div>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {totalVC > 0 && <span style={{ background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "3px 7px", color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 700 }}>🪙 {fmtNum(totalVC)}</span>}
                      {(battle.participantCount || 0) > 0 && <span style={{ background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "3px 7px", color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 700 }}>👥 {fmtNum(battle.participantCount)}</span>}
                      {battle.totalPool && <span style={{ background: "rgba(251,191,36,0.15)", borderRadius: 8, padding: "3px 7px", color: "#fde68a", fontSize: 10, fontWeight: 700 }}>🎁 {battle.totalPool}</span>}
                    </div>
                    <div style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 10, padding: "9px 0", textAlign: "center" }}>
                      <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>{t("participateNow", "Join Now →")}</span>
                    </div>
                  </button>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 4: VidyaStar Contests Preview
// ══════════════════════════════════════════════════════════════
const STATUS_CFG = {
  live:     { label: "🔴 LIVE",    bg: "#ef4444" },
  upcoming: { label: "⏰ Upcoming", bg: "#f59e0b" },
  ended:    { label: "✅ Ended",   bg: "#6b7280" },
};

// Split out from the inline .map() below so useCountdown (a hook) can be
// called once per card — hooks can't be called inside a loop callback.
function ContestPreviewCard({ item, joined, completed, prize, language, onClick }: {
  item: Contest; joined: Record<string, boolean>; completed: Record<string, any>;
  prize: PrizeRow | null; language: string; onClick: () => void;
}) {
  const { t } = useAppTranslation();
  const status = getContestStatus(item);
  const cfg = STATUS_CFG[status];
  const banner = useContestBanner(item.id, language);
  const gradStart = banner?.gradientStart ?? DEFAULT_CONTEST_BANNER.gradStart;
  const gradEnd   = banner?.gradientEnd   ?? DEFAULT_CONTEST_BANNER.gradEnd;
  const emoji     = banner?.emoji         ?? DEFAULT_CONTEST_BANNER.emoji;
  const isCompleted    = !!completed[item.id];
  const isParticipated = !!joined[item.id] || isCompleted;

  const start = parseDate(item.startTime ?? item.startDate);
  const end   = parseDate(item.endTime   ?? item.endDate);
  const endsIn   = useCountdown(status === "live"     && end   ? end.getTime()   : null);
  const startsIn = useCountdown(status === "upcoming" && start ? start.getTime() : null);
  const isWithinTwoDays = status === "upcoming" && !!start && start.getTime() - Date.now() <= TWO_DAYS_MS;

  const ctaLabel =
    status === "ended" && isParticipated ? t("viewResults", "View Results")
    : isParticipated                       ? "Continue Lesson"
    : t("participateNow", "Join Now");

  return (
    <button onClick={onClick} style={{
      flexShrink: 0, width: 200, height: 270, border: "none", cursor: "pointer",
      borderRadius: 16, overflow: "hidden",
      background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`,
      padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
    }}>
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <div style={{ background: cfg.bg, borderRadius: 6, padding: "3px 8px" }}>
            <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>{cfg.label}</span>
          </div>
        </div>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>{emoji}</div>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 800, lineHeight: "19px", marginBottom: 8, textAlign: "left" }}>{item.title}</div>
        {status === "live" && endsIn != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>⏰</span>
            <span style={{ color: "#fde68a", fontSize: 11, fontWeight: 700 }}>{formatCountdown(endsIn)} left</span>
          </div>
        )}
        {/* Upcoming, starting within 2 days: live day/hour/minute countdown.
            Further out: the plain start date instead — mirrors the same
            threshold on the VidyaStar hub's ContestCard. */}
        {status === "upcoming" && (
          isWithinTwoDays ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>⏰</span>
              <span style={{ color: "#fde68a", fontSize: 11, fontWeight: 700 }}>
                {startsIn != null ? `Starts in ${formatCountdownDHM(startsIn)}` : "Starting soon…"}
              </span>
            </div>
          ) : start ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>📅</span>
              <span style={{ color: "#fde68a", fontSize: 11, fontWeight: 700 }}>Starts {formatChipDate(start)}</span>
            </div>
          ) : null
        )}
        {prize && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>🏆</span>
            <span style={{ color: "#fde68a", fontSize: 13, fontWeight: 800 }}>{formatPrize(prize)}</span>
          </div>
        )}
        {/* Completed — topic + date chips (mirrors the VidyaStar hub's
            completed InfoChip row). */}
        {isCompleted && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.12)", padding: "3px 7px", borderRadius: 8, maxWidth: "100%", overflow: "hidden" }}>
              <span style={{ fontSize: 10 }}>📚</span>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.description || item.title}
              </span>
            </div>
            {(end || start) && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.12)", padding: "3px 7px", borderRadius: 8 }}>
                <span style={{ fontSize: 10 }}>📅</span>
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: 700 }}>{formatChipDate((end ?? start)!)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.15)", marginBlock: 8 }}/>
        <div style={{
          background: status === "live" ? "#10b981" : status === "ended" ? "#4b5563" : "#6366f1",
          borderRadius: 8, padding: "9px 0", textAlign: "center",
        }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>{ctaLabel}</span>
        </div>
      </div>
    </button>
  );
}

function VidyaStarPreviewSection() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const { user, studentProfile } = useStudentProfile();
  const { contests: allContests, loading, error: fetchError } = useContests();
  const error = !!fetchError;

  const { joined, completed } = useUserContests(user?.uid ?? "");
  const prizesByPeriod = usePrizesByPeriod();

  // Same class filtering as the VidyaStar hub — this preview previously
  // showed every contest unfiltered, regardless of the student's class.
  // Contests are no longer filtered by language — every student sees every
  // contest, and the AI lesson is generated lazily in each viewer's own
  // preferredLanguage the first time they open it.
  const userClass = studentProfile?.class != null ? String(studentProfile.class) : null;

  // Mirrors mobile: home preview shows only live/upcoming — "ended" (even
  // one the student participated in) is never shown here anymore. The full
  // history, including past contests with results, still lives on the
  // VidyaStar hub ("View All" above).
  const contests = (allContests as Contest[])
    .filter((item) => {
      if (!userClass) return true;
      if (!item.targetClass) return true;
      const classes = Array.isArray(item.targetClass) ? item.targetClass : [item.targetClass];
      return classes.includes(userClass) || classes.includes("all");
    })
    .filter((item) => getContestStatus(item) !== "ended")
    .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || (a.order || 99) - (b.order || 99))
    .slice(0, 6);

  const handleCardClick = (item: Contest) => {
    const status = getContestStatus(item);
    const isParticipated = !!joined[item.id] || !!completed[item.id];

    // Mirrors mobile ContestCard's handlePress exactly.
    if (status === "ended" && isParticipated) { router.push(`/contest/result?contestId=${item.id}`); return; }
    router.push(`/contest/lesson?contestId=${item.id}`);
  };

  return (
    <div style={{ marginBlock: 16 }}>
      <div style={{ padding: "0 16px" }}>
        <SectionHeader
          title={t("vidyaStarPreviewTitle", "VidyaStar")}
          sub={t("vidyaStarPreviewSub", "Contests & competitions")}
          viewLabel={t("viewAll", "View All")}
          onView={() => router.push("/vidyastar")}
        />
      </div>

      {!loading && error ? (
        <div style={{ padding: "0 16px", textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>⚠️</div>
          <div style={{ fontSize: 13 }}>{t("couldNotLoadContests", "Could not load contests.")}</div>
        </div>
      ) : !loading && contests.length === 0 ? (
        <div style={{ padding: "0 16px", textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🌟</div>
          <div style={{ fontSize: 13 }}>{t("contestsComingSoon", "Exciting contests coming soon!")}</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", padding: "0 16px 4px" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {loading
              ? [0,1,2].map(i => <Skeleton key={i} w={200} h={270} r={16}/>)
              : contests.map((item) => (
                  <ContestPreviewCard
                    key={item.id}
                    item={item}
                    joined={joined}
                    completed={completed}
                    prize={item.periodKey ? topPrize(prizesByPeriod[item.periodKey]) : null}
                    language={studentProfile?.preferredLanguage ?? "English"}
                    onClick={() => handleCardClick(item)}
                  />
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 5: Home Ads Carousel
// ══════════════════════════════════════════════════════════════
function HomeAdsCarousel() {
  const router = useRouter();
  const [ads, setAds] = useState<AdItem[]>([]);
  const [currentDot, setCurrentDot] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idxRef = useRef(0);

  // Mirrors mobile's AdCard handlePress (components/HomeAdsCarousel.tsx):
  // internal routes navigate in-app, external links open in a new tab.
  // actionType "none" (or anything unset) is a no-op — purely decorative ad.
  const handleAdClick = (ad: AdItem) => {
    if (ad.actionType === "internal" && ad.targetRoute) {
      router.push(ad.targetRoute);
    } else if (ad.actionType === "external" && ad.externalUrl) {
      window.open(ad.externalUrl, "_blank", "noopener,noreferrer");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(query(collection(db, "homeAds"), where("isActive", "==", true)));
        const now = new Date();
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AdItem)
          .filter((ad) => {
            if (ad.startDate && ad.endDate) {
              const s = ad.startDate.toDate?.() ?? new Date(ad.startDate);
              const e = ad.endDate.toDate?.() ?? new Date(ad.endDate);
              return now >= s && now <= e;
            }
            return true;
          })
          .sort((a, b) => (a.order || 99) - (b.order || 99));
        setAds(data);
      } catch { setAds([]); }
    })();
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      const next = (idxRef.current + 1) % ads.length;
      idxRef.current = next;
      setCurrentDot(next);
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ left: next * (scrollRef.current.offsetWidth + 12), behavior: "smooth" });
      }
    }, 3500);
    return () => clearInterval(timerRef.current);
  }, [ads.length]);

  if (ads.length === 0) return null;

  return (
    <div style={{ marginBlock: 10 }}>
      <div
        ref={scrollRef}
        style={{ overflowX: "auto", scrollSnapType: "x mandatory", display: "flex", gap: 12, padding: "0 16px" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const idx = Math.round(el.scrollLeft / (el.offsetWidth + 12));
          idxRef.current = idx;
          setCurrentDot(idx);
        }}
      >
        {ads.map((ad) => {
          const isClickable = (ad.actionType === "internal" && !!ad.targetRoute)
                            || (ad.actionType === "external" && !!ad.externalUrl);
          return (
          <div
            key={ad.id}
            onClick={isClickable ? () => handleAdClick(ad) : undefined}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleAdClick(ad); } } : undefined}
            style={{
              flexShrink: 0, width: "calc(100vw - 64px)", maxWidth: 500,
              height: 180, borderRadius: 16, overflow: "hidden",
              position: "relative", scrollSnapAlign: "start",
              cursor: isClickable ? "pointer" : "default",
            }}>
            <img
              src={ad.imageUrl || "https://via.placeholder.com/400x200?text=Ad"}
              alt={ad.title || "Ad"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.72))" }}/>
            <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 5, padding: "3px 8px" }}>
              <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{ad.label || "Sponsored"}</span>
            </div>
            {(ad.title || ad.sponsorName) && (
              <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                {ad.title && <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ad.title}</div>}
                {ad.sponsorName && <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>{ad.sponsorName}</div>}
              </div>
            )}
          </div>
          );
        })}
      </div>
      {ads.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 10 }}>
          {ads.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3,
              width: i === currentDot ? 16 : 6,
              background: i === currentDot ? "#6366f1" : "var(--border)",
              transition: "width 0.3s",
            }}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 6: Seekho Preview (horizontal category scroll)
// ══════════════════════════════════════════════════════════════
const SEEKHO_CATS = [
  { emoji: "🗣️", label: "English\nSpeaking", colors: ["#1e40af", "#3b82f6"] },
  { emoji: "💻", label: "Computer",           colors: ["#064e3b", "#059669"] },
  { emoji: "💃", label: "Dance",              colors: ["#831843", "#db2777"] },
  { emoji: "🎵", label: "Singing",            colors: ["#4c1d95", "#7c3aed"] },
  { emoji: "🎨", label: "Drawing",            colors: ["#7c2d12", "#ea580c"] },
  { emoji: "✂️", label: "Craft",              colors: ["#134e4a", "#0d9488"] },
  { emoji: "📚", label: "Class 6–12",         colors: ["#1e3a5f", "#2563eb"] },
  { emoji: "🔬", label: "Science",            colors: ["#1a2e05", "#4d7c0f"] },
  { emoji: "🔢", label: "Mathematics",        colors: ["#450a0a", "#b91c1c"] },
  { emoji: "🌟", label: "General\nSkills",    colors: ["#451a03", "#d97706"] },
];

function SeekhoPreviewSection() {
  const { t } = useAppTranslation();
  const router = useRouter();
  return (
    <div style={{ marginBlock: 16 }}>
      <div style={{ padding: "0 16px" }}>
        <SectionHeader
          title={t("seekhoPreviewTitle", "Seekho")}
          sub={t("seekhoPreviewSub", "Skill videos for every interest")}
          viewLabel={t("explore", "Explore")}
          onView={() => router.push("/seekho")}
        />
      </div>
      <div style={{ overflowX: "auto", padding: "0 16px 8px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {SEEKHO_CATS.map((cat) => (
            <button
              key={cat.label}
              onClick={() => router.push("/seekho")}
              style={{
                flexShrink: 0, width: 110, height: 110, borderRadius: 20, border: "none",
                background: `linear-gradient(135deg, ${cat.colors[0]}, ${cat.colors[1]})`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              }}
            >
              <span style={{ fontSize: 32, marginBottom: 8 }}>{cat.emoji}</span>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 800, textAlign: "center", lineHeight: "14px", whiteSpace: "pre-line" }}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 6b: GloStore Preview — admin-added affiliate products
// (mirrors mobile GloStorePreviewSection). Up to 20 admin-featured
// items, in a horizontal flash-card strip. Each card deep-links to
// that exact product inside GloStore; "View All" opens the full store.
// ══════════════════════════════════════════════════════════════
const GLOSTORE_BACKDROPS: [string, string][] = [
  ["#1e40af", "#3b82f6"],
  ["#7c2d12", "#ea580c"],
  ["#831843", "#db2777"],
  ["#064e3b", "#059669"],
  ["#4c1d95", "#7c3aed"],
];

function GloStorePreviewSection() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const [products, setProducts] = useState<GloStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchFeaturedProducts()
      .then((p) => alive && setProducts(p))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <div style={{ marginBlock: 16 }}>
      <div style={{ padding: "0 16px" }}>
        <SectionHeader
          title={"🛍️ " + t("gloStorePreviewTitle", "GloStore")}
          sub={t("gloStorePreviewSub", "Handpicked books & study essentials")}
          viewLabel={t("viewAll", "View All")}
          onView={() => router.push("/glostore")}
        />
      </div>
      <div style={{ overflowX: "auto", padding: "0 16px 8px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {products.map((p, i) => {
            const disc = discountPct(p.originalPrice, p.salePrice);
            const backdrop = GLOSTORE_BACKDROPS[i % GLOSTORE_BACKDROPS.length];
            return (
              <button
                key={p.id}
                onClick={() => router.push(`/glostore/product?productId=${p.id}`)}
                style={{
                  flexShrink: 0, width: 160, height: 200, borderRadius: 18, border: "none",
                  cursor: "pointer", padding: 0, position: "relative", overflow: "hidden",
                  backgroundColor: "#111827",
                  backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : `linear-gradient(135deg, ${backdrop[0]}, ${backdrop[1]})`,
                  backgroundSize: "cover", backgroundPosition: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)", textAlign: "left",
                }}
              >
                {disc > 0 && (
                  <span style={{ position: "absolute", top: 8, left: 8, background: "#dc2626", borderRadius: 8, padding: "3px 6px", color: "#fff", fontSize: 10, fontWeight: 800 }}>
                    {disc}% OFF
                  </span>
                )}
                {!!p.badge && (
                  <span style={{ position: "absolute", top: 8, right: 8, background: "rgba(245,158,11,0.92)", borderRadius: 8, padding: "3px 6px", color: "#fff", fontSize: 9, fontWeight: 800 }}>
                    {p.badge}
                  </span>
                )}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, background: "linear-gradient(transparent, rgba(0,0,0,0.9))" }}>
                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: "15px", marginBottom: 4 }}>
                    {p.title.length > 46 ? p.title.slice(0, 46) + "…" : p.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ color: "#4ade80", fontSize: 14, fontWeight: 900 }}>₹{p.salePrice}</span>
                    {p.originalPrice > p.salePrice && (
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600, textDecoration: "line-through" }}>₹{p.originalPrice}</span>
                    )}
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "5px 0", textAlign: "center" }}>
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>Buy Now →</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 7: Discover Preview (mirrors mobile DiscoverPreviewSection)
// ══════════════════════════════════════════════════════════════
function DiscoverPreviewSection() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const CHIPS = ["🔍 Search Now", "🎯 Top Careers", "🎓 Scholarships"];
  return (
    <div style={{ marginBlock: 16 }}>
      <SectionHeader
        title={t("discoverPreviewTitle", "Discover")}
        sub={t("discoverPreviewSub", "AI-powered career & learning paths")}
        viewLabel={t("explore", "Explore")}
        onView={() => router.push("/ai-guru")}
      />
      <div onClick={() => router.push("/ai-guru")} style={{
        borderRadius: 20, cursor: "pointer",
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        padding: 18, border: "1px solid rgba(99,102,241,0.35)",
        position: "relative", overflow: "hidden",
        boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
      }}>
        <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", background: "rgba(99,102,241,0.15)", top: -50, right: -50 }}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 20, padding: "4px 10px" }}>
            <span style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 700 }}>✨ {t("poweredByGemini", "Powered by Gemini AI")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 20, padding: "4px 9px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#06b6d4" }}/>
            <span style={{ color: "#06b6d4", fontSize: 11, fontWeight: 700 }}>{t("activeLabel", "Active")}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 44 }}>🧭</span>
          <div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 20, letterSpacing: 0.3 }}>{t("discoverTitle", "Discover")}</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 3 }}>{t("discoverSubtitle", "Explore your future")}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {CHIPS.map((c) => (
            <div key={c} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 10px" }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600 }}>{c}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 12, padding: "12px 0", textAlign: "center" }}>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: 0.3 }}>{t("discoverCta", "Explore Now →")}</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 8: Knowledge Hub
// ══════════════════════════════════════════════════════════════
const KB_CATS = [
  "All","Educational","Motivational","Skill Development","Lifestyle",
  "Health","Technology","Mind Development","Career","General Knowledge",
];

function KnowledgeHubSection() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const [videos, setVideos] = useState<KBVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("All");

  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(query(collection(db, "knowledgeVideos"), where("isActive", "==", true), limit(10)));
        setVideos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KBVideo));
      } catch { setVideos([]); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = activeCat === "All" ? videos : videos.filter((v) => v.category === activeCat);

  return (
    <div style={{ marginBlock: 16 }}>
      <div style={{ padding: "0 16px" }}>
        <SectionHeader
          title={t("knowledgeHubTitle", "Knowledge Hub")}
          sub={t("knowledgeHubSub", "Videos to grow your mind")}
          viewLabel={t("watchMore", "Watch More")}
          onView={() => router.push("/knowledge-hub")}
        />
      </div>

      {/* Category chips */}
      <div style={{ overflowX: "auto", padding: "0 16px 10px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {KB_CATS.map((cat) => (
            <button key={cat} onClick={() => setActiveCat(cat)} style={{
              flexShrink: 0, padding: "6px 12px", borderRadius: 20,
              border: `1.5px solid ${activeCat === cat ? "#3b82f6" : "var(--border)"}`,
              background: activeCat === cat ? "#1e3a5f" : "var(--bg-card)",
              color: activeCat === cat ? "#60a5fa" : "var(--text-muted)",
              fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Video cards */}
      <div style={{ overflowX: "auto", padding: "0 16px 4px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {loading
            ? [0,1,2].map(i => <Skeleton key={i} w={160} h={200} r={14}/>)
            : filtered.length === 0
              ? <div style={{ padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>🎥 More videos coming soon!</div>
              : filtered.map((v) => (
                  <button key={v.id} onClick={() => router.push("/knowledge-hub")} style={{
                    flexShrink: 0, width: 160, borderRadius: 14, overflow: "hidden",
                    background: "var(--bg-card)", border: "none", cursor: "pointer", textAlign: "left",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}>
                    <div style={{ width: 160, height: 100, position: "relative", background: "linear-gradient(135deg, #0f172a, #1e3a5f)" }}>
                      {v.thumbnailUrl
                        ? <img src={v.thumbnailUrl} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#60a5fa" }}>📺</div>
                      }
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff" }}>
                        <span style={{ color: "#fff", fontSize: 10, marginLeft: 2 }}>▶</span>
                      </div>
                      {v.duration && <div style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.65)", borderRadius: 5, padding: "2px 5px" }}><span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{v.duration}</span></div>}
                      {v.category && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(59,130,246,0.85)", borderRadius: 5, padding: "2px 6px" }}><span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>{v.category}</span></div>}
                    </div>
                    <div style={{ padding: 9 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: "17px", marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>👁 {fmtNum(v.viewsCount)}</div>
                    </div>
                  </button>
                ))
          }
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 9: Referral Card (mirrors mobile ReferralCard.tsx)
// ══════════════════════════════════════════════════════════════
function ReferralCard() {
  const { t } = useAppTranslation();
  const { user, studentProfile } = useStudentProfile();
  const router = useRouter();
  const [referralCode, setReferralCode] = useState("LOADING");
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(true);
  const [referrerCoins, setReferrerCoins] = useState(50);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    // Shared config doc — same path admin's Referrals.tsx and mobile's
    // referralService.ts read/write. (Previously queried "referralConfig"
    // as its own collection, which is a different, always-empty path —
    // meaning the admin's isActive toggle and coin amount never reached
    // this card; it silently ran on its hardcoded defaults instead.)
    getDoc(doc(db, "appConfig", "referralConfig")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setActive(d.isActive !== false);
        setReferrerCoins(d.referrerCoins || 50);
      }
    }).catch(() => {});
    // Fetch user referral data
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        setReferralCode(snap.data().referralCode || user.uid.slice(0, 8).toUpperCase());
        setReferralCount(snap.data().referralCount || 0);
      }
    });
    return () => unsub();
  }, [user]);

  if (!active) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join Gloows365E",
        text: `${t("referEarn", "Refer & Earn")} — India's smartest learning app! 🚀\n\nUse my referral code: ${referralCode}\n\nDownload: https://gloows365.in`,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div style={{
      background: "#0F0B2E", borderRadius: 20, padding: 16,
      border: "1px solid rgba(124,58,237,0.3)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 20 }}>👥</span>
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>{t("referEarn", "Refer & Earn")}</div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 1 }}>{t("referEarnSub", "Earn VCoins for every friend who joins")}</div>
          </div>
        </div>
        <button onClick={() => router.push("/referral")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ color: "#7C3AED", fontSize: 12, fontWeight: 600 }}>{t("viewAllLabel", "View all")}</span>
          <span style={{ color: "#7C3AED" }}>›</span>
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        {[
          { num: referralCount, label: t("friendsJoined", "Friends joined") },
          { num: referralCount * referrerCoins, label: t("vCoinsEarned", "VCoins earned") },
          { num: `+${referrerCoins}`, label: t("perReferral", "Per referral") },
        ].map((s, i, arr) => (
          // FIX (console warning — "each child in a list should have a
          // unique key prop"): key={s.label} was on the inner <div>, but
          // .map() needs the key on the element it directly returns each
          // iteration — which was this fragment. A bare <>...</> fragment
          // can't carry props at all (it's shorthand for React.Fragment
          // with none), so the key never actually reached React. Using the
          // explicit <Fragment key={...}> form instead, which does accept one.
          <Fragment key={s.label}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>{s.num}</span>
              <span style={{ color: "#94a3b8", fontSize: 11, marginTop: 2, textAlign: "center" }}>{s.label}</span>
            </div>
            {i < arr.length - 1 && <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)" }}/>}
          </Fragment>
        ))}
      </div>

      {/* Code row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>{t("yourCode", "Your code")}</div>
          <div style={{ color: "#a78bfa", fontSize: 20, fontWeight: 800, letterSpacing: 2 }}>{referralCode}</div>
        </div>
        <button onClick={handleCopy} style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(124,58,237,0.15)", border: "none", borderRadius: 8,
          padding: "8px 12px", cursor: "pointer",
        }}>
          <span style={{ fontSize: 16 }}>{copied ? "✅" : "📋"}</span>
          <span style={{ color: copied ? "#16A34A" : "#7C3AED", fontSize: 13, fontWeight: 600 }}>
            {copied ? (t("copiedLabel", "Copied!")) : (t("copyLabel", "Copy"))}
          </span>
        </button>
      </div>

      {/* Share CTA */}
      <button onClick={handleShare} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, background: "#7C3AED", border: "none", borderRadius: 14,
        padding: "13px 0", cursor: "pointer",
      }}>
        <span style={{ fontSize: 18 }}>📤</span>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{t("referMoreFriends", "Refer More Friends")}</span>
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN HOME PAGE
// ══════════════════════════════════════════════════════════════
type FeedItem =
  | { type: "stories" }       | { type: "aiguru" }
  | { type: "daily_streak_quiz" }
  | { type: "skillbattle_preview" } | { type: "vidya_star" }
  | { type: "home_ads" }      | { type: "creator_reels" }
  | { type: "skillshorts" }   | { type: "learning" }
  | { type: "discover_preview" } | { type: "knowledge_hub" }
  | { type: "seekho_preview" }| { type: "referral" }
  | { type: "glostore_preview" }
  | { type: "post"; data: any }
  | { type: "ad" }
  | { type: "scholarship_ad" };

export default function HomePage() {
  const { t } = useAppTranslation();
  const { studentProfile } = useStudentProfile();
  const { homeSection, homeFlags } = useFeatureFlags();
  const [posts, setPosts] = useState<any[]>([]);

  // Targeted feed/scholarship ads (mirrors mobile's home.tsx) — see
  // hooks/useAdFeed.ts and hooks/useAdFrequency.ts. These call the
  // getAds/recordAdEvent Cloud Functions, completely separate from the
  // self-serve homeAds carousel above (HomeAdsCarousel).
  const { currentAd: feedAd }        = useAdFeed({ module: "home", adType: "feed" });
  const { currentAd: scholarshipAd } = useAdFeed({ module: "home", adType: "scholarship" });
  const { canShowAd }                = useAdFrequency();

  const fetchPosts = useCallback(async () => {
    try {
      const fn = getFunctions();
      const getHomeFeed = httpsCallable<{}, { posts: any[] }>(fn, "getHomeFeed");
      const { data } = await getHomeFeed({});
      setPosts((data.posts || []).filter((p: any) => p.postType === "photo" || p.postType === "video"));
    } catch { setPosts([]); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const feedData = useMemo<FeedItem[]>(() => {
    const feed: FeedItem[] = [];
    if (homeSection("stories"))          feed.push({ type: "stories" });
    if (homeSection("aiguru"))           feed.push({ type: "aiguru" });
    if (homeSection("daily_streak_quiz")) feed.push({ type: "daily_streak_quiz" });
    if (homeSection("skillbattle"))      feed.push({ type: "skillbattle_preview" });
    if (homeSection("vidya_star"))       feed.push({ type: "vidya_star" });
    if (homeSection("home_ads"))         feed.push({ type: "home_ads" });
    if (homeSection("creator_reels"))    feed.push({ type: "creator_reels" });
    if (homeSection("skillshorts"))      feed.push({ type: "skillshorts" });
    if (homeSection("learning"))         feed.push({ type: "learning" });
    if (homeSection("discover_preview")) feed.push({ type: "discover_preview" });
    if (homeSection("knowledge_hub"))    feed.push({ type: "knowledge_hub" });
    if (homeSection("seekho_preview"))   feed.push({ type: "seekho_preview" });
    if (homeSection("glostore_preview")) feed.push({ type: "glostore_preview" });
    if (homeSection("scholarship_ad"))   feed.push({ type: "scholarship_ad" });
    if (homeSection("referral"))         feed.push({ type: "referral" });

    // Interleave feed posts with feed ads, mirroring mobile's pattern:
    // 2 posts → ad → 2 posts (only when feed_posts and feed_ads are both
    // on; "ad" feed items render nothing if no ad loaded or frequency-capped).
    const showPosts = homeSection("feed_posts");
    const showAds    = homeSection("feed_ads");
    if (showPosts) {
      const slice = posts.slice(0, 6);
      let i = 0;
      while (i < slice.length) {
        feed.push({ type: "post", data: slice[i++] });
        if (i < slice.length) feed.push({ type: "post", data: slice[i++] });
        if (showAds) feed.push({ type: "ad" });
      }
    }
    return feed;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeFlags, posts]);

  const firstName = studentProfile?.name?.split(" ")[0] || "Student";

  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Admin banners (Banners.tsx) ── */}
      <BannerCarousel screen="home" />

      {/* ── Greeting + badges ── */}
      <div style={{ padding: "16px 16px 12px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
          Hey {firstName} 👋
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
          {t("readyToLearn", "Ready to learn something new today?")}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {studentProfile?.class && (
            <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: "7px 13px", fontSize: 13, fontWeight: 600, color: "#818cf8" }}>
              📚 Class {studentProfile.class}{studentProfile.board ? ` · ${studentProfile.board}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* ── Feed ── */}
      {feedData.map((item, i) => {
        switch (item.type) {
          case "stories":
            return <StoriesSection key={i} />;

          case "aiguru":
            return <div key={i} style={{ padding: "0 16px", marginBlock: 10 }}><AiGuruCard /></div>;

          case "daily_streak_quiz":
            return <div key={i} style={{ padding: "0 16px", marginBlock: 10 }}><DailyStreakQuizCard /></div>;

          case "skillbattle_preview":
            return <SkillBattlePreviewSection key={i} />;

          case "vidya_star":
            return <VidyaStarPreviewSection key={i} />;

          case "home_ads":
            return <HomeAdsCarousel key={i} />;

          case "creator_reels":
            // Admin-uploaded short reels from short_reels collection
            return <div key={i} style={{ marginBlock: 14 }}><AdminShortReelsSection /></div>;

          case "skillshorts":
            // Approved battle reels + own pending
            return <div key={i} style={{ marginBlock: 14 }}><SkillBattleReelsSection /></div>;

          case "learning":
            // Student-uploaded creator reels from posts collection
            return <div key={i} style={{ marginBlock: 14 }}><CreatorReelsSection /></div>;

          case "discover_preview":
            return <div key={i} style={{ padding: "0 16px", marginBlock: 10 }}><DiscoverPreviewSection /></div>;

          case "knowledge_hub":
            return <KnowledgeHubSection key={i} />;

          case "seekho_preview":
            return <SeekhoPreviewSection key={i} />;

          case "glostore_preview":
            return <GloStorePreviewSection key={i} />;

          case "scholarship_ad":
            return scholarshipAd
              ? <ScholarshipAdCard key={i} ad={scholarshipAd} module="home" />
              : null;

          case "referral":
            return <div key={i} style={{ padding: "0 16px", marginBlock: 10 }}><ReferralCard /></div>;

          case "post":
            return (
              <div key={i} style={{ padding: "0 16px", marginBlock: 8 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 14, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                      {(item.data?.authorName?.[0] || "S").toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{item.data?.authorName || "Student"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.data?.postType || "post"}</div>
                    </div>
                  </div>
                  {item.data?.caption && <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{item.data.caption}</div>}
                </div>
              </div>
            );

          case "ad":
            return feedAd && canShowAd()
              ? <FeedAdCard key={feedAd.id} ad={feedAd} module="home" />
              : null;

          default:
            return null;
        }
      })}
      <div style={{ height: 20 }}/>
    </div>
  );
}
