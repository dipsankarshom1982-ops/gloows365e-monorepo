"use client";

// PATH: apps/web/src/app/(app)/daily-streak-quiz/page.tsx
//
// Daily Streak Quiz — web. Exact mirror of mobile
// app/daily-streak-quiz/index.tsx, adapted to this app's web conventions:
// inline styles + CSS variables (var(--bg), var(--text), ...) instead of
// StyleSheet/colors object, plain <div>/<button> instead of RN components.
//
// IMPORTANT — V-Coins balance display:
// This page reads users/{uid} directly (vCoinsBalance + vCoins summed)
// rather than using hooks/useVCoins() as-was, because there are two
// separate, disconnected balance fields in this app: vCoinsBalance
// (written by services/vCoinsService.ts's creditVCoins(), used for reels/
// videos/contests/the registration bonus) and vCoins (written by the real
// claimVCoinReward Cloud Function, functions/src/vcoins.ts, used only by
// this Daily Streak Quiz feature). Nothing reconciles them server-side.
//
// FIX (bug report — "all updated v-coins must be shown in drawer and
// v-coins page properly"): hooks/useVCoins.ts, Drawer.tsx, and this page
// now all sum both fields the same way, so the number shown here matches
// the Wallet page and the drawer regardless of which reward pipeline
// credited the coins — previously this page showed vCoins alone and would
// under-report for anyone who'd also earned coins through reels/videos/
// contests/registration.
//
// XP: reads students/{uid}.LearnFunXP — the same field
// components/layout/Drawer.tsx already reads via useStudentProfile(), and
// the same field the submitDailyStreakQuizAnswer Cloud Function writes to.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentProfile } from "@gloows/shared-logic";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import {
  applyForAmbassadorProgram,
  fetchTodaysStreakQuizQuestion,
  subscribeToStreakProgress,
  submitStreakQuizAnswer,
  DAILY_STREAK_QUIZ_AMBASSADOR_WEEKS,
  DAILY_STREAK_QUIZ_MAX_WEEKLY_PROGRESS,
  type DailyStreakProgress,
  type DailyStreakQuizOption,
  type DailyStreakQuizSubmitResult,
  type PublicDailyStreakQuizQuestion,
} from "@/services/dailyStreakQuizService";

const OPTION_LETTERS: DailyStreakQuizOption[] = ["A", "B", "C", "D"];

type ScreenState = "loading" | "ready" | "no-question" | "error";

const QUOTES = [
  "Learn one thing every day.",
  "Small steps, every day, win the race.",
  "Curiosity is the engine of achievement.",
  "A little progress each day adds up to big results.",
  "Today's effort is tomorrow's strength.",
  "Consistency beats intensity.",
  "Every question answered is a step forward.",
];

