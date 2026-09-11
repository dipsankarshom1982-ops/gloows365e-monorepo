"use client";

// PATH: apps/web/src/app/(app)/vidyastar/page.tsx
// Mirrors mobile app/(drawer)/(tabs)/vidyastar.tsx.
//
// FIXES vs previous version:
//   - joined/completed previously read users/{uid}/joinedContests and
//     users/{uid}/completedContests, collections nothing ever writes to.
//     Now uses useContests/useUserContests, which query the real
//     contests/{id}/participant subcollection (same as mobile).
//   - Every CTA button was rendered with no onClick at all — Join Now,
//     Continue Lesson, View Result, Reserve Spot, View Leaderboard all did
//     nothing. Now wired to joinContest() and real navigation.
//   - Class filtering now uses studentProfile?.class directly (sourced
//     correctly now that StudentProfileContext merges students/+users/),
//     rather than mobile's own UserService.getUserClass() which reads
//     users/{uid}.class — a field that's actually never written there.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";
import { useContests } from "@/hooks/useContests";
import { useUserContests } from "@/hooks/useUserContests";
import { joinContest } from "@/services/joinContest";
import EarnMoreVCoinsModal from "@/components/EarnMoreVCoinsModal";
import BannerCarousel from "@/components/BannerCarousel";
import { useCountdown, formatCountdown, formatCountdownDHM } from "@/hooks/useCountdown";
import { useContestBanner } from "@/hooks/useContestBanner";

interface Contest {
  id: string;
  title: string;
  description?: string;
  periodKey?: string;
  startTime?: any; endTime?: any; startDate?: any; endDate?: any;
  joinedCount?: number;
  totalSpots?: number;
  targetClass?: string[] | string;
  vCoinEntryFee?: number;
  isSponsored?: boolean;
  sponsorName?: string;
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

// ─── Date helper (mirrors mobile getDate) ─────────────────────
function getDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

// "12 Aug 2026" — plain calendar date, no time, for completed/upcoming chips.
function formatChipDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

// ─── Chip (mirrors mobile Chip component) ─────────────────────
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px", marginRight: 10, borderRadius: 30,
        border: `1px solid ${active ? "#4f46e5" : "var(--border)"}`,
        background: active ? "#4f46e5" : "rgba(255,255,255,0.04)",
        color: active ? "#fff" : "#6366f1",
        fontSize: 13, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

// ─── Action button (mirrors mobile ActionButton) ───────────────
// `loading` swaps the label for a spinner + loadingTitle so a tap on
// Reserve Spot / Join Now (both fire an async Firestore write) gives
// immediate feedback that something is happening, rather than looking
// unresponsive until the request resolves.
function ActionButton({ title, gradient, onClick, disabled, loading, loadingTitle }: {
  title: string; gradient: [string, string]; onClick?: () => void; disabled?: boolean;
  loading?: boolean; loadingTitle?: string;
}) {
  const isBusy = !!loading;
  return (
    <button
      onClick={onClick}
      disabled={disabled || isBusy}
      style={{
        width: "100%", padding: "14px 0", borderRadius: 16, border: "none",
        background: `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]})`,
        color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: 0.5,
        cursor: (disabled || isBusy) ? "default" : "pointer", opacity: (disabled || isBusy) ? 0.75 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}
    >
      {isBusy && (
        <span style={{
          width: 16, height: 16, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff",
          animation: "spin 0.6s linear infinite",
        }} />
      )}
      {isBusy ? (loadingTitle ?? "Please wait…") : title}
    </button>
  );
}

// ─── Timer / date badge ─────────────────────────────────────────
// Amber "timer" style for the <2-day countdown, neutral indigo "date" style
// for the plain calendar-date case — same shape, different palette.
function TimerBadge({ icon = "⏰", text, tone = "timer" }: { icon?: string; text: string; tone?: "timer" | "date" }) {
  const palette = tone === "timer"
    ? { bg: "rgba(251,191,36,0.1)", border: "#fef3c7", color: "#d97706" }
    : { bg: "rgba(99,102,241,0.08)", border: "#e0e7ff", color: "#4f46e5" };
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 8, padding: 12, background: palette.bg,
      borderRadius: 16, border: `1px solid ${palette.border}`,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ color: palette.color, fontWeight: 700 }}>{text}</span>
    </div>
  );
}

