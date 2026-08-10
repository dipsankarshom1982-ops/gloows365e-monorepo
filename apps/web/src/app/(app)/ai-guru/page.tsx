"use client";

// PATH: apps/web/src/app/(app)/ai-guru/page.tsx
// Exact mirror of mobile app/(drawer)/(tabs)/ai-guru.tsx
// Hero section: pulse ring + avatar + tagline
// 2-column grid of feature cards with gradients, exactly matching MENU_CARD_DEFS
// Feature visibility controlled by FeatureFlagsContext.aiGuru()
// "Powered by Gemini AI" footer
//
// FEATURE (full i18n rebuild): this page used to import its own bespoke
// getTranslations(lang) from a local ./translations.ts file — a THIRD
// parallel translation mechanism alongside the old hand-rolled
// LanguageContext and mobile's i18next setup. That local file only covered
// greetings + a few generic labels (not the actual card titles/subtitles
// rendered below, which were still hardcoded English), and had no Odia or
// Assamese blocks at all. Retired in favor of the same useAppTranslation()
// hook every other converted page now uses — greetings and card text both
// now come from the shared locale files (apps/web/locales/*.json).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFeatureFlags, useStudentProfile } from "@gloows/shared-logic";
import { useAppTranslation, useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useAdFeed } from "@/hooks/useAdFeed";
import { auth } from "@/lib/firebase";
import { isSubscribed } from "@/services/aiGuruFirestore";
import ScholarshipAdCard from "@/components/ads/ScholarshipAdCard";

// ─── Exact same MENU_CARD_DEFS as mobile, titleKey/subtitleKey now point at
// translation keys instead of literal English strings ──────────
const MENU_CARD_DEFS = [
  { flagKey: "dashboard",      titleKey: "menuAiDashboard",     subtitleKey: "menuAiDashboardSub",     emoji: "🧠",  gradient: ["#1e1b4b", "#312e81", "#4f46e5"], route: "/ai-guru/dashboard",      accentColor: "#818cf8" },
  { flagKey: "skillguru",      titleKey: "menuSkillGuruCard",   subtitleKey: "menuSkillGuruCardSub",   emoji: "🎯",  gradient: ["#1a0533", "#4c1d95", "#7c3aed"], route: "/ai-guru/skillguru",      accentColor: "#c4b5fd" },
  { flagKey: "photo_solve",    titleKey: "menuPhotoSolve",      subtitleKey: "menuPhotoSolveSub",      emoji: "📸",  gradient: ["#451a03", "#92400e", "#d97706"], route: "/ai-guru/photo-solve",    accentColor: "#fbbf24" },
  { flagKey: "exam_simulator", titleKey: "menuExamSimulator",   subtitleKey: "menuExamSimulatorSub",   emoji: "🎯",  gradient: ["#450a0a", "#7f1d1d", "#dc2626"], route: "/ai-guru/exam-simulator", accentColor: "#fca5a5" },
  { flagKey: "voice_tutor",    titleKey: "menuVoiceTutor",      subtitleKey: "menuVoiceTutorSub",      emoji: "🎙️",  gradient: ["#2e1065", "#6d28d9", "#a855f7"], route: "/ai-guru/voice-tutor",    accentColor: "#d8b4fe" },
  { flagKey: "generate",       titleKey: "menuGenerateLesson",  subtitleKey: "menuGenerateLessonSub",  emoji: "✨",  gradient: ["#0f172a", "#1e3a5f", "#0284c7"], route: "/ai-guru/setup",          accentColor: "#38bdf8" },
  { flagKey: "my_lessons",     titleKey: "menuMyLessons",       subtitleKey: "menuMyLessonsSub",       emoji: "📚",  gradient: ["#052e16", "#064e3b", "#059669"], route: "/ai-guru/my-lessons",     accentColor: "#34d399" },
  { flagKey: "ask_aiguru",     titleKey: "menuAskAiGuruCard",   subtitleKey: "menuAskAiGuruCardSub",   emoji: "🤖",  gradient: ["#0f0f1e", "#1a1a3e", "#6366f1"], route: "/ai-guru/ask",            accentColor: "#a5b4fc" },
  { flagKey: "notebook",       titleKey: "menuAiNotebook",      subtitleKey: "menuAiNotebookSub",      emoji: "📓",  gradient: ["#0c1a0c", "#14532d", "#16a34a"], route: "/ai-guru/notebook",       accentColor: "#86efac" },
  { flagKey: "revision_reels", titleKey: "menuRevisionReels",   subtitleKey: "menuRevisionReelsSub",   emoji: "🎬",  gradient: ["#1c1917", "#44403c", "#78716c"], route: "/ai-guru/my-lessons",     accentColor: "#d6d3d1" },
  { flagKey: "practice_tests", titleKey: "menuPracticeTests",   subtitleKey: "menuPracticeTestsSub",   emoji: "📝",  gradient: ["#450a0a", "#7f1d1d", "#dc2626"], route: "/ai-guru/my-lessons",     accentColor: "#f87171" },
  { flagKey: "discover",       titleKey: "menuDiscoverAI",      subtitleKey: "menuDiscoverAISub",      emoji: "🧭",  gradient: ["#0c1a2e", "#0f2d4a", "#0369a1"], route: "/discover",               accentColor: "#7dd3fc" },
] as const;

