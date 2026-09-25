"use client";

// PATH: apps/web/src/app/(app)/home/_sections/ShortVideos.tsx
//
// Exact web mirror of mobile SkillShortPreview.tsx + ShortLearnPreview.tsx
//
// Exports:
//   AdminShortReelsSection   → short_reels collection (admin) — flag: creator_reels
//   CreatorReelsSection      → posts collection (students)    — flag: learning
//   SkillBattleReelsSection  → posts isSkillBattle=true       — flag: skillshorts

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getFirestore, collection, query, where,
  orderBy, limit, getDocs, onSnapshot,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useStudentProfile } from "@gloows/shared-logic";
import { useAppTranslation } from "@/context/LanguageContext";
import { scoreReel, matchesClassFilter, type ScorableReel, type ScoringProfile } from "@/lib/reelScoring";

// ─── Dimensions (exact mobile values) ────────────────────────
const CARD_W = 120;
const CARD_H = 185;
const WATCH_W = Math.round(CARD_W * 0.78); // 93px

// ─── Category colours (from mobile CAT_COLORS) ────────────────
const CAT_COLORS: Record<string, string> = {
  "Motivation":        "#FF6B6B",
  "Study Tips":        "#4ECDC4",
  "Science Facts":     "#45B7D1",
  "Math Tricks":       "#96CEB4",
  "Current Affairs":   "#FFEAA7",
  "Career Guidance":   "#DDA0DD",
  "Life Skills":       "#98D8C8",
  "Exam Hacks":        "#F7DC6F",
  "Fun Learning":      "#85C1E9",
  "English Speaking":  "#F48FB1",
  "General":           "#AED6F1",
};

// ─── Battle status config (from mobile STATUS_CFG) ────────────
const STATUS_CFG: Record<string, { emoji: string; label: string; bg: string }> = {
  pending:   { emoji: "⏳", label: "Pending Review", bg: "rgba(243,156,18,0.92)"  },
  in_review: { emoji: "🔍", label: "In Review",      bg: "rgba(52,152,219,0.92)"  },
  rejected:  { emoji: "❌", label: "Rejected",        bg: "rgba(231,76,60,0.92)"   },
};

const fmt = (n?: number) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

// ─── Skeleton card ────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div style={{
      flexShrink: 0, width: CARD_W, height: CARD_H, borderRadius: 14,
      background: "linear-gradient(90deg,var(--bg-card) 25%,rgba(148,163,184,0.08) 50%,var(--bg-card) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }}/>
  );
}

// ─── Reusable vertical reel card (mirrors mobile card exactly) ──
function ReelCard({
  thumbnail, title, views, likes,
  featured, catLabel, catColor,
  badge, badgeBg,
  viewsLabel,
  onClick,
}: {
  thumbnail?: string; title?: string;
  views?: number; likes?: number;
  featured?: boolean; catLabel?: string; catColor?: string;
  badge?: string; badgeBg?: string;
  viewsLabel?: string; // for battle style "views 👁"
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0,
        width: CARD_W, height: CARD_H,
        borderRadius: 14, overflow: "hidden",
        border: "none", cursor: "pointer",
        position: "relative",
        background: catColor ? catColor + "33" : "#1e293b",
        boxShadow: hov
          ? "0 8px 24px rgba(0,0,0,0.4)"
          : "0 4px 12px rgba(0,0,0,0.25)",
        transform: hov ? "scale(1.04)" : "scale(1)",
        transition: "transform 0.15s, box-shadow 0.15s",
        padding: 0,
      }}
    >
      {/* Thumbnail */}
      {thumbnail
        ? <img src={thumbnail} alt={title || "reel"}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
        : <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, background: catColor ? catColor + "33" : "#1e293b",
          }}>🎬</div>
      }

      {/* Gradient overlay — transparent → rgba(0,0,0,0.75) */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.78))",
      }}/>

      {/* Play button */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: 28, height: 28, borderRadius: "50%",
        background: "rgba(0,0,0,0.5)",
        border: "2px solid #fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: hov ? 1 : 0.85,
        transition: "opacity 0.15s",
      }}>
        <span style={{ color: "#fff", fontSize: 10, marginLeft: 2 }}>▶</span>
      </div>

      {/* Featured star */}
      {featured && (
        <div style={{
          position: "absolute", top: 7, right: 7,
          background: "rgba(0,0,0,0.5)",
          width: 20, height: 20, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 10 }}>⭐</span>
        </div>
      )}

      {/* Category badge */}
      {catLabel && (
        <div style={{
          position: "absolute", bottom: 40, left: 6,
          background: (catColor || "#6C63FF") + "cc",
          borderRadius: 6, padding: "2px 6px",
        }}>
          <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>{catLabel}</span>
        </div>
      )}

      {/* Title */}
      {title && (
        <div style={{
          position: "absolute", bottom: 20, left: 6, right: 6,
          color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "13px",
          display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", textAlign: "left",
        }}>{title}</div>
      )}

      {/* Stats row */}
      <div style={{
        position: "absolute", bottom: 6, left: 6, right: 6,
        display: "flex", gap: 8,
      }}>
        {/* battle style: views right-aligned */}
        {viewsLabel
          ? <span style={{ color: "#fff", fontSize: 9, fontWeight: 600,
              background: "rgba(0,0,0,0.6)", padding: "2px 5px", borderRadius: 4 }}>
              {viewsLabel}
            </span>
          : <>
              {views  !== undefined && <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9 }}>🔥 {fmt(views)}</span>}
              {likes  !== undefined && <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9 }}>❤️ {fmt(likes)}</span>}
            </>
        }
      </div>

      {/* Status badge (battle reels) */}
      {badge && badgeBg && (
        <div style={{
          position: "absolute", bottom: 8, right: 6,
          background: badgeBg, borderRadius: 6,
          padding: "3px 7px",
        }}>
          <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>{badge}</span>
        </div>
      )}
    </button>
  );
}

