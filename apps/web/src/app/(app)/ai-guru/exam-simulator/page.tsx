"use client";
// PATH: apps/web/src/app/(app)/ai-guru/exam-simulator/page.tsx
// Full rebuild against the real backend — port of mobile's
// app/ai-guru/exam-simulator.tsx. See services/examSimulatorApi.ts for the
// root-cause writeup (the old version called a non-existent endpoint and
// graded answers client-side instead of calling evaluateExam).
//
// Behavior now matches mobile exactly:
//   - All questions shown on one scrollable page (not a one-question wizard)
//   - A real countdown timer (estimatedMinutes from the exam) that
//     auto-submits when it hits zero
//   - Submission posts to evaluateExam — grading, weak/strong concepts,
//     board readiness %, and study plan all come from the server, not a
//     client-side correctAnswerIndex comparison
//   - "LIMIT_REACHED" is now a real error code from the server (the actual
//     server-side limiter — 1/day free, 20/day premium), not a useRef that
//     resets on page refresh

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStudentProfile } from "@gloows/shared-logic";
import { useTheme } from "@/context/ThemeContext";
import {
  generateExam, evaluateExam,
  type GeneratedExam, type ExamEvaluation,
} from "@/services/examSimulatorApi";
import { SUBJECTS, SUBJECT_ICONS, DIFFICULTIES } from "@/lib/aiGuru/constants";

type Phase = "setup" | "generating" | "exam" | "submitting" | "results" | "limit" | "error";

