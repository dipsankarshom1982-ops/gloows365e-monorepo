"use client";
// PATH: apps/web/src/app/(app)/ai-guru/voice-tutor/page.tsx
// Rebuilt against the real backend — see services/voiceTutorApi.ts for the
// root-cause writeup (the old version called askAiGuruQuestion instead of
// the dedicated voiceTutorAnswer endpoint).
//
// Kept web's existing advantage over mobile: browser SpeechRecognition
// supports 13 Indian languages without any native-app language-pack
// dependency, vs mobile's 4 (English/Hindi/Bengali/Assamese) — narrowing
// that down to "match mobile exactly" would be a regression, not parity,
// since the backend prompt itself isn't limited to 4 languages either.
// What's fixed: the actual endpoint called, the response shape rendered
// (now shows keyPoints + a follow-up suggestion, like mobile does), and
// real server-enforced daily limits via the LIMIT_REACHED error code
// instead of a client-side counter that reset on every page refresh.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStudentProfile } from "@gloows/shared-logic";
import { useLanguage, useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { askVoiceTutor, type VoiceTutorResponse } from "@/services/voiceTutorApi";

const LANGUAGE_BCP47: Record<string, string> = {
  English: "en-IN", Bengali: "bn-IN", Hindi: "hi-IN", Tamil: "ta-IN",
  Telugu: "te-IN", Marathi: "mr-IN", Gujarati: "gu-IN", Assamese: "as-IN",
  Odia: "or-IN", Malayalam: "ml-IN", Kannada: "kn-IN", Punjabi: "pa-IN", Urdu: "ur-IN",
};

type Phase = "idle" | "listening" | "thinking" | "answer" | "error" | "limit";

export default function VoiceTutorPage() {
  const { studentProfile } = useStudentProfile();
  const { languageName } = useLanguage();
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const studentClass = String(studentProfile?.class ?? "10");
  const board        = (studentProfile?.board as string) ?? "CBSE";
  const firstName    = studentProfile?.name?.split(" ")[0] ?? "there";

  const [phase, setPhase]           = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse]     = useState<VoiceTutorResponse | null>(null);
  const [errMsg, setErrMsg]         = useState("");
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);
  const recognRef = useRef<any>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);

  const supported = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [response, phase]);

  function startListening() {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.lang = LANGUAGE_BCP47[languageName] ?? "en-IN";
    r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const transcriptText = e.results[0][0].transcript;
      setTranscript(transcriptText);
      askVoice(transcriptText);
    };
    r.onerror = (e: any) => { setErrMsg(t("micError", `Mic error: ${e.error}`, { error: e.error })); setPhase("error"); };
    r.onend = () => { if (phase === "listening") setPhase("idle"); };
    recognRef.current = r;
    r.start();
    setPhase("listening"); setTranscript(""); setErrMsg("");
  }

  function stopListening() { recognRef.current?.stop(); setPhase("idle"); }

  async function askVoice(question: string) {
    if (!question.trim()) return;
    setPhase("thinking");
    setResponse(null);
    try {
      const result = await askVoiceTutor({
        textQuestion: question,
        detectedLanguage: languageName,
        classLevel: studentClass,
        board,
      });
      setResponse(result);
      setPhase("answer");
      if ("speechSynthesis" in window) {
        const utt = new SpeechSynthesisUtterance(result.answer);
        utt.lang = LANGUAGE_BCP47[result.detectedLanguage ?? languageName] ?? "en-IN";
        window.speechSynthesis.speak(utt);
      }
    } catch (e: any) {
      if (e?.code === "CREDITS_EXHAUSTED") {
        setCreditInfo({ balance: e.creditBalance ?? 0, required: e.creditsRequired ?? 1 });
        setPhase("limit");
      } else if (e?.code === "LIMIT_REACHED") {
        setCreditInfo(undefined);
        setPhase("limit");
      } else {
        setErrMsg(e?.message ?? t("errorLabel", "Error")); setPhase("error");
      }
    }
  }

  function reset() { setPhase("idle"); setResponse(null); setTranscript(""); setErrMsg(""); }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#2e1065,#1a0040,#0f0020)" : colors.background, overflow: "hidden" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}} .vt-btn{cursor:pointer}.vt-btn:hover{opacity:.85}`}</style>

      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 8, borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : colors.border}`, flexShrink: 0 }}>
        <Link href="/ai-guru" style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.1)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: isDarkMode ? "#d8b4fe" : colors.accent, fontSize: 20, fontWeight: 900 }}>‹</Link>
        <span style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: 900 }}>🎙️ {t("voiceTutorTitle", "Voice Tutor")}</span>
        <div style={{ background: isDarkMode ? "rgba(168,85,247,0.2)" : "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 10, padding: "4px 10px" }}>
          <span style={{ color: isDarkMode ? "#d8b4fe" : "#7c3aed", fontSize: 11, fontWeight: 700 }}>🌐 {languageName}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {!response && phase !== "thinking" && phase !== "limit" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 16, textAlign: "center" }}>
            <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg,#6d28d9,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, boxShadow: "0 0 40px rgba(168,85,247,0.3)" }}>🎙️</div>
            <div style={{ color: colors.text, fontSize: 22, fontWeight: 900 }}>Hi {firstName}!</div>
            <div style={{ color: colors.textSecondary, fontSize: 14, maxWidth: 260, lineHeight: 1.6 }}>
              {t("tapMicAskAnything", `Tap the mic and ask me anything in ${languageName}. I'll answer in the same language!`, { language: languageName })}
            </div>
            {!supported && <div style={{ color: "#f59e0b", fontSize: 13, padding: "10px 16px", borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>{t("voiceNotSupported", "⚠️ Voice not supported in this browser. Use Chrome or Edge.")}</div>}
          </div>
        )}

        {transcript && (response || phase === "thinking") && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <div style={{ maxWidth: "82%", padding: "12px 16px", borderRadius: "18px 18px 4px 18px", background: "#6d28d9" }}>
              <div style={{ color: "#f1f5f9", fontSize: 14, lineHeight: 1.65 }}>{transcript}</div>
            </div>
          </div>
        )}

        {phase === "thinking" && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", animation: "pulse 1s ease-in-out infinite" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", animation: "pulse 1s ease-in-out .2s infinite" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", animation: "pulse 1s ease-in-out .4s infinite" }} />
            <span style={{ color: colors.textSecondary, fontSize: 12 }}>{t("aiGuruThinking", "AI Guru is thinking…")}</span>
          </div>
        )}

        {response && phase === "answer" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ borderRadius: 18, border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : colors.border}`, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: 14, background: "linear-gradient(135deg,#2e1065,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🎙️</span>
                <span style={{ color: colors.text, fontSize: 13, fontWeight: 800, flex: 1 }}>Voice Tutor</span>
                <span style={{ color: colors.textSecondary, fontSize: 11 }}>Answered in {response.detectedLanguage}</span>
              </div>
              <div style={{ color: colors.text, fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{response.answer}</div>

              {response.keyPoints?.length > 0 && (
                <>
                  <div style={{ height: 1, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.border, margin: "12px 0" }} />
                  <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Key Points</div>
                  {response.keyPoints.map((pt, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#a855f7" }}>✓</span>
                      <span style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{pt}</span>
                    </div>
                  ))}
                </>
              )}

              {response.followUpSuggestion && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, borderRadius: 10, border: "1px solid #a855f7", background: "rgba(168,85,247,0.08)", padding: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 13 }}>💡</span>
                  <span style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.5 }}>Try asking: {response.followUpSuggestion}</span>
                </div>
              )}
            </div>

            <button className="vt-btn" onClick={reset} style={{ padding: "13px 0", borderRadius: 16, border: "none", background: "linear-gradient(90deg,#2e1065,#7c3aed)", color: "#fff", fontSize: 15, fontWeight: 800 }}>
              🎙️ Ask Another Question
            </button>
            <Link href="/ai-guru/setup" style={{ display: "block", textAlign: "center", padding: "12px 0", borderRadius: 14, border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : colors.border}`, color: "#d8b4fe", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              ✨ Generate Full Lesson on {response.subject}
            </Link>
          </div>
        )}

        {phase === "error" && <div style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginTop: 8 }}>{errMsg}</div>}

        {phase === "limit" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 14, textAlign: "center" }}>
            <span style={{ fontSize: 44 }}>⏰</span>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 800 }}>{t("dailyLimitTitle", "Daily limit reached")}</div>
            <div style={{ color: colors.textSecondary, fontSize: 13, maxWidth: 260, lineHeight: 1.6 }}>
              {creditInfo
                ? `You've used today's free voice questions. You have ${creditInfo.balance} credit${creditInfo.balance===1?"":"s"} — buy more or upgrade to Premium.`
                : t("voiceTutorLimitMessage", "You've used your free voice questions for today. Upgrade to Premium for unlimited voice questions!")}
            </div>
            <Link href={creditInfo ? "/ai-guru/credits" : "/ai-guru/subscription"} style={{ width: "100%", maxWidth: 280, padding: "14px 0", borderRadius: 16, background: creditInfo ? "linear-gradient(90deg,#4f46e5,#7c3aed)" : "linear-gradient(90deg,#6d28d9,#a855f7)", color: "#fff", fontSize: 14, fontWeight: 800, textAlign: "center", textDecoration: "none", display: "block" }}>
              {creditInfo ? "⚡ Buy Credits" : `✨ ${t("upgradeToPremium", "Upgrade to Premium")}`}
            </Link>
            {creditInfo && (
              <Link href="/ai-guru/subscription" style={{ color: "#a5b4fc", fontSize: 12, textDecoration: "none" }}>
                Or upgrade to Premium for unlimited access
              </Link>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "16px 16px 28px", borderTop: `1px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : colors.border}`, background: isDarkMode ? "rgba(15,0,32,0.9)" : colors.card, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {transcript && phase === "listening" && <div style={{ color: isDarkMode ? "#d8b4fe" : "#7c3aed", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>"{transcript}"</div>}
        <button className="vt-btn" onClick={phase === "listening" ? stopListening : startListening} disabled={!supported || phase === "thinking" || phase === "limit"} style={{
          width: 80, height: 80, borderRadius: "50%", border: `3px solid ${phase === "listening" ? "#ef4444" : "#a855f7"}`,
          background: phase === "listening" ? "rgba(239,68,68,0.2)" : "rgba(168,85,247,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34,
          boxShadow: phase === "listening" ? "0 0 30px rgba(239,68,68,0.5)" : "0 0 20px rgba(168,85,247,0.3)",
          animation: phase === "listening" ? "pulse 1.5s ease-in-out infinite" : undefined,
          opacity: !supported || phase === "thinking" || phase === "limit" ? 0.5 : 1,
        }}>
          {phase === "listening" ? "⏹" : "🎙️"}
        </button>
        <div style={{ color: colors.textSecondary, fontSize: 12 }}>
          {phase === "listening" ? t("listeningTapToStop", "Listening… tap to stop") : phase === "thinking" ? t("processingLabel", "Processing…") : phase === "limit" ? t("upgradeToContinue", "Upgrade to continue") : t("tapMicToSpeak", "Tap mic to speak")}
        </div>
        {response && <button className="vt-btn" onClick={reset} style={{ color: colors.textSecondary, fontSize: 12, background: "none", border: "none", textDecoration: "underline" }}>{t("clearChat", "Clear chat")}</button>}
      </div>
    </div>
  );
}