// ─── Section header row (mirrors mobile header exactly) ───────
function SectionRow({
  icon, title, sub, accentColor,
  onSeeAll, seeAllLabel = "See All",
  children, loading,
}: {
  icon: string; title: string; sub: string;
  accentColor: string; seeAllLabel?: string;
  onSeeAll: () => void;
  children: React.ReactNode; loading: boolean;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px", marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>
          </div>
        </div>
        <button onClick={onSeeAll} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "6px 12px", borderRadius: 20,
          border: `1.5px solid ${accentColor}`,
          background: "none", cursor: "pointer",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{seeAllLabel}</span>
          <span style={{ color: accentColor, fontSize: 14 }}>›</span>
        </button>
      </div>

      {/* Horizontal scroll */}
      <div style={{ overflowX: "auto", padding: "0 16px 4px" }}>
        <div style={{
          display: "flex", gap: 10,
          alignItems: "flex-start",
          /* snap scrolling like mobile */
          scrollSnapType: "x mandatory",
        }}>
          {loading
            ? [0,1,2,3].map(i => <CardSkeleton key={i}/>)
            : children
          }
        </div>
      </div>
    </div>
  );
}

// ─── Personalisation scorer ────────────────────────────────────
// FIX (deduplication): this used to be a standalone copy of the same logic
// also duplicated in app/reels/page.tsx and mobile's SkillShortPreview.tsx
// (each independently, with no shared source — same drift risk the
// language-list README already called out for lib/languages.ts). Now
// imported from lib/reelScoring.ts (see top of file), the one shared
// definition.
type ShortReel = ScorableReel & {
  id: string; title: string; category?: string; thumbnail?: string;
  views?: number; likes?: number; featured?: boolean;
};
type SProfile = ScoringProfile;

// ══════════════════════════════════════════════════════════════
//  1. AdminShortReelsSection
//     Mirrors: ShortReelsRow inside SkillShortPreview.tsx
//     Source : short_reels collection, status=active
//     Flag   : homeSection("creator_reels")
// ══════════════════════════════════════════════════════════════
export function AdminShortReelsSection() {
  const { t } = useAppTranslation();
  const { studentProfile } = useStudentProfile();
  const router = useRouter();
  const [reels,   setReels]   = useState<ShortReel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore();
    const unsub = onSnapshot(
      query(collection(db, "short_reels"), where("status", "==", "active")),
      (snap) => {
        const all: ShortReel[] = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        const student: SProfile | null = studentProfile ? {
          class:             String(studentProfile.class || ""),
          preferredLanguage: studentProfile.preferredLanguage as string | undefined,
          location:          studentProfile.location as { state?: string } | undefined,
          interests:         studentProfile.interests as string[] | undefined,
        } : null;
        // FIX: short reels can be admin-scoped to specific classes
        // (targetClass) — this is a hard visibility filter, unlike
        // language/state/interest which only affect ranking below. See
        // matchesClassFilter() in lib/reelScoring.ts.
        const visible = all.filter((r) => matchesClassFilter(r, student?.class));
        const sorted = visible
          .map(r => ({ r, s: scoreReel(r, student) }))
          .sort((a, b) => b.s - a.s)
          .map(({ r }) => r)
          .slice(0, 12);
        setReels(sorted);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [studentProfile]);

  if (!loading && reels.length === 0) return null;

  return (
    <SectionRow
      icon="🎬"
      title={t("shortReelsTitle") || "Short Reels"}
      sub={t("curatedByVidya") || "Curated by Vidya AI"}
      accentColor="#6C63FF"
      onSeeAll={() => router.push("/reels?tab=short")}
      loading={loading}
    >
      {/* Watch All card — purple gradient, exactly like mobile */}
      <button
        onClick={() => router.push("/reels?tab=short")}
        style={{
          flexShrink: 0,
          width: WATCH_W, height: CARD_H,
          borderRadius: 14, border: "none", cursor: "pointer",
          background: "linear-gradient(160deg, #6C63FF, #8B5CF6)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6,
          scrollSnapAlign: "start",
          boxShadow: "0 4px 16px rgba(108,99,255,0.35)",
        }}
      >
        <span style={{ fontSize: 28, color: "#fff" }}>▶</span>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 900, textAlign: "center" }}>
          {t("watchAll") || "Watch All"}
        </span>
        {reels.length > 0 && (
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>
            {reels.length} reels
          </span>
        )}
      </button>

      {reels.map((reel, idx) => {
        const catColor = CAT_COLORS[reel.category ?? ""] ?? "#6C63FF";
        return (
          <ReelCard
            key={reel.id}
            thumbnail={reel.thumbnail}
            title={reel.title}
            views={reel.views}
            likes={reel.likes}
            featured={reel.featured}
            catLabel={reel.category ?? "General"}
            catColor={catColor}
            onClick={() => router.push(`/reels?tab=short&startIndex=${idx}`)}
          />
        );
      })}
    </SectionRow>
  );
}

