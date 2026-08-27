"use client";

// PATH: apps/web/src/app/contest/quiz/page.tsx
// Mirrors mobile app/contest/quiz.tsx — timed MCQ quiz, 30s per question,
// auto-advances on timeout, submits via submitContestQuiz.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/layout/AuthGuard";
import { auth, db } from "@/lib/firebase";
import { submitContestQuiz, QuizAnswer } from "@/services/submitContestQuiz";
import { useStudentProfile } from "@gloows/shared-logic";
import { doc, getDoc } from "firebase/firestore";

const SECONDS_PER_Q = 30;
const OPTION_LABELS = ["A", "B", "C", "D"];

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  difficulty?: string;
  concept?: string;
}

function diffBg(d?: string) {
  if (d === "easy") return "#064e3b";
  if (d === "hard") return "#450a0a";
  return "#1e3a5f";
}

// Mirrors the VidyaStar hub's getDate — contest docs store either Firestore
// Timestamps or ISO strings depending on how they were created.
function getDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

function ContestQuizContent() {
  const searchParams = useSearchParams();
  const contestId = searchParams.get("contestId") ?? "";
  const router = useRouter();
  const userId = auth.currentUser?.uid;
  const { studentProfile } = useStudentProfile();

  const [questions, setQuestions]   = useState<Question[]>([]);
  const [loading, setLoading]       = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers]       = useState<QuizAnswer[]>([]);
  const [selected, setSelected]     = useState<number | null>(null);
  const [locked, setLocked]         = useState(false);
  const [timeLeft, setTimeLeft]     = useState(SECONDS_PER_Q);
  const [submitting, setSubmitting] = useState(false);
  // "upcoming" | "ended" | null (null = live, i.e. playable) — same deep-
  // link guard as the lesson page: this is the actual scoring entry point,
  // so it's the more important of the two to gate. Reachable directly via
  // browser back/forward even if the lesson page already turned someone
  // away once.
  const [notLive, setNotLive] = useState<"upcoming" | "ended" | null>(null);
  const [contestStart, setContestStart] = useState<Date | null>(null);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionStart = useRef<number>(Date.now());

  // Load the quiz from the same per-language cached lesson doc the lesson
  // page just generated/read (contests/{id}/lessons/{language} — see
  // functions/src/contestLesson.ts). Redirect if already completed.
  useEffect(() => {
    if (!contestId || !userId) return;
    (async () => {
      const language = studentProfile?.preferredLanguage ?? "English";
      const [contestSnap, lessonSnap, participantSnap] = await Promise.all([
        getDoc(doc(db, "contests", contestId)),
        getDoc(doc(db, "contests", contestId, "lessons", language)),
        getDoc(doc(db, "contests", contestId, "participant", userId)),
      ]);

      if (participantSnap.exists() && participantSnap.data()?.completed) {
        router.replace(`/contest/result?contestId=${contestId}`);
        return;
      }

      if (contestSnap.exists()) {
        const c     = contestSnap.data();
        const now   = new Date();
        const start = getDate(c.startTime ?? c.startDate);
        const end   = getDate(c.endTime ?? c.endDate);
        const isLive = !!(start && start <= now && (!end || end > now));
        if (!isLive) {
          setContestStart(start);
          setNotLive(end && end < now ? "ended" : "upcoming");
          setLoading(false);
          return;
        }
      }

      if (lessonSnap.exists()) {
        const quiz: Question[] = lessonSnap.data()?.lessonJson?.quiz ?? [];
        setQuestions(quiz);
      }
      setLoading(false);
    })();
  }, [contestId, userId, router, studentProfile?.preferredLanguage]);

  const handleAdvance = (selectedIdx: number | null, q: Question, idx: number, currentAnswers: QuizAnswer[]) => {
    const correct = selectedIdx !== null && selectedIdx === q.correctAnswerIndex;
    const timeTakenSeconds = Math.min(
      SECONDS_PER_Q,
      Math.round((Date.now() - questionStart.current) / 1000)
    );

    const newAnswers: QuizAnswer[] = [
      ...currentAnswers,
      { questionIndex: idx, selectedIndex: selectedIdx, correct, timeTakenSeconds },
    ];
    setAnswers(newAnswers);

    if (idx + 1 < questions.length) {
      setCurrentIdx(idx + 1);
      setSelected(null);
      setLocked(false);
    } else {
      finishQuiz(newAnswers);
    }
  };

  // Timer per question
  useEffect(() => {
    if (loading || locked || questions.length === 0) return;

    questionStart.current = Date.now();
    setTimeLeft(SECONDS_PER_Q);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAdvance(null, questions[currentIdx], currentIdx, answers);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, loading, questions.length]);

  const handleSelect = (idx: number) => {
    if (locked) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(idx);
    setLocked(true);
    advanceTimerRef.current = setTimeout(() => handleAdvance(idx, questions[currentIdx], currentIdx, answers), 1200);
  };

  useEffect(() => () => { if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current); }, []);

  const finishQuiz = async (finalAnswers: QuizAnswer[]) => {
    if (!userId || !contestId) return;
    setSubmitting(true);
    try {
      const { score, rank } = await submitContestQuiz(contestId, userId, finalAnswers);
      router.replace(`/contest/result?contestId=${contestId}&score=${score}&total=${questions.length}&rank=${rank}`);
    } catch {
      router.replace(`/contest/result?contestId=${contestId}&score=0&total=${questions.length}`);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "cq-spin 0.8s linear infinite" }} />
        <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600 }}>Loading quiz...</span>
        <style>{`@keyframes cq-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notLive) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 56 }}>{notLive === "upcoming" ? "⏳" : "🏁"}</span>
        <span style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800 }}>
          {notLive === "upcoming" ? "Contest hasn't started yet" : "This contest has ended"}
        </span>
        <span style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
          {notLive === "upcoming"
            ? `You can play this contest once it goes live${contestStart ? ` on ${contestStart.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.`
            : "Contests can only be played while they're live."}
        </span>
        <button onClick={() => router.replace("/vidyastar")} style={{ marginTop: 8, background: "#1e293b", borderRadius: 14, padding: "12px 24px", border: "none", color: "#6366f1", fontWeight: 800, cursor: "pointer" }}>
          Back to VidyaStar
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 56 }}>❓</span>
        <span style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800 }}>No Quiz Available</span>
        <span style={{ color: "#6b7280", fontSize: 14 }}>The quiz for this contest hasn&apos;t been generated yet.</span>
        <button onClick={() => router.back()} style={{ marginTop: 8, background: "#1e293b", borderRadius: 14, padding: "12px 24px", border: "none", color: "#6366f1", fontWeight: 800, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    );
  }

  if (submitting) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "cq-spin2 0.8s linear infinite" }} />
        <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600 }}>Submitting your answers...</span>
        <style>{`@keyframes cq-spin2 { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const q = questions[currentIdx];
  const timerDanger = timeLeft <= 10;
  const progressPct = (timeLeft / SECONDS_PER_Q) * 100;

  return (
    <div style={{ minHeight: "100dvh", background: "#0f172a", paddingBottom: 80 }}>
      {/* Progress + Timer header */}
      <div style={{ padding: "12px 20px 14px", display: "flex", flexDirection: "column", gap: 10, background: "linear-gradient(90deg, #0f0c29, #302b63)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 800 }}>Question {currentIdx + 1} / {questions.length}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: timerDanger ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.2)", borderRadius: 10, padding: "4px 10px" }}>
            <span style={{ fontSize: 13 }}>⏱</span>
            <span style={{ color: timerDanger ? "#fca5a5" : "#a5b4fc", fontSize: 13, fontWeight: 800 }}>{timeLeft}s</span>
          </div>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "#6366f1", borderRadius: 4, transition: "width 1s linear" }} />
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {questions.map((_, i) => (
            <div key={i} style={{
              width: i === currentIdx ? 20 : 8, height: 8, borderRadius: 4,
              background: i < currentIdx ? "#10b981" : i === currentIdx ? "#6366f1" : "rgba(255,255,255,0.2)",
              transition: "width 0.2s",
            }}/>
          ))}
        </div>
      </div>

      {/* Question */}
      <div style={{ margin: 16, background: "#1e293b", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        {q.difficulty && (
          <span style={{ alignSelf: "flex-start", borderRadius: 8, padding: "4px 10px", background: diffBg(q.difficulty) }}>
            <span style={{ color: "#a5b4fc", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{q.difficulty.toUpperCase()}</span>
          </span>
        )}
        <span style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, lineHeight: 1.55 }}>{q.question}</span>
        {q.concept && <span style={{ color: "#475569", fontSize: 12, fontStyle: "italic" }}>Topic: {q.concept}</span>}
      </div>

      {/* Options */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect  = locked && i === q.correctAnswerIndex;
          const isWrong    = locked && isSelected && !isCorrect;
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              style={{
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                background: isCorrect ? "#052e16" : isWrong ? "#450a0a" : "#1e293b",
                borderRadius: 16, padding: 14,
                border: `1px solid ${isCorrect ? "#10b981" : isWrong ? "#ef4444" : isSelected ? "#6366f1" : "#334155"}`,
                cursor: locked ? "default" : "pointer",
              }}
            >
              <span style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: isCorrect ? "#064e3b" : isWrong ? "#7f1d1d" : "#334155",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#a5b4fc", fontWeight: 800, fontSize: 13,
              }}>{OPTION_LABELS[i]}</span>
              <span style={{ flex: 1, color: "#cbd5e1", fontSize: 15, lineHeight: 1.5, fontWeight: (isCorrect || isWrong) ? 700 : 400 }}>{opt}</span>
              {isCorrect && <span style={{ color: "#10b981", fontSize: 18 }}>✓</span>}
              {isWrong && <span style={{ color: "#ef4444", fontSize: 18 }}>✕</span>}
            </button>
          );
        })}
      </div>

      {/* Score tracker */}
      <div style={{ position: "fixed", bottom: 16, left: 16, right: 16, background: "#1e293b", borderRadius: 12, padding: 12, textAlign: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>
          ✅ {answers.filter((a) => a.correct).length} correct &nbsp;·&nbsp;
          ❌ {answers.filter((a) => !a.correct && a.selectedIndex !== null).length} wrong &nbsp;·&nbsp;
          ⏩ {answers.filter((a) => a.selectedIndex === null).length} skipped
        </span>
      </div>
    </div>
  );
}

export default function ContestQuizPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0f172a" }} />}>
        <ContestQuizContent />
      </Suspense>
    </AuthGuard>
  );
}