// ─── Info chip (completed contest's topic / date pills) ─────────
function InfoChip({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "var(--bg-card)", border: "1px solid var(--border)",
      padding: "5px 10px", borderRadius: 10, maxWidth: "100%",
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {text}
      </span>
    </div>
  );
}

// ─── Contest card (mirrors mobile ContestCard) ────────────────
// Header uses the real per-contest AI banner (unique emoji/gradient/
// tagline, generated by getContestLesson — see hooks/useContestBanner.ts)
// instead of a flat white header, so each contest actually looks distinct.
// Falls back to a generic purple gradient + star until that's generated
// (lazily, the first time anyone in the viewer's language opens it).
function ContestCard({ item, joined, completed, prize, language, onInsufficientBalance }: {
  item: Contest; joined: Record<string, boolean>; completed: Record<string, any>;
  prize: PrizeRow | null; language: string;
  onInsufficientBalance: (info: { required: number; balance: number; contestTitle?: string }) => void;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const banner = useContestBanner(item.id, language);

  const isJoined    = !!joined[item.id];
  const isCompleted = !!completed[item.id];
  const now   = new Date();
  const start = getDate(item.startTime ?? item.startDate);
  const end   = getDate(item.endTime   ?? item.endDate);
  const isLive  = !!(start && start <= now && (!end || end > now));
  const isEnded = !!(end && end < now);

  const endsIn   = useCountdown(isLive && end ? end.getTime() : null);
  const startsIn = useCountdown(!isLive && !isEnded && start ? start.getTime() : null);
  const isUpcoming     = !isCompleted && !isLive && !!start && start > now;
  const isWithinTwoDays = isUpcoming && start!.getTime() - now.getTime() <= TWO_DAYS_MS;

  const vCoinFee = item.isSponsored ? 0 : Math.max(0, Number(item.vCoinEntryFee) || 0);

  const progress =
    isLive && start && end
      ? ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100
      : 0;

  const goToLesson      = () => router.push(`/contest/lesson?contestId=${item.id}`);
  const goToResult      = () => router.push(`/contest/result?contestId=${item.id}`);
  const goToLeaderboard = () => router.push(`/contest/leaderboard?contestId=${item.id}`);
  // "View Leaderboard" (ended contests) now points at Starboard — the
  // overall India leaderboard — rather than this contest's own final
  // standings screen; "View Live Standings" (still-active contests) keeps
  // going to the per-contest leaderboard, unchanged.
  const goToStarboard = () => router.push("/starboard");

  const handleJoin = async (andGoToLesson: boolean) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) { alert("Please log in to join this contest."); return; }
    setJoining(true);
    try {
      const result = await joinContest(uid, item);
      if (result.status === "insufficient_balance") {
        onInsufficientBalance({ required: result.required, balance: result.balance, contestTitle: item.title });
        return;
      }
      if (andGoToLesson) goToLesson();
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={{
      marginBottom: 18, borderRadius: 24,
      background: "linear-gradient(180deg, #ffffff, #f8faff)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
      border: "1px solid rgba(255,255,255,0.6)",
      overflow: "hidden",
    }}>
      {/* Banner header — real per-contest theme, falls back to generic */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${banner?.gradientStart ?? "#1a0a2e"}, ${banner?.gradientEnd ?? "#7c3aed"})`,
        padding: "18px 20px 16px",
      }}>
        <div style={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)", top: -50, right: -30 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, position: "relative" }}>
          {isLive ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(239,68,68,0.25)", border: "1px solid rgba(252,165,165,0.4)",
              padding: "4px 8px", borderRadius: 12,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#fecaca" }}>LIVE</span>
            </div>
          ) : <div />}
          {isCompleted && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#6ee7b7" }}>✓</span>
              <span style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 700 }}>Completed</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: 36, marginBottom: 6, position: "relative" }}>{banner?.emoji ?? "🌟"}</div>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, position: "relative" }}>{item.title}</div>
        {banner?.tagline && (
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontStyle: "italic", marginTop: 4, position: "relative" }}>
            {banner.tagline}
          </div>
        )}
      </div>

      <div style={{ padding: 20 }}>

        {/* Prize */}
        {prize && (
          <div style={{
            display: "flex", alignItems: "center",
            background: "var(--bg-card)", padding: 10, borderRadius: 14,
            border: "1px solid var(--border)", gap: 8, marginBottom: 10,
          }}>
            <span style={{ fontSize: 20, color: "#f59e0b" }}>🏆</span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Prize</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginLeft: "auto" }}>
              {formatPrize(prize)}
            </span>
          </div>
        )}

        {/* V-Coins entry fee / sponsored */}
        {item.isSponsored ? (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10,
            background: "#d1fae5", padding: "5px 10px", borderRadius: 10,
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>
              🎉 Sponsored{item.sponsorName ? ` by ${item.sponsorName}` : ""} — Free Entry
            </span>
          </div>
        ) : vCoinFee > 0 ? (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 10,
            background: "#fffbeb", padding: "5px 10px", borderRadius: 10, border: "1px solid #fde68a",
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#b45309" }}>🪙 {vCoinFee} V-Coins to join</span>
          </div>
        ) : (
          <div style={{ display: "inline-flex", marginBottom: 10, background: "#ecfdf5", padding: "5px 10px", borderRadius: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>✅ Free to join</span>
          </div>
        )}

        {/* Spots */}
        {(item.joinedCount != null || item.totalSpots != null) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 15, color: "var(--text-muted)" }}>👥</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
              {item.joinedCount ?? 0} / {item.totalSpots ?? "∞"} joined
            </span>
          </div>
        )}

        {/* Completed — topic + date chips */}
        {isCompleted && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <InfoChip icon="📚" text={item.description || item.title} />
            {(end || start) && <InfoChip icon="📅" text={formatChipDate((end ?? start)!)} />}
          </div>
        )}

        {/* Progress bar */}
        {isLive && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#4f46e5", borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
              {endsIn != null ? `⏰ ${formatCountdown(endsIn)} left` : "Ending soon"}
            </div>
          </div>
        )}

        {/* CTA logic (mirrors mobile exactly, every action now wired) */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Ended + completed quiz */}
          {isCompleted && isEnded && (
            <>
              <ActionButton title="📊 View Result" gradient={["#10b981", "#059669"]} onClick={goToResult} />
              <button onClick={goToStarboard} style={{
                padding: "9px 0", borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)",
                background: "#1e1b4b", color: "#a5b4fc", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                🏅 View Leaderboard
              </button>
            </>
          )}

          {/* Ended + joined but didn't complete */}
          {isJoined && !isCompleted && isEnded && (
            <button onClick={goToStarboard} style={{
              padding: "9px 0", borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)",
              background: "#1e1b4b", color: "#a5b4fc", fontSize: 12, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              🏅 View Leaderboard
            </button>
          )}

          {/* Active, completed quiz */}
          {isCompleted && !isEnded && (
            <>
              <ActionButton title="📊 View Result" gradient={["#10b981", "#059669"]} onClick={goToResult} />
              <button onClick={goToLeaderboard} style={{
                padding: "9px 0", borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)",
                background: "#1e1b4b", color: "#a5b4fc", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                🏅 View Live Standings
              </button>
            </>
          )}

          {/* Active — joined */}
          {!isCompleted && isLive && isJoined && (
            <ActionButton title="▶ Continue Lesson" gradient={["#4f46e5", "#3730a3"]} onClick={goToLesson} />
          )}

          {/* Active — not joined. The lesson itself is generated lazily (in
              the student's own language) the moment they open it, so
              there's no "lesson not ready" state to gate on here anymore —
              Join always leads straight to it. */}
          {!isCompleted && isLive && !isJoined && (
            <ActionButton
              title="⚡ Join Now" gradient={["#6366f1", "#4f46e5"]}
              disabled={joining} loading={joining} loadingTitle="Joining…"
              onClick={() => handleJoin(true)}
            />
          )}

          {/* Upcoming — starting within 2 days: live day/hour/minute
              countdown timer. Further out: the plain start date instead
              (a live countdown that's still a day+ away isn't useful, and
              "coming in 2 days" is exactly the window the user asked for
              the timer to appear in). */}
          {isUpcoming && (
            isWithinTwoDays
              ? <TimerBadge text={startsIn != null ? `Starts in ${formatCountdownDHM(startsIn)}` : "Starting soon…"} />
              : <TimerBadge icon="📅" tone="date" text={`Starts ${formatChipDate(start!)}`} />
          )}

          {/* Upcoming — not joined: Reserve Spot, alongside the timer/date
              badge above (both near and far upcoming contests still need a
              way to actually join). */}
          {isUpcoming && !isJoined && (
            <ActionButton
              title="📅 Reserve Spot" gradient={["#6366f1", "#4f46e5"]}
              disabled={joining} loading={joining} loadingTitle="Reserving your spot…"
              onClick={() => handleJoin(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function VidyaStarPage() {
  const { studentProfile } = useStudentProfile();
  const userId = getAuth().currentUser?.uid ?? "";
  const { contests, loading } = useContests();
  const { joined, completed } = useUserContests(userId);
  const prizesByPeriod = usePrizesByPeriod();
  const [chip, setChip] = useState("all");
  const [earnMore, setEarnMore] = useState<{ required: number; balance: number; contestTitle?: string } | null>(null);

  const userClass = studentProfile?.class != null ? String(studentProfile.class) : null;
  const now       = new Date();

  // FIX: admin writes targetClass (e.g. ["6","7"] or ["all"]) — this
  // previously checked "class", a field nothing ever sets, so the class
  // filter silently passed every contest through regardless of the
  // student's class. Same bug existed on mobile, fixed there too.
  const classFiltered = (contests as Contest[]).filter((c) => {
    if (!userClass) return true;
    if (!c.targetClass) return true;
    const classes = Array.isArray(c.targetClass) ? c.targetClass : [c.targetClass];
    return classes.includes(userClass) || classes.includes("all");
  });

  // Contests are no longer filtered by language — every student sees every
  // contest, and the AI lesson is generated lazily in each viewing
  // student's own preferredLanguage the first time they open it.
  // Hide ended contests never participated in
  const visible = classFiltered.slice(0, 10).filter((c) => {
    const end     = getDate(c.endTime ?? c.endDate);
    const isEnded = end && end < now;
    const participated = !!joined[c.id] || !!completed[c.id];
    return !(isEnded && !participated);
  });

  const live     = visible.filter((c) => { const s = getDate(c.startTime ?? c.startDate); const e = getDate(c.endTime ?? c.endDate); return s && e && s <= now && now <= e; });
  // Excludes contests the student has already completed (mirrors mobile's
  // vidyastar.tsx fix) — without this, a contest reused/rescheduled for a
  // later round (same id, pushed-out start date, but an old completed[]
  // entry still on record) would show under the Upcoming chip while its
  // own card renders the "✅ Completed" state.
  const upcoming = visible.filter((c) => { const s = getDate(c.startTime ?? c.startDate); return s && s > now && !completed[c.id]; });
  const done     = visible.filter((c) => !!completed[c.id]);

  const data =
    chip === "all"       ? visible.filter((c) => { const e = getDate(c.endTime ?? c.endDate); return !e || e >= now; })
    : chip === "live"      ? live
    : chip === "upcoming"  ? upcoming
    : done;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #4f46e5", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      {/* Admin banners (Banners.tsx) */}
      <BannerCarousel screen="vidyastar" />

      {/* Chip row */}
      <div style={{ padding: "10px 16px", display: "flex", overflowX: "auto" }}>
        {(["all", "live", "upcoming", "completed"] as const).map((c) => (
          <Chip key={c} label={c.charAt(0).toUpperCase() + c.slice(1)} active={chip === c} onClick={() => setChip(c)} />
        ))}
      </div>

      {/* Contest list */}
      <div style={{ padding: 16, paddingBottom: 40 }}>
        {data.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 12 }}>
            <span style={{ fontSize: 48 }}>🏆</span>
            <p style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 600, textAlign: "center" }}>
              {chip === "completed" ? "You haven't completed any contests yet." : "No contests available right now."}
            </p>
          </div>
        ) : (
          data.map((item) => (
            <ContestCard
              key={item.id} item={item} joined={joined} completed={completed}
              prize={item.periodKey ? topPrize(prizesByPeriod[item.periodKey]) : null}
              language={studentProfile?.preferredLanguage ?? "English"}
              onInsufficientBalance={setEarnMore}
            />
          ))
        )}
      </div>
      <EarnMoreVCoinsModal
        visible={!!earnMore}
        onClose={() => setEarnMore(null)}
        required={earnMore?.required ?? 0}
        balance={earnMore?.balance ?? 0}
        contestTitle={earnMore?.contestTitle}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