// ══════════════════════════════════════════════════════════════
//  2. CreatorReelsSection
//     Mirrors: SkillShortPreview.tsx (ShortLearnPreview.tsx)
//     Source : posts, postType=reel, not skillbattle, not rejected
//     Flag   : homeSection("learning")
// ══════════════════════════════════════════════════════════════
export function CreatorReelsSection() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const [reels,   setReels]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore();
        // Single-field where() — no composite index needed (mirrors mobile fix)
        const snap = await getDocs(query(
          collection(db, "posts"),
          where("postType", "==", "reel"),
          orderBy("views", "desc"),
          limit(30),
        ));
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() as any }))
          .filter(r => r.isSkillBattle !== true && r.status !== "rejected")
          .slice(0, 10);
        setReels(data);
      } catch {
        setReels([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!loading && reels.length === 0) return null;

  return (
    <SectionRow
      icon="📖"
      title={t("shortLearningTitle") || "Short Learning"}
      sub="Student reels to learn on the go"
      accentColor="#8b5cf6"
      onSeeAll={() => router.push("/reels")}
      loading={loading}
    >
      {reels.map(reel => (
        <ReelCard
          key={reel.id}
          thumbnail={reel.thumbnail}
          title={reel.title}
          views={reel.views}
          viewsLabel={`🔥 ${fmt(reel.views || 0)}`}
          onClick={() => router.push(`/reels?postId=${reel.id}`)}
        />
      ))}
    </SectionRow>
  );
}

// ══════════════════════════════════════════════════════════════
//  3. SkillBattleReelsSection
//     Mirrors: SkillBattleRow inside SkillShortPreview.tsx
//     Source : posts isSkillBattle=true & status=approved
//              + own pending/in-review posts
//     Flag   : homeSection("skillshorts")
// ══════════════════════════════════════════════════════════════
export function SkillBattleReelsSection() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const [approved,   setApproved]   = useState<any[]>([]);
  const [ownPending, setOwnPending] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Approved battle reels
  useEffect(() => {
    const db = getFirestore();
    const unsub = onSnapshot(
      query(
        collection(db, "posts"),
        where("isSkillBattle", "==", true),
        where("status", "==", "approved"),
      ),
      (snap) => {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() as any }))
          .sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, 10);
        setApproved(sorted);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  // Own pending / in-review (current user only)
  useEffect(() => {
    const auth = getAuth();
    let unsubSnap: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubSnap?.();
      if (!user) { setOwnPending([]); return; }
      const db = getFirestore();
      unsubSnap = onSnapshot(
        query(collection(db, "posts"), where("userId", "==", user.uid)),
        (snap) => {
          setOwnPending(
            snap.docs
              .filter(d => {
                const dt = d.data() as any;
                return dt.isSkillBattle === true && dt.status !== "approved";
              })
              .map(d => ({ id: d.id, ...d.data() as any }))
              .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
          );
        },
        () => setOwnPending([])
      );
    });
    return () => { unsubAuth(); unsubSnap?.(); };
  }, []);

  const allItems = [...ownPending, ...approved];
  if (!loading && allItems.length === 0) return null;

  return (
    <SectionRow
      icon="🏆"
      title={t("Creator Shorts") || "Skill Battle Reels"}
      sub={t("topApprovedReels") || "Top approved reels"}
      accentColor="#f97316"
      seeAllLabel={t("viewAll") || "View All"}
      onSeeAll={() => router.push("/reels?filter=skillbattle")}
      loading={loading}
    >
      {allItems.map(reel => {
        const statusCfg = STATUS_CFG[reel.status];
        return (
          <ReelCard
            key={reel.id}
            thumbnail={reel.thumbnail || reel.profilePic}
            title={reel.name || reel.title}
            views={reel.views}
            viewsLabel={`${fmt(reel.views || 0)} 👁`}
            badge={statusCfg ? `${statusCfg.emoji} ${statusCfg.label}` : undefined}
            badgeBg={statusCfg?.bg}
            onClick={() => router.push(`/reels?postId=${reel.id}&filter=skillbattle`)}
          />
        );
      })}
    </SectionRow>
  );
}