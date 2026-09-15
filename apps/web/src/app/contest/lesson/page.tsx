"use client";

// PATH: apps/web/src/app/contest/lesson/page.tsx
// Mirrors mobile app/contest/lesson.tsx — scene-by-scene AI lesson reader
// with quick-check questions, then routes to the quiz.
//
// Lives outside (app) like /reels and /mypost: mobile's contest screens are
// pushed full-screen routes, not nested in the tab layout.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/layout/AuthGuard";
import { auth, db } from "@/lib/firebase";
import { joinContest } from "@/services/joinContest";
import { getContestLesson } from "@/services/getContestLesson";
import { useStudentProfile } from "@gloows/shared-logic";
import { doc, getDoc } from "firebase/firestore";

interface Scene {
  sceneNumber: number;
  sceneTitle: string;
  narration: string;
  keyConcept: string;
  example: string;
  checkQuestion: {
    question: string;
    options: string[];
    correctAnswerIndex: number;
    explanation: string;
  };
}

const OPTION_LABELS = ["A", "B", "C", "D"];

// Mirrors the VidyaStar hub's getDate — contest docs store either Firestore
// Timestamps or ISO strings depending on how they were created.
function getDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

function SceneCard({ scene, total, onNext, isLast }: {
  scene: Scene; total: number; onNext: () => void; isLast: boolean;
}) {
  const [checkSelected, setCheckSelected] = useState<number | null>(null);
  const [checkRevealed, setCheckRevealed] = useState(false);

  const handleCheckAnswer = (idx: number) => {
    if (checkRevealed) return;
    setCheckSelected(idx);
    setCheckRevealed(true);
  };

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Scene header */}
      <div style={{ background: "linear-gradient(135deg, #1a0a2e, #312e81)", padding: "18px 20px" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
          Scene {scene.sceneNumber} / {total}
        </div>
        <div style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 900, lineHeight: 1.4 }}>{scene.sceneTitle}</div>
      </div>

      {/* Narration */}
      <div style={{ margin: "12px 16px 0", background: "#1e293b", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📖</span>
          <span style={{ color: "#6366f1", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Lesson</span>
        </div>
        <div style={{ color: "#cbd5e1", fontSize: 15, lineHeight: 1.6 }}>{scene.narration}</div>
      </div>

      {/* Key concept */}
      {scene.keyConcept && (
        <div style={{ margin: "12px 16px 0", background: "#1e293b", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8, borderLeft: "3px solid #f59e0b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Key Concept</span>
          </div>
          <div style={{ color: "#fde68a", fontSize: 14, lineHeight: 1.6, fontWeight: 600 }}>{scene.keyConcept}</div>
        </div>
      )}

      {/* Example */}
      {scene.example && (
        <div style={{ margin: "12px 16px 0", background: "#1e293b", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8, borderLeft: "3px solid #10b981" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>🧪</span>
            <span style={{ color: "#10b981", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Example</span>
          </div>
          <div style={{ color: "#86efac", fontSize: 14, lineHeight: 1.6 }}>{scene.example}</div>
        </div>
      )}

      {/* Check question */}
      {scene.checkQuestion?.question && (
        <div style={{ margin: "16px 16px 0", background: "#1e293b", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10, border: "1px solid #334155" }}>
          <div style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Quick Check</div>
          <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{scene.checkQuestion.question}</div>
          {scene.checkQuestion.options.map((opt, i) => {
            const isCorrect = checkRevealed && i === scene.checkQuestion.correctAnswerIndex;
            const isWrong = checkRevealed && checkSelected === i && i !== scene.checkQuestion.correctAnswerIndex;
            return (
              <button
                key={i}
                onClick={() => handleCheckAnswer(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  background: isCorrect ? "#052e16" : isWrong ? "#450a0a" : "#0f172a",
                  borderRadius: 12, padding: 12,
                  border: `1px solid ${isCorrect ? "#10b981" : isWrong ? "#ef4444" : "#334155"}`,
                  cursor: checkRevealed ? "default" : "pointer",
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: isCorrect ? "#064e3b" : isWrong ? "#7f1d1d" : "#334155",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#a5b4fc", fontWeight: 800, fontSize: 11,
                }}>{OPTION_LABELS[i]}</span>
                <span style={{ flex: 1, color: "#cbd5e1", fontSize: 14, fontWeight: (isCorrect || isWrong) ? 700 : 400 }}>{opt}</span>
                {isCorrect && <span style={{ color: "#10b981" }}>✓</span>}
                {isWrong && <span style={{ color: "#ef4444" }}>✕</span>}
              </button>
            );
          })}
          {checkRevealed && scene.checkQuestion.explanation && (
            <div style={{ background: "#0f172a", borderRadius: 10, padding: 12, borderLeft: "3px solid #6366f1" }}>
              <span style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>{scene.checkQuestion.explanation}</span>
            </div>
          )}
        </div>
      )}

      {/* Next / Start Quiz CTA */}
      <button
        onClick={onNext}
        style={{
          display: "block", width: "calc(100% - 32px)", margin: "20px 16px 0",
          borderRadius: 16, border: "none", padding: "16px 0",
          background: isLast ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #6366f1, #4f46e5)",
          color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: 0.5, cursor: "pointer",
        }}
      >
        {isLast ? "Take the Quiz →" : "Next Scene →"}
      </button>
    </div>
  );
}

function ContestLessonContent() {
  const searchParams = useSearchParams();
  const contestId = searchParams.get("contestId") ?? "";
  const router = useRouter();
  const { studentProfile } = useStudentProfile();

  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentScene, setCurrentScene] = useState(0);
  // "upcoming" | "ended" | null (null = live, i.e. playable). Set once the
  // contest doc loads — blocks a direct deep link (e.g. from browser
  // history, or a bookmark) from reaching lesson/quiz content outside the
  // contest's actual start/end window. The VidyaStar list already only
  // ever shows "Continue Lesson" while live, but that's just UI —
  // nothing previously stopped this page itself from loading regardless.
  const [notLive, setNotLive] = useState<"upcoming" | "ended" | null>(null);

  const [lesson, setLesson] = useState<{ lessonJson: any; bannerMeta: any } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!contestId) return;
    const userId = auth.currentUser?.uid;
    getDoc(doc(db, "contests", contestId)).then(async (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const data = { id: snap.id, ...snap.data() } as any;

      const now   = new Date();
      const start = getDate(data.startTime ?? data.startDate);
      const end   = getDate(data.endTime ?? data.endDate);
      const isLive = !!(start && start <= now && (!end || end > now));
      if (!isLive) {
        setContest(data);
        setNotLive(end && end < now ? "ended" : "upcoming");
        setLoading(false);
        return;
      }

      // Auto-join so students entering from the preview card are registered.
      // Also the path a direct link to /contest/lesson hits — without
      // checking the result, a student could reach paid-contest lesson
      // content without ever paying the V-Coins entry fee shown on the
      // VidyaStar page. Content is only set into state (and rendered) once
      // we know the join wasn't blocked for lack of V-Coins.
      if (userId) {
        const result = await joinContest(userId, data as { id: string }).catch(() => null);
        if (result?.status === "insufficient_balance") {
          alert(
            `Not enough V-Coins. This contest needs ${result.required} V-Coins — you have ${result.balance}. ` +
            `Earn more by watching reels, playing the Daily Streak Quiz, or joining a Skill Battle.`
          );
          router.replace("/vidyastar");
          setLoading(false);
          return;
        }
      }

      setContest(data);
      setLoading(false);
    });
  }, [contestId]);

  // The lesson is generated lazily, in the viewing student's own
  // preferredLanguage, the first time anyone in that language opens this
  // contest — cached after that. If another student in the same language
  // is already generating it (already-exists), poll every 3s rather than
  // showing an error, up to 10 attempts (~30s, matching how long a fresh
  // Gemini generation typically takes).
  useEffect(() => {
    if (!contest || !contestId || notLive) return;
    const language = studentProfile?.preferredLanguage ?? "English";
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const requestLesson = (attempt: number) => {
      setGenerating(true);
      setLessonError(null);
      getContestLesson(contestId, language)
        .then((res) => {
          if (cancelled) return;
          setLesson(res);
          setGenerating(false);
        })
        .catch((err: any) => {
          if (cancelled) return;
          const code = String(err?.code ?? "");
          if (code.endsWith("already-exists") && attempt < 10) {
            retryTimer = setTimeout(() => requestLesson(attempt + 1), 3000);
            return;
          }
          setGenerating(false);
          setLessonError(
            code.endsWith("already-exists")
              ? "This lesson is taking longer than expected."
              : "Couldn't load the lesson."
          );
        });
    };

    requestLesson(0);
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [contest, contestId, studentProfile?.preferredLanguage, retryTick]);

  const scenes: Scene[] = lesson?.lessonJson?.scenes ?? [];
  const lessonTitle: string = lesson?.lessonJson?.lessonTitle ?? contest?.title ?? "Lesson";
  const progressPct = scenes.length > 0 ? (currentScene / scenes.length) * 100 : 0;

  const handleNext = () => {
    if (currentScene + 1 < scenes.length) {
      setCurrentScene((i) => i + 1);
    } else {
      router.push(`/contest/quiz?contestId=${contestId}`);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "cl-spin 0.8s linear infinite" }} />
        <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600 }}>Loading lesson...</span>
        <style>{`@keyframes cl-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notLive) {
    const start = getDate(contest?.startTime ?? contest?.startDate);
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 56 }}>{notLive === "upcoming" ? "⏳" : "🏁"}</span>
        <span style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800 }}>
          {notLive === "upcoming" ? "Contest hasn't started yet" : "This contest has ended"}
        </span>
        <span style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
          {notLive === "upcoming"
            ? `You can play this contest once it goes live${start ? ` on ${start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Your spot is already reserved.`
            : "Contests can only be played while they're live."}
        </span>
        <button onClick={() => router.replace("/vidyastar")} style={{ marginTop: 8, background: "#1e293b", borderRadius: 14, padding: "12px 24px", border: "none", color: "#6366f1", fontWeight: 800, cursor: "pointer" }}>
          Back to VidyaStar
        </button>
      </div>
    );
  }

  if (generating) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "cl-spin 0.8s linear infinite" }} />
        <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600 }}>Generating your lesson...</span>
        <style>{`@keyframes cl-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (lessonError) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 56 }}>⚠️</span>
        <span style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800 }}>Couldn&apos;t load lesson</span>
        <span style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>{lessonError} Please try again.</span>
        <button onClick={() => setRetryTick((t) => t + 1)} style={{ marginTop: 8, background: "#1e293b", borderRadius: 14, padding: "12px 24px", border: "none", color: "#6366f1", fontWeight: 800, cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  if (!lesson?.lessonJson || scenes.length === 0) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 56 }}>⏳</span>
        <span style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800 }}>Lesson Unavailable</span>
        <span style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>Something went wrong generating this lesson. Please try again.</span>
        <button onClick={() => router.back()} style={{ marginTop: 8, background: "#1e293b", borderRadius: 14, padding: "12px 24px", border: "none", color: "#6366f1", fontWeight: 800, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0f172a" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10, background: "linear-gradient(90deg, #0f0c29, #1e1b4b)" }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 20 }}>
          ←
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lessonTitle}</span>
          <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: "#6366f1", borderRadius: 2, transition: "width 0.3s" }} />
          </div>
        </div>
        <div style={{ background: "rgba(99,102,241,0.2)", borderRadius: 10, padding: "4px 10px" }}>
          <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 800 }}>{currentScene + 1}/{scenes.length}</span>
        </div>
      </div>

      {/* Scene content */}
      <SceneCard
        key={currentScene}
        scene={scenes[currentScene]}
        total={scenes.length}
        onNext={handleNext}
        isLast={currentScene === scenes.length - 1}
      />
    </div>
  );
}

export default function ContestLessonPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0f172a" }} />}>
        <ContestLessonContent />
      </Suspense>
    </AuthGuard>
  );
}
