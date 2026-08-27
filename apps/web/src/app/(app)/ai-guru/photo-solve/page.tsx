"use client";
// PATH: apps/web/src/app/(app)/ai-guru/photo-solve/page.tsx
// Full rebuild against the real backend — port of mobile's
// app/ai-guru/photo-solve.tsx. See services/photoSolveApi.ts for the
// root-cause writeup (the old version called a nonexistent function name
// and rendered the response as plain text instead of the real structured
// step-by-step shape).
//
// Behavior now matches mobile: solving starts immediately once an image is
// picked (no separate "confirm" step), and the result shows the real
// structured solution — numbered steps, final answer, formula (if any),
// concept explanation + exam tip, and similar practice questions.

import { useRef, useState } from "react";
import Link from "next/link";
import { useStudentProfile } from "@gloows/shared-logic";
import { useTheme } from "@/context/ThemeContext";
import { solvePhotoQuestion, type PhotoSolveSolution } from "@/services/photoSolveApi";

type Phase = "pick" | "solving" | "result" | "limit" | "error";

export default function PhotoSolvePage() {
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

  const [phase,    setPhase]    = useState<Phase>("pick");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [solution, setSolution] = useState<PhotoSolveSolution | null>(null);
  const [errMsg,   setErrMsg]   = useState("");
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);

  const fileRef = useRef<HTMLInputElement>(null);
  const camRef  = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      const mimeType = file.type || "image/jpeg";
      solve(base64, mimeType);
    };
    reader.readAsDataURL(file);
  };

  const solve = async (base64: string, mimeType: string) => {
    setPhase("solving");
    setSolution(null);
    setErrMsg("");
    try {
      const result = await solvePhotoQuestion({ imageBase64: base64, imageMimeType: mimeType, classLevel, board, language });
      setSolution(result);
      setPhase("result");
    } catch (e: any) {
      if (e?.code === "CREDITS_EXHAUSTED") {
        setCreditInfo({ balance: e.creditBalance ?? 0, required: e.creditsRequired ?? 1 });
        setPhase("limit");
      } else if (e?.code === "LIMIT_REACHED") {
        setCreditInfo(undefined);
        setPhase("limit");
      } else {
        setErrMsg(e?.message ?? "Something went wrong"); setPhase("error");
      }
    }
  };

  const reset = () => { setPhase("pick"); setImageUrl(null); setSolution(null); setErrMsg(""); };

  return (
    <div style={{ minHeight: "100dvh", background: bg, paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .ps-btn{cursor:pointer}.ps-btn:hover{opacity:.85}`}</style>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />

      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 8, borderBottom: `1px solid ${border}`, background: isDarkMode ? "rgba(6,6,18,0.98)" : "rgba(255,255,255,0.95)", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/ai-guru" style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: muted, fontSize: 20, fontWeight: 900 }}>‹</Link>
        <span style={{ flex: 1, color: text, fontSize: 18, fontWeight: 900 }}>📸 Photo Solve</span>
        <div style={{ background: "rgba(217,119,6,0.15)", border: "1px solid rgba(217,119,6,0.3)", borderRadius: 10, padding: "4px 10px" }}>
          <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>⚡ Gemini Vision</span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {phase === "pick" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 32, gap: 16 }}>
            <div style={{ width: 120, height: 120, borderRadius: 28, background: "linear-gradient(135deg,#92400e,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>📸</div>
            <div style={{ color: text, fontSize: 22, fontWeight: 900, textAlign: "center" }}>Snap & Solve</div>
            <div style={{ color: dim, fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
              Take a photo of any question — maths, science, diagrams — and AI will solve it step by step in {language}.
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <button className="ps-btn" onClick={() => camRef.current?.click()} style={{ padding: "16px 0", borderRadius: 18, border: "2px solid #d97706", background: "rgba(217,119,6,0.12)", color: "#fbbf24", fontSize: 15, fontWeight: 800, width: "100%" }}>
                📷 Take a Photo
              </button>
              <button className="ps-btn" onClick={() => fileRef.current?.click()} style={{ padding: "16px 0", borderRadius: 18, border: `1px solid ${border}`, background: isDarkMode ? "rgba(255,255,255,0.04)" : colors.card, color: text, fontSize: 15, fontWeight: 700, width: "100%" }}>
                🖼️ Upload from Gallery
              </button>
            </div>
            <div style={{ color: dim, fontSize: 12, textAlign: "center" }}>Works best with clear, well-lit photos · JPG / PNG</div>
          </div>
        )}

        {phase === "solving" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 16 }}>
            {imageUrl && <img src={imageUrl} alt="Question" style={{ width: "100%", maxWidth: 280, borderRadius: 16, maxHeight: 220, objectFit: "contain", background: surface, marginBottom: 8 }} />}
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#92400e,#d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            </div>
            <div style={{ color: text, fontSize: 20, fontWeight: 800 }}>Analysing your question…</div>
            <div style={{ color: dim, fontSize: 13 }}>Gemini Vision is reading the image</div>
          </div>
        )}

        {phase === "result" && solution && (
          <div>
            {imageUrl && <img src={imageUrl} alt="Question" style={{ width: "100%", borderRadius: 16, maxHeight: 220, objectFit: "cover", marginBottom: 14 }} />}

            <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 10, border: "1px solid #6366f1", background: "rgba(99,102,241,0.15)", marginBottom: 14 }}>
              <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 800 }}>{solution.subject}</span>
            </span>

            <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
              <div style={{ color: dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>📖 Question Read</div>
              <div style={{ color: text, fontSize: 14, lineHeight: 1.6 }}>{solution.questionText}</div>
            </div>

            <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
              <div style={{ color: dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>🔢 Step-by-Step Solution</div>
              {solution.solution.steps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 11, background: "#d97706", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: text, fontSize: 14, lineHeight: 1.6 }}>{step}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, border: "1px solid #10b981", background: "rgba(16,185,129,0.1)", padding: 12, marginTop: 8 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ color: "#10b981", fontSize: 14, fontWeight: 700 }}>{solution.solution.finalAnswer}</span>
              </div>
              {solution.solution.formula && (
                <div style={{ borderRadius: 10, border: "1px solid #6366f1", background: "rgba(99,102,241,0.1)", padding: 12, marginTop: 8 }}>
                  <div style={{ color: dim, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Formula used</div>
                  <div style={{ color: "#a5b4fc", fontSize: 14, fontFamily: "monospace" }}>{solution.solution.formula}</div>
                </div>
              )}
            </div>

            <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
              <div style={{ color: dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>💡 Concept Explained</div>
              <div style={{ color: text, fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>{solution.conceptExplained}</div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, borderRadius: 10, border: "1px solid #fbbf24", background: "rgba(251,191,36,0.1)", padding: 10 }}>
                <span style={{ fontSize: 14 }}>💡</span>
                <span style={{ color: muted, fontSize: 12, lineHeight: 1.5 }}>{solution.examTip}</span>
              </div>
            </div>

            <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 16, marginBottom: 14 }}>
              <div style={{ color: dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>📝 Practice These Too</div>
              {solution.similarQuestions.map((q, i) => (
                <div key={i} style={{ borderTop: i > 0 ? `1px solid ${border}` : undefined, paddingTop: i > 0 ? 10 : 0, marginTop: i > 0 ? 10 : 0 }}>
                  <div style={{ color: text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{i + 1}. {q.question}</div>
                  <div style={{ color: dim, fontSize: 12 }}>💡 Hint: {q.hint}</div>
                </div>
              ))}
            </div>

            <button className="ps-btn" onClick={reset} style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "none", background: "linear-gradient(90deg,#92400e,#d97706)", color: "#fff", fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
              📷 Solve Another Question
            </button>
            <Link href="/ai-guru/setup" style={{ display: "block", textAlign: "center", padding: "13px 0", borderRadius: 14, border: `1px solid ${border}`, color: "#818cf8", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              ✨ Generate Full Lesson on this Topic
            </Link>
          </div>
        )}

        {phase === "limit" && (
          <div style={{ textAlign: "center", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 48 }}>⏰</span>
            <div style={{ color: text, fontSize: 19, fontWeight: 800 }}>Daily limit reached</div>
            <div style={{ color: dim, fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>
              {creditInfo
                ? `You've used today's free photo solves. You have ${creditInfo.balance} credit${creditInfo.balance===1?"":"s"} — buy more or upgrade to Premium for 50 solves/day.`
                : "You've used your free photo solves for today. Upgrade to Premium for 50 solves/day."}
            </div>
            <Link href={creditInfo ? "/ai-guru/credits" : "/ai-guru/subscription"} style={{ width: "100%", maxWidth: 300, padding: "15px 0", borderRadius: 16, background: creditInfo ? "linear-gradient(90deg,#4f46e5,#7c3aed)" : "linear-gradient(90deg,#92400e,#d97706,#fbbf24)", color: "#fff", fontSize: 15, fontWeight: 800, textAlign: "center", textDecoration: "none", display: "block" }}>
              {creditInfo ? "⚡ Buy Credits" : "⭐ Upgrade to Premium"}
            </Link>
            {creditInfo && (
              <Link href="/ai-guru/subscription" style={{ color: "#a5b4fc", fontSize: 12, textDecoration: "none" }}>
                Or upgrade to Premium for unlimited access
              </Link>
            )}
          </div>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 42 }}>⚠️</span>
            <div style={{ color: text, fontSize: 17, fontWeight: 800 }}>Couldn't solve this one</div>
            <div style={{ color: muted, fontSize: 13 }}>{errMsg}</div>
            <button className="ps-btn" onClick={reset} style={{ padding: "12px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "none", color: "#818cf8", fontSize: 14, fontWeight: 700 }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
