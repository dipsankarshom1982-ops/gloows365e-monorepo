"use client";
// PATH: apps/web/src/app/(app)/ai-guru/setup/page.tsx
// Lesson Setup — mirror of mobile app/ai-guru/setup.tsx
// Subject/chapter/topic/language/difficulty/style picker → /ai-guru/content

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentProfile } from "@gloows/shared-logic";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import type { Colors } from "@/context/ThemeContext";
import {
  SUBJECTS, SUBJECT_ICONS,
  LANGUAGES, DIFFICULTIES, DIFFICULTY_DESC,
  LESSON_STYLES, LESSON_STYLE_DESC,
} from "@/lib/aiGuru/constants";

function Section({ label, required, colors, children }: { label: string; required?: boolean; colors: Colors; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </div>
      {children}
    </div>
  );
}

export default function LessonSetupPage() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();

  const [board, setBoard] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("English");
  const [difficulty, setDifficulty] = useState("Standard");
  const [lessonStyle, setLessonStyle] = useState("Simple Explanation");

  useEffect(() => {
    if (studentProfile?.board) setBoard(studentProfile.board);
    if (studentProfile?.class) setClassLevel(String(studentProfile.class));
    if (studentProfile?.preferredLanguage && LANGUAGES.includes(studentProfile.preferredLanguage)) {
      setLanguage(studentProfile.preferredLanguage);
    }
  }, [studentProfile?.board, studentProfile?.class, studentProfile?.preferredLanguage]);

  const canContinue = !!subject && !!chapter.trim();

  function handleContinue() {
    if (!canContinue) {
      alert(t("fillRequiredFieldsDesc", "Please select a subject and enter a chapter name."));
      return;
    }
    const params = new URLSearchParams({
      board, classLevel, subject, chapter: chapter.trim(), topic: topic.trim(),
      language, difficulty, lessonStyle,
    });
    router.push(`/ai-guru/content?${params.toString()}`);
  }

  return (
    <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#0a0a1a,#0f172a)" : colors.background, display: "flex", flexDirection: "column" }}>
      <style>{`.su-btn{cursor:pointer;border:none;background:none}.su-btn:hover{opacity:.88}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", position: "sticky", top: 0, background: isDarkMode ? "rgba(10,10,26,0.95)" : "rgba(255,255,255,0.95)", zIndex: 10 }}>
        <button className="su-btn" onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 20, fontWeight: 900 }}>‹</button>
        <span style={{ color: colors.text, fontSize: 18, fontWeight: 800 }}>{t("lessonSetup", "Lesson Setup")}</span>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        {/* Subject */}
        <Section label={`📚 ${t("subjectLabel", "Subject")}`} required colors={colors}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {SUBJECTS.map((s) => {
              const active = subject === s;
              return (
                <button key={s} className="su-btn" onClick={() => setSubject(s)} style={{
                  width: "22%", aspectRatio: "1", borderRadius: 14, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                  border: `1px solid ${active ? "#6366f1" : (isDarkMode ? "#334155" : colors.border)}`,
                  background: active ? "rgba(99,102,241,0.2)" : (isDarkMode ? "#1e293b" : colors.card),
                }}>
                  <span style={{ fontSize: 24 }}>{SUBJECT_ICONS[s] ?? "📚"}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", color: active ? "#a5b4fc" : colors.textSecondary }}>{s}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Chapter */}
        <Section label={`📖 ${t("chapterNameLabel", "Chapter Name")}`} required colors={colors}>
          <input
            value={chapter} onChange={(e) => setChapter(e.target.value)}
            placeholder={t("chapterPlaceholder", "e.g. Photosynthesis, Quadratic Equations...")}
            style={{ borderRadius: 14, padding: 16, fontSize: 15, border: `1px solid ${isDarkMode ? "#334155" : colors.border}`, background: isDarkMode ? "#1e293b" : colors.card, color: colors.text, outline: "none" }}
          />
        </Section>

        {/* Topic (optional) */}
        <Section label={`🔍 ${t("specificTopicLabel", "Specific Topic (optional)")}`} colors={colors}>
          <input
            value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder={t("topicPlaceholder", "e.g. Light reactions, Discriminant formula...")}
            style={{ borderRadius: 14, padding: 16, fontSize: 15, border: `1px solid ${isDarkMode ? "#334155" : colors.border}`, background: isDarkMode ? "#1e293b" : colors.card, color: colors.text, outline: "none" }}
          />
        </Section>

        {/* Language */}
        <Section label={`🌐 ${t("languageLabel2", "Language")}`} colors={colors}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LANGUAGES.map((item) => {
              const active = language === item;
              return (
                <button key={item} className="su-btn" onClick={() => setLanguage(item)} style={{
                  padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${active ? "#6366f1" : (isDarkMode ? "#334155" : colors.border)}`,
                  background: active ? "rgba(99,102,241,0.2)" : (isDarkMode ? "#1e293b" : colors.card),
                  color: active ? "#a5b4fc" : colors.textSecondary,
                }}>{item}</button>
              );
            })}
          </div>
        </Section>

        {/* Difficulty */}
        <Section label={`⚡ ${t("difficultyLabel", "Difficulty")}`} colors={colors}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d;
              return (
                <button key={d} className="su-btn" onClick={() => setDifficulty(d)} style={{
                  display: "flex", alignItems: "center", gap: 10, borderRadius: 14, padding: 14, textAlign: "left",
                  border: `1px solid ${active ? "#6366f1" : (isDarkMode ? "#334155" : colors.border)}`,
                  background: active ? "rgba(99,102,241,0.08)" : (isDarkMode ? "#1e293b" : colors.card),
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, width: 100, color: active ? "#a5b4fc" : colors.textSecondary, flexShrink: 0 }}>{d}</span>
                  <span style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>{DIFFICULTY_DESC[d]}</span>
                  {active && <span style={{ color: "#6366f1", fontSize: 18 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Lesson Style */}
        <Section label={`🎨 ${t("lessonStyleLabel", "Lesson Style")}`} colors={colors}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {LESSON_STYLES.map((s) => {
              const info = LESSON_STYLE_DESC[s];
              const active = lessonStyle === s;
              return (
                <button key={s} className="su-btn" onClick={() => setLessonStyle(s)} style={{
                  display: "flex", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, textAlign: "left",
                  border: `1px solid ${active ? "#6366f1" : (isDarkMode ? "#334155" : colors.border)}`,
                  background: active ? "rgba(99,102,241,0.08)" : (isDarkMode ? "#1e293b" : colors.card),
                }}>
                  <span style={{ fontSize: 24, width: 36, flexShrink: 0 }}>{info.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#a5b4fc" : colors.textSecondary }}>{s}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{info.desc}</div>
                  </div>
                  {active && <span style={{ color: "#6366f1", fontSize: 18 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </Section>

        <div style={{ height: 24 }} />
      </div>

      {/* Continue button */}
      <div style={{ padding: 16, maxWidth: 600, margin: "0 auto", width: "100%" }}>
        <button
          className="su-btn"
          onClick={handleContinue}
          style={{
            width: "100%", borderRadius: 16, padding: "16px 0",
            background: canContinue ? "linear-gradient(90deg,#4f46e5,#7c3aed)" : (isDarkMode ? "#1e293b" : colors.card),
            color: canContinue ? "#fff" : colors.textSecondary,
            fontSize: 17, fontWeight: 900,
          }}
        >
          {t("continueBtn", "Continue")}
        </button>
      </div>
    </div>
  );
}