// ─── Pulse ring animation (CSS keyframe via style tag) ────────
const pulseStyle = `
@keyframes pulse-ring {
  0%   { transform: scale(1);    opacity: 0.6; }
  50%  { transform: scale(1.25); opacity: 0; }
  100% { transform: scale(1);    opacity: 0.6; }
}
.pulse-ring {
  position: absolute;
  inset: -14px;
  border-radius: 50%;
  border: 2px solid #6366f1;
  animation: pulse-ring 3.2s ease-in-out infinite;
  pointer-events: none;
}
`;

// ─── Feature card ─────────────────────────────────────────────
function FeatureCard({ def, t }: { def: typeof MENU_CARD_DEFS[number]; t: (key: string) => string }) {
  const [hovered, setHovered] = useState(false);
  const [stop0, stop1, stop2] = def.gradient;

  return (
    <Link href={def.route} style={{ textDecoration: "none", width: "calc(50% - 6px)" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: 20,
          background: `linear-gradient(135deg, ${stop0}, ${stop1}, ${stop2})`,
          padding: 18, minHeight: 148,
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
          gap: 6, position: "relative", overflow: "hidden",
          transform: hovered ? "translateY(-2px)" : "none",
          transition: "transform 0.18s",
          boxShadow: hovered ? `0 8px 24px ${def.accentColor}30` : "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {/* top glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 60,
          borderRadius: "20px 20px 0 0",
          background: `${def.accentColor}18`,
        }} />
        <span style={{ fontSize: 34 }}>{def.emoji}</span>
        <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 900, lineHeight: 1.3 }}>{t(def.titleKey)}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1.4 }}>{t(def.subtitleKey)}</div>
        {/* accent line */}
        <div style={{ height: 3, borderRadius: 2, background: `${def.accentColor}60`, marginTop: 4 }} />
      </div>
    </Link>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function AiGuruPage() {
  const { aiGuru } = useFeatureFlags();
  const { studentProfile } = useStudentProfile();

  // Subscription state — was entirely untracked on this page before (see
  // git history); now used both for the scholarship ad gate below (mirrors
  // mobile's `!subscribed` gate, previously a no-op stand-in comment here)
  // and for the Upgrade button next to the language badge.
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(true);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setSubLoading(false); return; }
    isSubscribed(uid).then((sub) => { setSubscribed(sub); setSubLoading(false); });
  }, []);

  const classLevel = String(studentProfile?.class ?? "all");
  const { currentAd: scholarshipAd } = useAdFeed({ module: "aiGuru", classLevel, adType: "scholarship" });
  const { t } = useAppTranslation();
  const { languageCode, languageName } = useLanguage();
  const { colors, isDarkMode } = useTheme();

  const visibleCards = MENU_CARD_DEFS.filter((def) => aiGuru(def.flagKey));

  const hour = new Date().getHours();

  let greeting = t("goodMorning", "Good Morning");

  if (hour >= 12 && hour < 17) {
    greeting = t("goodAfternoon", "Good Afternoon");
  }

  if (hour >= 17) {
    greeting = t("goodEvening", "Good Evening");
  }

  // Page chrome (background, hero text, language badge, footer) follows
  // the theme. The feature cards below stay on their own fixed colorful
  // gradients in both themes — by design, not a theming gap.
  const pageBg = isDarkMode
    ? "linear-gradient(180deg, #060612, #0d0d24, #060612)"
    : "linear-gradient(180deg, #f5f6fb, #ffffff, #f5f6fb)";

  return (
    <>
      <style>{pulseStyle}</style>

      <div style={{
        minHeight: "100%",
        background: pageBg,
        position: "relative", overflow: "hidden",
      }}>
        {/* Background orbs — soft brand-color glows, kept in both themes
            since they're subtle and sit behind the page chrome either way */}
        <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", background: isDarkMode ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)", top: -60, left: -60 }} />
        <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", background: isDarkMode ? "rgba(124,58,237,0.10)" : "rgba(124,58,237,0.07)", top: 120, right: -80 }} />

        <div style={{ padding: "52px 16px 32px", maxWidth: 600, margin: "0 auto" }}>

          {/* Top-right row: Upgrade (non-subscribers only) + language badge */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginBottom: 8 }}>
            {!subscribed && !subLoading && (
              <Link href="/ai-guru/subscription" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "linear-gradient(90deg, #92400e, #d97706, #fbbf24)",
                  borderRadius: 10, padding: "5px 10px", cursor: "pointer",
                }}>
                  <span style={{ fontSize: 12 }}>⭐</span>
                  <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>
                    {t("upgrade", "Upgrade")}
                  </span>
                </div>
              </Link>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: isDarkMode ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.10)", border: `1px solid ${colors.accent}`,
              borderRadius: 10, padding: "4px 10px",
            }}>
              <span style={{ fontSize: 12 }}>🌐</span>
              <span style={{ color: colors.accent, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                {languageCode.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Hero section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, paddingBottom: 28, gap: 12 }}>
            {/* Avatar with pulse ring — fixed brand gradient, unaffected by theme */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 88, height: 88 }}>
              <div className="pulse-ring" />
              <div style={{
                width: 88, height: 88, borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 44, boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
              }}>
                🤖
              </div>
            </div>

            <h1
              style={{
                color: colors.text,
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: -0.5,
                margin: 0,
                textAlign: "center",
                lineHeight: 1.3
              }}
            >
              {greeting},{" "}
              {studentProfile?.name?.split(" ")[0] || t("student", "Student")}
            </h1>

            {/* Tagline pill — fixed brand gradient + white text, unaffected by theme */}
            <div style={{
              background: "linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)",
              borderRadius: 20, padding: "6px 14px",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontSize: 12 }}>✨</span>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>
                {t("aiGuruTagline", "India's Most Useful AI Guru")}
              </span>
            </div>

            <p style={{
              color: colors.textSecondary, fontSize: 13, textAlign: "center",
              lineHeight: 1.6, maxWidth: 260, margin: 0, whiteSpace: "pre-line",
            }}>
              {t("aiClassroom", "Your personal AI classroom\npowered by Gemini")}
            </p>
          </div>

          {/* Change Language card — a distinct button (not the passive badge
              above), so students can switch straight from the AI Guru home
              page. Ask AI Guru now falls back to whatever this is set to
              for English/ambiguous-language questions (see
              functions/src/askAiGuru.ts) — questions clearly written in
              another language still get answered in that language, unchanged. */}
          <Link href="/settings/language" style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: isDarkMode ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.06)",
              border: `1px solid ${colors.accent}55`,
              borderRadius: 14, padding: "12px 16px", marginBottom: 16,
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🌐</span>
                <div>
                  <div style={{ color: colors.text, fontSize: 13, fontWeight: 800 }}>{t("language", "Language")}</div>
                  <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{languageName}</div>
                </div>
              </div>
              <span style={{ color: colors.accent, fontSize: 18 }}>›</span>
            </div>
          </Link>

          {/* Scholarship ad — mirrors mobile's placement, right after hero.
              Non-premium users only, same as mobile's ai-guru.tsx. */}
          {!subscribed && !subLoading && scholarshipAd && (
            <ScholarshipAdCard ad={scholarshipAd} module="aiGuru" classLevel={classLevel} style={{ marginInline: 0, marginBottom: 4 }} />
          )}

          {/* Feature grid — 2 columns exactly like mobile. Each card keeps
              its own fixed colorful gradient + white text in both themes
              (intentional, not a theming gap — see FeatureCard). */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            {visibleCards.map((def) => (
              <FeatureCard key={def.flagKey} def={def} t={t} />
            ))}
          </div>

          {/* Powered by footer */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            justifyContent: "center", paddingTop: 4, paddingBottom: 4,
          }}>
            <span style={{ color: colors.textSecondary, fontSize: 12 }}>⚡</span>
            <span style={{ color: colors.textSecondary, fontSize: 11 }}>{t("poweredByGemini", "Powered by Gemini AI")}</span>
          </div>

          <div style={{ height: 32 }} />
        </div>
      </div>
    </>
  );
}