export default function ExamSimulatorPage() {
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();

  const bg      = isDarkMode ? "#060612" : colors.background;
  const surface = isDarkMode ? "#1e293b" : colors.card;
  const border  = isDarkMode ? "#334155" : colors.border;
  const text    = colors.text;
  const muted   = colors.textSecondary;
  const dim     = colors.textSecondary;

  const classLevel = String(studentProfile?.class ?? "10");
  const board       = (studentProfile?.board as string) ?? "CBSE";
  const language    = studentProfile?.preferredLanguage ?? "English";

  const [subject,    setSubject]    = useState("");
  const [chapter,    setChapter]    = useState("");
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>("Standard");

  const [phase,      setPhase]      = useState<Phase>("setup");
  const [exam,       setExam]       = useState<GeneratedExam | null>(null);
  const [answers,    setAnswers]    = useState<Record<number, number>>({});
  const [evaluation, setEvaluation] = useState<ExamEvaluation | null>(null);
  const [errMsg,     setErrMsg]     = useState("");
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);

  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const submitExam = useCallback(async () => {
    if (!exam) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("submitting");
    try {
      const answersArr = Object.entries(answers).map(([qId, sel]) => ({
        questionId: Number(qId),
        selectedIndex: sel,
      }));
      const result = await evaluateExam({ examId: exam.examId, answers: answersArr });
      setEvaluation(result);
      setPhase("results");
    } catch (e: any) {
      setErrMsg(e?.message ?? "Failed to evaluate exam");
      setPhase("error");
    }
  }, [exam, answers]);

  const startTimer = (minutes: number) => {
    setTimeLeft(minutes * 60);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          submitExam();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleGenerate = async () => {
    if (!subject || !chapter.trim()) {
      setErrMsg("Please pick a subject and enter the chapter name.");
      return;
    }
    setErrMsg("");
    setPhase("generating");
    try {
      const result = await generateExam({
        classLevel, board, subject, chapter: chapter.trim(),
        difficulty, language, questionCount: 15,
      });
      setExam(result);
      setAnswers({});
      setPhase("exam");
      startTimer(result.estimatedMinutes);
    } catch (e: any) {
      if (e?.code === "CREDITS_EXHAUSTED") {
        setCreditInfo({ balance: e.creditBalance ?? 0, required: e.creditsRequired ?? 1 });
        setPhase("limit");
      } else if (e?.code === "LIMIT_REACHED") {
        setCreditInfo(undefined);
        setPhase("limit");
      } else {
        setErrMsg(e?.message ?? "Failed to generate exam"); setPhase("setup");
      }
    }
  };

  const answeredCount  = Object.keys(answers).length;
  const totalQuestions = exam?.questions.length ?? 0;

  const sel = (active: boolean) => ({
    padding: "9px 14px", borderRadius: 14, cursor: "pointer",
    border: `1px solid ${active ? "#dc2626" : border}`,
    background: active ? "rgba(220,38,38,0.1)" : surface,
  });

  return (
    <div style={{ minHeight: "100dvh", background: bg, paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.ex-btn{cursor:pointer}.ex-btn:hover{opacity:.85}`}</style>

      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 8, borderBottom: `1px solid ${border}`, background: isDarkMode ? "rgba(6,6,18,0.98)" : "rgba(255,255,255,0.95)", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/ai-guru" style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: muted, fontSize: 20, fontWeight: 900 }}>‹</Link>
        <div style={{ flex: 1 }}>
          <div style={{ color: text, fontSize: 17, fontWeight: 900 }}>🎯 Exam Simulator</div>
          <div style={{ color: dim, fontSize: 11, marginTop: 1 }}>Board-pattern mock tests · AI-evaluated</div>
        </div>
        {phase === "exam" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, borderRadius: 20, border: `1px solid ${timeLeft < 120 ? "#ef4444" : border}`, padding: "5px 10px", background: timeLeft < 120 ? "rgba(239,68,68,0.15)" : surface }}>
            <span style={{ fontSize: 13 }}>⏱</span>
            <span style={{ color: timeLeft < 120 ? "#ef4444" : text, fontSize: 13, fontWeight: 800 }}>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {phase === "setup" && (
          <div>
            <div style={{ borderRadius: 20, padding: 22, marginBottom: 24, position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#450a0a,#7f1d1d,#dc2626)" }}>
              <div style={{ position: "absolute", width: 160, height: 160, borderRadius: 80, background: "rgba(255,255,255,0.08)", top: -40, right: -40 }} />
              <div style={{ fontSize: 36, marginBottom: 6 }}>🎯</div>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 900, marginBottom: 6 }}>Board-Pattern Mock Test</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.5 }}>
                AI generates {classLevel === "12" || classLevel === "10" ? "board-exact" : "curriculum-aligned"} questions, evaluates your answers, and predicts your board score
              </div>
            </div>

            <div style={{ color: muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>📚 Subject *</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginBottom: 20 }}>
              {SUBJECTS.map((s) => (
                <button key={s} className="ex-btn" onClick={() => setSubject(s)} style={{ ...sel(subject === s), display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 6px" }}>
                  <span style={{ fontSize: 22 }}>{SUBJECT_ICONS[s] ?? "📚"}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: subject === s ? "#fca5a5" : dim }}>{s}</span>
                </button>
              ))}
            </div>

            <div style={{ color: muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>📖 Chapter / Topic *</div>
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Photosynthesis, Quadratic Equations…"
              style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: `1px solid ${border}`, background: surface, color: text, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 20 }}
            />

            <div style={{ color: muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>⚡ Difficulty</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {DIFFICULTIES.map((d) => (
                <button key={d} className="ex-btn" onClick={() => setDifficulty(d)} style={{ ...sel(difficulty === d), flex: 1, textAlign: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: difficulty === d ? "#fca5a5" : text }}>{d}</span>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 12, border: `1px solid ${border}`, background: surface, padding: "10px 14px", marginBottom: 20 }}>
              <span style={{ fontSize: 14 }}>🏫</span>
              <span style={{ color: dim, fontSize: 12, fontWeight: 600 }}>Class {classLevel} · {board} · {language} · 15 Questions</span>
            </div>

            {errMsg && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 14 }}>{errMsg}</div>}

            <button
              className="ex-btn"
              onClick={handleGenerate}
              disabled={!subject || !chapter.trim()}
              style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: "linear-gradient(90deg,#7f1d1d,#dc2626)", color: "#fff", fontSize: 16, fontWeight: 800, opacity: subject && chapter.trim() ? 1 : 0.45 }}
            >
              ⚡ Generate Exam
            </button>
          </div>
        )}

        {phase === "generating" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#7f1d1d,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            </div>
            <div style={{ color: text, fontSize: 20, fontWeight: 800 }}>Generating your exam…</div>
            <div style={{ color: dim, fontSize: 13 }}>Creating {difficulty} {subject} questions for {board} Class {classLevel}</div>
          </div>
        )}

        {phase === "exam" && exam && (
          <div>
            <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 16 }}>
              <div style={{ color: text, fontSize: 16, fontWeight: 800, marginBottom: 10 }}>{exam.examTitle}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ padding: "4px 10px", borderRadius: 10, border: "1px solid #dc2626", background: "rgba(220,38,38,0.1)", fontSize: 11, fontWeight: 700, color: "#fca5a5" }}>{exam.totalMarks} marks</span>
                <span style={{ padding: "4px 10px", borderRadius: 10, border: `1px solid ${border}`, background: surface, fontSize: 11, fontWeight: 700, color: dim }}>{exam.estimatedMinutes} min</span>
                <span style={{ padding: "4px 10px", borderRadius: 10, border: `1px solid ${border}`, background: surface, fontSize: 11, fontWeight: 700, color: dim }}>{answeredCount}/{totalQuestions} done</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: border, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 4, background: "#dc2626", width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`, transition: "width .3s" }} />
              </div>
            </div>

            {exam.questions.map((q, qi) => (
              <div key={q.id} style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center",
                    background: answers[q.id] !== undefined ? "#dc2626" : border,
                    color: answers[q.id] !== undefined ? "#fff" : dim, fontSize: 12, fontWeight: 800,
                  }}>{qi + 1}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {q.boardImportance === "high" && (
                      <span style={{ padding: "3px 8px", borderRadius: 8, border: "1px solid #fbbf24", background: "rgba(251,191,36,0.15)", fontSize: 10, fontWeight: 700, color: "#fbbf24" }}>⭐ Important</span>
                    )}
                    <span style={{ color: dim, fontSize: 11, fontWeight: 600 }}>{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div style={{ color: text, fontSize: 15, fontWeight: 700, lineHeight: 1.5, marginBottom: 14 }}>{q.question}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {q.options.map((opt, oi) => {
                    const chosen = answers[q.id] === oi;
                    return (
                      <button key={oi} className="ex-btn" onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))} style={{
                        display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "12px 14px", borderRadius: 12,
                        border: `1px solid ${chosen ? "#dc2626" : border}`, background: chosen ? "rgba(220,38,38,0.12)" : "transparent",
                      }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%", border: `2px solid ${chosen ? "#dc2626" : border}`,
                          background: chosen ? "#dc2626" : "transparent", flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 14, color: chosen ? "#fca5a5" : text }}>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              className="ex-btn"
              onClick={() => {
                if (answeredCount < totalQuestions && !window.confirm(`You've answered ${answeredCount}/${totalQuestions} questions. Submit anyway?`)) return;
                submitExam();
              }}
              style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: "linear-gradient(90deg,#7f1d1d,#dc2626)", color: "#fff", fontSize: 15, fontWeight: 800 }}
            >
              Submit Exam ({answeredCount}/{totalQuestions})
            </button>
          </div>
        )}

        {phase === "submitting" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#7f1d1d,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            </div>
            <div style={{ color: text, fontSize: 20, fontWeight: 800 }}>Evaluating…</div>
            <div style={{ color: dim, fontSize: 13 }}>AI is grading your answers and analysing weak areas</div>
          </div>
        )}

        {phase === "results" && evaluation && (
          <div>
            <div style={{
              borderRadius: 20, padding: 24, marginBottom: 16, position: "relative", overflow: "hidden", textAlign: "center",
              background: evaluation.percentage >= 60 ? "linear-gradient(135deg,#052e16,#059669)" : "linear-gradient(135deg,#450a0a,#dc2626)",
            }}>
              <div style={{ position: "absolute", width: 160, height: 160, borderRadius: 80, background: "rgba(255,255,255,0.08)", top: -50, right: -50 }} />
              <div style={{ color: "#fff", fontSize: 40, fontWeight: 900 }}>{evaluation.grade}</div>
              <div style={{ color: "#fff", fontSize: 32, fontWeight: 900, marginTop: 4 }}>{evaluation.percentage}%</div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 6 }}>{evaluation.earnedMarks} / {evaluation.totalMarks} marks</div>
              <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{evaluation.performanceSummary}</div>
            </div>

            <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
              <div style={{ color: dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>📊 Board Exam Readiness</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: border, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, width: `${evaluation.boardReadiness}%`, background: evaluation.boardReadiness >= 60 ? "#10b981" : "#ef4444" }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: evaluation.boardReadiness >= 60 ? "#10b981" : "#ef4444" }}>{evaluation.boardReadiness}%</span>
              </div>
              <div style={{ color: muted, fontSize: 12, marginTop: 8 }}>Predicted board score: {evaluation.predictedBoardScore}</div>
            </div>

            {evaluation.weakConcepts.length > 0 && (
              <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
                <div style={{ color: dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>⚠️ Need More Practice</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {evaluation.weakConcepts.map((c) => (
                    <span key={c} style={{ padding: "5px 10px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", fontSize: 12, fontWeight: 700, color: "#ef4444" }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {evaluation.strongConcepts.length > 0 && (
              <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
                <div style={{ color: dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>✅ Strong Areas</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {evaluation.strongConcepts.slice(0, 6).map((c) => (
                    <span key={c} style={{ padding: "5px 10px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.1)", fontSize: 12, fontWeight: 700, color: "#10b981" }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
              <div style={{ color: dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>📋 Your Study Plan</div>
              {evaluation.studyPlan.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 11, background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: text, fontSize: 13, lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, borderRadius: 12, border: "1px solid #6366f1", background: "rgba(99,102,241,0.1)", padding: 14, marginBottom: 20 }}>
              <span style={{ fontSize: 16 }}>✨</span>
              <span style={{ color: muted, fontSize: 13, lineHeight: 1.5 }}>{evaluation.motivationalMessage}</span>
            </div>

            <button
              className="ex-btn"
              onClick={() => { setPhase("setup"); setExam(null); setEvaluation(null); setChapter(""); setAnswers({}); }}
              style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: "linear-gradient(90deg,#7f1d1d,#dc2626)", color: "#fff", fontSize: 15, fontWeight: 800, marginBottom: 10 }}
            >
              ↻ Take Another Exam
            </button>
            <Link href="/ai-guru/setup" style={{ display: "block", textAlign: "center", padding: "13px 0", borderRadius: 14, border: `1px solid ${border}`, color: "#818cf8", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              ✨ Generate Lesson on Weak Topics
            </Link>
          </div>
        )}

        {(phase === "limit" || phase === "error") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 14, textAlign: "center" }}>
            <span style={{ fontSize: 48 }}>{phase === "limit" ? "⏰" : "⚠️"}</span>
            <div style={{ color: text, fontSize: 19, fontWeight: 800 }}>{phase === "limit" ? "Daily limit reached" : "Something went wrong"}</div>
            <div style={{ color: dim, fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>
              {phase === "limit"
                ? (creditInfo
                    ? `You've used today's free exam. You have ${creditInfo.balance} credit${creditInfo.balance===1?"":"s"} — buy more or upgrade to Premium.`
                    : "You've used your free exam attempt for today. Upgrade to Premium for unlimited mock tests!")
                : errMsg}
            </div>
            {phase === "limit" ? (
              <>
                <Link href={creditInfo ? "/ai-guru/credits" : "/ai-guru/subscription"} style={{ width: "100%", maxWidth: 300, padding: "15px 0", borderRadius: 16, background: creditInfo ? "linear-gradient(90deg,#4f46e5,#7c3aed)" : "linear-gradient(90deg,#7f1d1d,#dc2626)", color: "#fff", fontSize: 15, fontWeight: 800, textAlign: "center", textDecoration: "none", display: "block" }}>
                  {creditInfo ? "⚡ Buy Credits" : "✨ Upgrade to Premium"}
                </Link>
                {creditInfo && (
                  <Link href="/ai-guru/subscription" style={{ color: "#a5b4fc", fontSize: 12, textDecoration: "none" }}>
                    Or upgrade to Premium for unlimited access
                  </Link>
                )}
              </>
            ) : (
              <button className="ex-btn" onClick={() => setPhase("setup")} style={{ padding: "12px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "none", color: "#dc2626", fontSize: 14, fontWeight: 700 }}>
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