function todayLabel(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function quoteOfTheDay(): string {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return QUOTES[dayIndex % QUOTES.length];
}

export default function DailyStreakQuizPage() {
  const router = useRouter();
  const { user } = useStudentProfile();

  const [screenState, setScreenState] = useState<ScreenState>("loading");
  const [question, setQuestion] = useState<PublicDailyStreakQuizQuestion | null>(null);
  const [selected, setSelected] = useState<DailyStreakQuizOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DailyStreakQuizSubmitResult | null>(null);
  const [progress, setProgress] = useState<DailyStreakProgress | null>(null);
  const [vCoins, setVCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load today's question ───────────────────────────────────────────────
  const loadQuestion = useCallback(async () => {
    try {
      setScreenState("loading");
      const q = await fetchTodaysStreakQuizQuestion();
      if (!q) {
        setQuestion(null);
        setScreenState("no-question");
        return;
      }
      setQuestion(q);
      setScreenState("ready");
      if (q.alreadySubmitted) setSelected(null);
    } catch (e) {
      console.error("[DailyStreakQuiz] load error:", e);
      setScreenState("error");
    }
  }, []);

  useEffect(() => {
    loadQuestion();
  }, [loadQuestion]);

  // ── Subscribe to streak/progress rollup ─────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToStreakProgress(setProgress);
    return unsub;
  }, []);

  // ── Subscribe to V-Coins (users/{uid}.vCoinsBalance + .vCoins, summed —
  // see file header FIX comment) + XP (students/{uid}.LearnFunXP) ──
  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirestore();
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) { setVCoins(0); return; }
      const d = snap.data();
      setVCoins((d.vCoinsBalance ?? 0) + (d.vCoins ?? 0));
    });
    const unsubStudent = onSnapshot(doc(db, "students", user.uid), (snap) => {
      setXp(snap.exists() ? (snap.data().LearnFunXP ?? 0) : 0);
    });
    return () => {
      unsubUser();
      unsubStudent();
    };
  }, [user?.uid]);

  useEffect(() => {
    return () => {
      if (confettiTimeout.current) clearTimeout(confettiTimeout.current);
    };
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!question || !selected || submitting || result) return;
    setSubmitting(true);
    try {
      const res = await submitStreakQuizAnswer(question.questionId, selected);
      setResult(res);
      if (res.isCorrect) {
        setShowConfetti(true);
        confettiTimeout.current = setTimeout(() => setShowConfetti(false), 2200);
      }
    } catch (e: any) {
      if (e?.code === "already-exists" || e?.message?.includes("already-exists")) {
        await loadQuestion();
      } else {
        console.error("[DailyStreakQuiz] submit error:", e);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyAmbassador = async () => {
    await applyForAmbassadorProgram();
  };

  const isLocked = !!result || (question?.alreadySubmitted ?? false);

  const optionState = (
    letter: DailyStreakQuizOption
  ): "default" | "selected" | "correct" | "incorrect" => {
    if (result) {
      if (letter === result.correctOption) return "correct";
      if (letter === selected && !result.isCorrect) return "incorrect";
      return "default";
    }
    return selected === letter ? "selected" : "default";
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80, position: "relative" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", fontSize: 22, padding: 4 }}
          aria-label="Back"
        >
          ‹
        </button>
        <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>🔥 Daily Streak Quiz</span>
        <div style={{ width: 22 }} />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
        <StreakStatsHeader
          currentStreak={progress?.currentStreak ?? 0}
          weeklyProgress={progress?.weeklyProgress ?? 0}
          completedWeeks={progress?.completedWeeks ?? 0}
          vCoinsBalance={vCoins}
          xp={xp}
        />

        {progress && progress.completedWeeks >= DAILY_STREAK_QUIZ_AMBASSADOR_WEEKS && (
          <div style={{ marginTop: 16 }}>
            <AmbassadorBanner
              alreadyApplied={!!progress.ambassadorAppliedAt}
              onApply={handleApplyAmbassador}
            />
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {screenState === "loading" && <QuizSkeleton />}
          {screenState === "error" && <ErrorState onRetry={loadQuestion} />}
          {screenState === "no-question" && <NoQuestionState />}

          {screenState === "ready" && question && (
            <div>
              <div
                style={{
                  display: "inline-block", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "5px 10px", marginBottom: 10,
                  background: "var(--bg-card)",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {question.subject}
                </span>
              </div>

              <div
                style={{
                  border: "1px solid var(--border)", borderRadius: 18, padding: 18,
                  marginBottom: 16, background: "var(--bg-card)",
                }}
              >
                <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.45, color: "var(--text)", margin: 0 }}>
                  {question.question}
                </p>
              </div>

              {question.alreadySubmitted && !result ? (
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    border: "1px solid var(--border)", borderRadius: 14, padding: 14,
                    background: "var(--bg-card)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>✅</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    You've already completed today's quiz. Come back tomorrow for a new question!
                  </span>
                </div>
              ) : (
                <>
                  <div>
                    {OPTION_LETTERS.map((letter) => {
                      const optionLabel =
                        letter === "A" ? question.optionA :
                        letter === "B" ? question.optionB :
                        letter === "C" ? question.optionC :
                        question.optionD;
                      return (
                        <OptionCard
                          key={letter}
                          letter={letter}
                          label={optionLabel}
                          state={optionState(letter)}
                          disabled={isLocked || submitting}
                          onClick={() => !isLocked && !submitting && setSelected(letter)}
                        />
                      );
                    })}
                  </div>

                  {!result && (
                    <button
                      onClick={handleSubmit}
                      disabled={!selected || submitting}
                      style={{
                        width: "100%", borderRadius: 16, padding: "15px 0",
                        border: "none", cursor: selected && !submitting ? "pointer" : "not-allowed",
                        marginTop: 6,
                        background: selected ? "var(--accent)" : "var(--border)",
                        color: "#fff", fontWeight: 800, fontSize: 15,
                      }}
                    >
                      {submitting ? "Submitting…" : "Submit Answer"}
                    </button>
                  )}

                  {result && <ResultPanel result={result} />}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showConfetti && <ConfettiOverlay />}
    </div>
  );
}

// ─── Streak stats header ────────────────────────────────────────────────────

function StreakStatsHeader({
  currentStreak, weeklyProgress, completedWeeks, vCoinsBalance, xp,
}: {
  currentStreak: number; weeklyProgress: number; completedWeeks: number;
  vCoinsBalance: number; xp: number;
}) {
  return (
    <div
      style={{
        borderRadius: 20, padding: 18,
        background: "linear-gradient(135deg, #1e1b4b, #3730a3)",
        display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <span style={{ color: "#c7d2fe", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
        {todayLabel()}
      </span>

      <div
        style={{
          display: "flex", alignItems: "center", gap: 16,
          background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: 14,
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <span style={{ color: "#fff", fontSize: 20, fontWeight: 900 }}>
            {currentStreak}/{DAILY_STREAK_QUIZ_MAX_WEEKLY_PROGRESS}
          </span>
          <span style={{ color: "#a5b4fc", fontSize: 10, fontWeight: 600 }}>Day Streak</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: DAILY_STREAK_QUIZ_MAX_WEEKLY_PROGRESS }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 8, borderRadius: 5,
                  background: i < weeklyProgress ? "#fbbf24" : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
          <span style={{ color: "#a5b4fc", fontSize: 10, fontWeight: 600 }}>Weekly Progress</span>
        </div>
      </div>

      <div
        style={{
          display: "flex", alignItems: "center",
          background: "rgba(0,0,0,0.3)", borderRadius: 14,
          padding: "12px 10px", border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {[
          { emoji: "🏆", value: completedWeeks, label: "Weeks Done" },
          { emoji: "🪙", value: vCoinsBalance, label: "V-Coins" },
          { emoji: "⚡", value: xp, label: "XP" },
        ].map((s, i, arr) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 17 }}>{s.emoji}</span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{s.value}</span>
              <span style={{ color: "#a5b4fc", fontSize: 9.5, fontWeight: 600 }}>{s.label}</span>
            </div>
            {i < arr.length - 1 && <div style={{ width: 1, height: 34, background: "rgba(255,255,255,0.18)" }} />}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "0 4px" }}>
        <span style={{ color: "#fbbf24", fontSize: 22, fontWeight: 900, lineHeight: "22px" }}>“</span>
        <span style={{ color: "#e0e7ff", fontSize: 13, fontWeight: 600, fontStyle: "italic", lineHeight: 1.4 }}>
          {quoteOfTheDay()}
        </span>
      </div>
    </div>
  );
}

// ─── Option card ────────────────────────────────────────────────────────────

function OptionCard({
  letter, label, state, disabled, onClick,
}: {
  letter: DailyStreakQuizOption; label: string;
  state: "default" | "selected" | "correct" | "incorrect";
  disabled?: boolean; onClick: () => void;
}) {
  const palette = {
    default:   { bg: "var(--bg-card)", border: "var(--border)", badgeBg: "rgba(148,163,184,0.15)", badgeText: "var(--text-muted)", text: "var(--text)" },
    selected:  { bg: "rgba(99,102,241,0.12)", border: "#6366f1", badgeBg: "#6366f1", badgeText: "#fff", text: "var(--text)" },
    correct:   { bg: "rgba(16,185,129,0.14)", border: "#10b981", badgeBg: "#10b981", badgeText: "#fff", text: "#10b981" },
    incorrect: { bg: "rgba(239,68,68,0.14)", border: "#ef4444", badgeBg: "#ef4444", badgeText: "#fff", text: "#ef4444" },
  }[state];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        border: `1.5px solid ${palette.border}`, borderRadius: 16,
        padding: "14px", marginBottom: 12,
        background: palette.bg, cursor: disabled ? "default" : "pointer",
        opacity: disabled && state === "default" ? 0.55 : 1,
      }}
    >
      <span
        style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: palette.badgeBg, color: palette.badgeText, fontWeight: 800, fontSize: 14,
        }}
      >
        {letter}
      </span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: palette.text }}>
        {label}
      </span>
      {state === "correct" && <span style={{ fontSize: 16 }}>✅</span>}
      {state === "incorrect" && <span style={{ fontSize: 16 }}>❌</span>}
    </button>
  );
}

// ─── Result panel ───────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: DailyStreakQuizSubmitResult }) {
  return (
    <div
      style={{
        border: `1.5px solid ${result.isCorrect ? "#10b981" : "#ef4444"}`,
        borderRadius: 18, padding: 18, marginTop: 8,
        background: result.isCorrect ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>
        {result.isCorrect ? "✅ Correct Answer!" : "❌ Wrong Answer"}
      </span>

      {result.isCorrect ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>🔥 Daily Streak Updated</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>🪙 +{result.vCoinsAwarded} VCoins Added</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>⭐ +{result.xpAwarded} XP Added</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Correct answer: Option {result.correctOption}
          </span>
          {!!result.explanation && (
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", lineHeight: 1.5 }}>
              💡 {result.explanation}
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <span style={{ fontSize: 13 }}>🔒</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
          Today's quiz is locked. Come back tomorrow!
        </span>
      </div>
    </div>
  );
}

// ─── Ambassador banner ──────────────────────────────────────────────────────

function AmbassadorBanner({
  alreadyApplied, onApply,
}: { alreadyApplied: boolean; onApply: () => Promise<void> }) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(alreadyApplied);

  const handleApply = async () => {
    if (applied || applying) return;
    setApplying(true);
    try {
      await onApply();
      setApplied(true);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 20, padding: 20, textAlign: "center",
        background: "linear-gradient(135deg, #92400e, #d97706, #fbbf24)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}
    >
      <span style={{ fontSize: 40 }}>🏆</span>
      <span style={{ color: "#fff", fontSize: 19, fontWeight: 900 }}>Congratulations!</span>
      <p style={{ color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 600, lineHeight: 1.5, margin: "0 0 6px" }}>
        You have successfully completed 52 Weekly Learning Streaks. You are now
        eligible to apply for the Gloows365 Student Ambassador Program.
      </p>
      <button
        onClick={handleApply}
        disabled={applied || applying}
        style={{
          background: applied ? "rgba(255,255,255,0.5)" : "#fff",
          border: "none", borderRadius: 14, padding: "12px 28px", minWidth: 160,
          color: "#92400e", fontWeight: 800, fontSize: 14,
          cursor: applied || applying ? "default" : "pointer",
        }}
      >
        {applying ? "…" : applied ? "✓ Applied" : "Apply Now"}
      </button>
    </div>
  );
}

// ─── Loading / error / empty states ─────────────────────────────────────────

// Question generation can take a few seconds (translation on first request
// for the student's language — see fetchTodaysStreakQuizQuestion's retry
// loop), so this needs to unmistakably read as "working", not "frozen": a
// spinner + label up top, plus an actual shimmer sweep on the placeholder
// blocks instead of a flat static tint.
function QuizSkeleton() {
  const shimmer: React.CSSProperties = {
    background: "linear-gradient(90deg, var(--bg-card) 25%, rgba(148,163,184,0.15) 50%, var(--bg-card) 75%)",
    backgroundSize: "200% 100%",
    animation: "dsq-shimmer 1.4s infinite",
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 18, height: 18, borderRadius: "50%",
          border: "2.5px solid var(--border)", borderTopColor: "var(--accent)",
          animation: "dsq-spin 0.8s linear infinite",
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
          Loading today's question…
        </span>
      </div>
      <div style={{ ...shimmer, width: 90, height: 22, borderRadius: 10, marginBottom: 10 }} />
      <div style={{ ...shimmer, height: 80, borderRadius: 18, marginBottom: 16 }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ ...shimmer, height: 58, borderRadius: 16, marginBottom: 12 }} />
      ))}
      <style>{`
        @keyframes dsq-spin    { to { transform: rotate(360deg); } }
        @keyframes dsq-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        textAlign: "center", border: "1px solid var(--border)", borderRadius: 18,
        padding: 28, background: "var(--bg-card)",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>Something went wrong</div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", lineHeight: 1.5, margin: "8px 0 16px" }}>
        We couldn't load today's quiz. Please check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        style={{
          background: "var(--accent)", border: "none", borderRadius: 12,
          padding: "10px 20px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
        }}
      >
        Try Again
      </button>
    </div>
  );
}

function NoQuestionState() {
  return (
    <div
      style={{
        textAlign: "center", border: "1px solid var(--border)", borderRadius: 18,
        padding: 28, background: "var(--bg-card)",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }}>🗓️</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>No quiz today</div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", lineHeight: 1.5, margin: "8px 0 0" }}>
        There's no Daily Streak Quiz published for your class yet. Check back soon!
      </p>
    </div>
  );
}

// ─── Confetti overlay ────────────────────────────────────────────────────────
// CSS-animation confetti — no new dependency, mirrors mobile's Reanimated
// ConfettiBurst but using @keyframes since this is the web app.

const CONFETTI_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#f97316"];
const CONFETTI_PIECES = 36;

function ConfettiOverlay() {
  const pieces = Array.from({ length: CONFETTI_PIECES }, (_, i) => {
    const left = (i * 97) % 100;
    const delay = (i * 13) % 220;
    const duration = 1.4 + ((i * 31) % 900) / 1000;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const size = 6 + (i % 3) * 3;
    const isCircle = i % 2 === 0;
    return { id: i, left, delay, duration, color, size, isCircle };
  });

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 999 }}>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? "50%" : 2,
            animation: `dsq-confetti-fall ${p.duration}s ease-out ${p.delay}ms forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes dsq-confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translateY(80vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
