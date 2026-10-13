"use client";
// PATH: apps/web/src/app/(app)/ai-guru/generating/page.tsx
// Generating — mirror of mobile app/ai-guru/generating.tsx
// Staggered step reveal + Firestore onSnapshot listener on lesson status
// → redirects to /ai-guru/player on completion

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listenLessonStatus } from "@/services/aiGuruFirestore";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

const STEP_KEYS = [
  ["genStep1", "Reading your content"],
  ["genStep2", "Understanding the syllabus"],
  ["genStep3", "Creating explanation"],
  ["genStep4", "Building visual scenes"],
  ["genStep5", "Designing quiz questions"],
  ["genStep6", "Preparing revision notes"],
  ["genStep7", "Finalising AI lesson"],
] as const;

function GeneratingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const lessonId = params.get("lessonId");

  const [stepsVisible, setStepsVisible] = useState<boolean[]>(Array(STEP_KEYS.length).fill(false));
  const [completedStep, setCompletedStep] = useState(-1);
  const [failed, setFailed] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  // Reveal steps one by one with stagger
  useEffect(() => {
    const timers = STEP_KEYS.map((_, i) =>
      setTimeout(() => {
        setStepsVisible((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        setCompletedStep(i - 1);
      }, i * 1800)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Listen to Firestore lesson status
  useEffect(() => {
    if (!lessonId) return;
    const unsub = listenLessonStatus(lessonId, (lesson) => {
      if (lesson.status === "completed") {
        unsubRef.current?.();
        setTimeout(() => router.replace(`/ai-guru/player?lessonId=${lessonId}`), 600);
      } else if (lesson.status === "failed") {
        unsubRef.current?.();
        setFailed(true);
      }
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [lessonId, router]);

  // Page chrome — follows the theme. The avatar glow/breathing orb keeps
  // its fixed indigo identity in both themes.
  const cardBg     = isDarkMode ? "#1e293b" : colors.card;
  const cardBorder = isDarkMode ? "#334155" : colors.border;
  const textPrimary = colors.text;
  const textMuted   = colors.textSecondary;

  return (
    <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(160deg,#0a0a1a,#0f172a,#1a0a2e)" : colors.background, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes genbreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes genglow{0%,100%{opacity:.3}50%{opacity:.9}}
        @keyframes gendot{0%,100%{opacity:.4}50%{opacity:1}}
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: 32, maxWidth: 420, width: "100%" }}>

        {/* Avatar — fixed indigo identity, unaffected by theme */}
        <div style={{ position: "relative", width: 124, height: 124, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 124, height: 124, borderRadius: "50%", background: "rgba(99,102,241,0.5)", animation: "genglow 0.8s ease-in-out infinite" }} />
          <div style={{ position: "relative", width: 100, height: 100, borderRadius: "50%", background: "#1e1b4b", border: "2px solid #6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 55, animation: "genbreathe 1.8s ease-in-out infinite" }}>🤖</div>
        </div>

        <div style={{ color: textPrimary, fontSize: 22, fontWeight: 900, textAlign: "center" }}>
          {failed ? t("generationFailedTitle", "Generation Failed") : t("creatingLessonTitle", "Creating Your Lesson...")}
        </div>
        <div style={{ color: textMuted, fontSize: 14, textAlign: "center", lineHeight: 1.55 }}>
          {failed ? t("generationFailedSub", "Something went wrong. Please try again.") : t("creatingLessonSub", "AI Guru is preparing your personalised learning experience")}
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
          {STEP_KEYS.map(([key, fallback], i) => {
            const visible = stepsVisible[i];
            const isDone = completedStep >= i;
            const isActive = completedStep === i - 1 && visible;
            if (!visible) return null;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: isDone ? "rgba(16,185,129,0.2)" : isActive ? "rgba(99,102,241,0.2)" : cardBg,
                  border: `1px solid ${isDone ? "#10b981" : isActive ? "#6366f1" : cardBorder}`,
                }}>
                  {isDone ? (
                    <span style={{ color: "#10b981", fontSize: 13, fontWeight: 900 }}>✓</span>
                  ) : isActive ? (
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: "#6366f1", animation: "gendot 0.8s ease-in-out infinite" }} />
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: cardBorder }} />
                  )}
                </div>
                <span style={{ fontSize: 14, fontWeight: isActive ? 700 : 600, color: isDone ? "#10b981" : isActive ? "#a5b4fc" : textMuted }}>
                  {t(key, fallback)}
                </span>
              </div>
            );
          })}
        </div>

        {failed && (
          <button onClick={() => router.back()} style={{ marginTop: 20, background: cardBg, border: "none", borderRadius: 14, padding: "14px 28px", color: "#a5b4fc", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {t("goBackRetry", "← Go Back & Retry")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0a0a1a" }} />}>
      <GeneratingContent />
    </Suspense>
  );
}
