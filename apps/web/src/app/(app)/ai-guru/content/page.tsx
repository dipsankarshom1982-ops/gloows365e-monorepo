"use client";
// PATH: apps/web/src/app/(app)/ai-guru/content/page.tsx
// Add Content — mirror of mobile app/ai-guru/content.tsx
// Paste text / upload image / topic-only → calls generateLesson Cloud
// Function → redirects to /ai-guru/generating

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { generateLesson } from "@/services/aiGuruApi";
import { getRemainingLessons } from "@/services/aiGuruFirestore";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

type Tab = "text" | "image" | "topic";

function AddContentContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const board = params.get("board") ?? "";
  const classLevel = params.get("classLevel") ?? "";
  const subject = params.get("subject") ?? "";
  const chapter = params.get("chapter") ?? "";
  const topic = params.get("topic") ?? "";
  const language = params.get("language") ?? "English";
  const difficulty = params.get("difficulty") ?? "Standard";
  const lessonStyle = params.get("lessonStyle") ?? "Simple Explanation";

  const [activeTab, setTab] = useState<Tab>("text");
  const [inputText, setInputText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [generating, setGenerating] = useState(false);
  // Optimistic default before getRemainingLessons() resolves — matches
  // the "first one free, then upgrade" policy. The real count (and the
  // actual server-side enforcement) comes from Firestore via
  // getRemainingLessons(), which lives outside this repo.
  const [remaining, setRemaining] = useState<number>(1);
  const [limitReached, setLimitReached] = useState(false);
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getRemainingLessons(uid).then((rem) => {
      setRemaining(rem);
      if (rem === 0) setLimitReached(true);
    });
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMime(file.type === "image/png" ? "image/png" : "image/jpeg");
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    const uid = auth.currentUser?.uid;
    if (!uid) { alert(t("notSignedIn", "Not signed in")); return; }
    if (remaining === 0) { setLimitReached(true); return; }

    if (activeTab === "text" && !inputText.trim()) {
      alert(t("emptyInputDesc", "Please paste some text content to generate a lesson."));
      return;
    }
    if (activeTab === "image" && !imageBase64) {
      alert(t("noImageDesc", "Please upload an image first."));
      return;
    }

    setGenerating(true);
    try {
      const setup = {
        board, classLevel, subject, chapter, topic,
        language, difficulty: difficulty as any, lessonStyle: lessonStyle as any,
      };
      const text = activeTab === "text" ? inputText.trim() : "";
      const b64 = activeTab === "image" ? imageBase64 ?? undefined : undefined;
      const mime = activeTab === "image" ? imageMime : undefined;

      const { lessonId } = await generateLesson(setup, text, b64, mime);
      router.replace(`/ai-guru/generating?lessonId=${lessonId}`);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (err?.code === "CREDITS_EXHAUSTED") {
        setCreditInfo({ balance: err.creditBalance ?? 0, required: err.creditsRequired ?? 1 });
        setLimitReached(true);
      } else if (msg.includes("FREE_LIMIT_REACHED")) {
        setCreditInfo(undefined);
        setLimitReached(true);
      } else {
        alert(t("generationFailedDesc", msg || "Please try again."));
      }
    } finally {
      setGenerating(false);
    }
  }

  if (limitReached) {
    return (
      <div style={{ minHeight: "100dvh", background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420, borderRadius: 28, padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, background: "linear-gradient(160deg,#0f0c29,#302b63,#24243e)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: "rgba(251,191,36,0.15)", border: "2px solid #fbbf24", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🔒</div>
          <div style={{ color: "#fbbf24", fontSize: 22, fontWeight: 900 }}>
            {creditInfo ? "Out of Free Actions for Today" : t("unlockPremiumTitle", "Unlock AI Guru Premium")}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.5 }}>
            {creditInfo
              ? `You've used today's free lessons. You have ${creditInfo.balance} credit${creditInfo.balance===1?"":"s"} — buy more or upgrade to Premium for unlimited access.`
              : t("unlockPremiumDesc", "Get unlimited access to unlimited AI lesson generation and all premium features")}
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
            {/* FIX: "Exam Simulator — unlimited mock tests" was wrong —
                the real premium cap is 20/day (functions/src/
                examSimulator.ts's PREMIUM_EXAMS_DAILY), same fix as
                mobile's components/aiGuru/PremiumLock.tsx. */}
            {["📸 PhotoSolve — 50 photo solves/day", "🎯 Exam Simulator — 20 mock tests/day", "🎙️ Voice Tutor — 100 voice questions/day", "✨ Unlimited AI lessons per day", "💬 Unlimited follow-up doubts", "🤖 Unlimited SkillGuru chats"].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#10b981" }}>✓</span>
                <span style={{ color: "#e2e8f0", fontSize: 14, flex: 1 }}>{f}</span>
              </div>
            ))}
          </div>
          <a
            href={creditInfo ? "/ai-guru/credits" : "/ai-guru/subscription"}
            style={{ width: "100%", borderRadius: 16, padding: "16px 0", background: creditInfo ? "linear-gradient(90deg,#4f46e5,#7c3aed)" : "linear-gradient(90deg,#92400e,#d97706,#fbbf24)", color: "#fff", fontSize: 17, fontWeight: 900, textDecoration: "none" }}
          >
            {creditInfo ? "⚡ Buy Credits" : t("upgradeToPremium", "✨ Upgrade to Premium")}
          </a>
          {creditInfo && (
            <a href="/ai-guru/subscription" style={{ color: "#fbbf24", fontSize: 12, textDecoration: "none" }}>
              Or upgrade to Premium for unlimited access
            </a>
          )}
          <button onClick={() => setLimitReached(false)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer" }}>{t("tryTomorrowFree", `Try Tomorrow (Free: 2 lessons/day)`)}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#0a0a1a,#0f172a)" : colors.background, display: "flex", flexDirection: "column" }}>
      <style>{`.ac-btn{cursor:pointer;border:none;background:none}.ac-btn:hover{opacity:.88}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px" }}>
        <button className="ac-btn" onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 20, fontWeight: 900 }}>‹</button>
        <span style={{ color: colors.text, fontSize: 18, fontWeight: 800 }}>{t("addContentTitle", "Add Content")}</span>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <span style={{ color: colors.textSecondary, fontSize: 12 }}>{subject} • {chapter} • {t("classLabel", "Class")} {classLevel} • {board}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        {/* Tabs */}
        <div style={{ display: "flex", background: isDarkMode ? "#1e293b" : colors.card, borderRadius: 14, padding: 4, gap: 2, marginBottom: 20 }}>
          {(["text", "image", "topic"] as Tab[]).map((tab) => (
            <button key={tab} className="ac-btn" onClick={() => setTab(tab)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, textAlign: "center",
              background: activeTab === tab ? "#312e81" : "transparent",
              color: activeTab === tab ? "#a5b4fc" : colors.textSecondary,
              fontSize: 12, fontWeight: 700,
            }}>
              {tab === "text" ? `📋 ${t("pasteTextTab", "Paste Text")}` : tab === "image" ? `📷 ${t("uploadImageTab", "Upload Image")}` : `💡 ${t("topicOnlyTab", "Topic Only")}`}
            </button>
          ))}
        </div>

        {activeTab === "text" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 600 }}>{t("pasteTextLabel", "Paste your chapter content, notes, or textbook text:")}</span>
            <textarea
              value={inputText} onChange={(e) => setInputText(e.target.value.slice(0, 5000))}
              placeholder={t("pasteTextPlaceholder", "Paste text here (up to 5000 characters)...")}
              rows={12}
              style={{ background: isDarkMode ? "#1e293b" : colors.card, borderRadius: 16, padding: 16, color: colors.text, fontSize: 14, lineHeight: 1.55, minHeight: 220, border: `1px solid ${colors.border}`, outline: "none", resize: "vertical" }}
            />
            <span style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right" }}>{inputText.length} / 5000</span>
          </div>
        )}

        {activeTab === "image" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 600 }}>{t("uploadImageLabel", "Upload a photo of your textbook page or notes:")}</span>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            <button className="ac-btn" onClick={() => fileInputRef.current?.click()} style={{
              background: isDarkMode ? "#1e293b" : colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, minHeight: 220, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Preview" style={{ width: "100%", height: 220, objectFit: "contain" }} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 40, color: colors.textSecondary }}>📷</span>
                  <span style={{ color: colors.textSecondary, fontSize: 14 }}>{t("tapToChooseImage", "Tap to choose image")}</span>
                </div>
              )}
            </button>
            {imagePreview && (
              <button className="ac-btn" onClick={() => fileInputRef.current?.click()} style={{ alignSelf: "center", color: colors.accent, fontSize: 13, fontWeight: 700 }}>{t("changeImage", "Change Image")}</button>
            )}
          </div>
        )}

        {activeTab === "topic" && (
          <div style={{ background: isDarkMode ? "#1e293b" : colors.card, borderRadius: 20, padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, border: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: 32, color: colors.accent }}>✨</span>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 800 }}>{t("aiWillCreateLesson", "AI will create a complete lesson")}</div>
            <div style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.55 }}>
              {t("aiWillCreateLessonDesc", `Based on your chapter "${chapter}" and subject "${subject}", the AI Guru will generate a full interactive lesson without requiring any additional content from you.`, { chapter, subject })}
            </div>
          </div>
        )}

        {/* Free usage info */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16 }}>
          <span style={{ color: colors.textSecondary, fontSize: 14 }}>ⓘ</span>
          <span style={{ color: colors.textSecondary, fontSize: 12 }}>
            {remaining === Infinity ? t("unlimitedGenerationsPremium", "Unlimited generations (Premium)") : t("freeGenerationsRemaining", `${remaining} free generation${remaining !== 1 ? "s" : ""} remaining today`, { count: remaining })}
          </span>
        </div>
        <div style={{ height: 100 }} />
      </div>

      {/* Generate button */}
      <div style={{ padding: 16, background: isDarkMode ? "rgba(10,10,26,0.95)" : colors.background, maxWidth: 600, margin: "0 auto", width: "100%" }}>
        <button className="ac-btn" onClick={handleGenerate} disabled={generating} style={{
          width: "100%", borderRadius: 16, padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: generating ? (isDarkMode ? "#1e293b" : colors.card) : "linear-gradient(90deg,#4f46e5,#7c3aed)",
        }}>
          {generating ? (
            <div style={{ width: 18, height: 18, border: `2px solid ${colors.textSecondary}`, borderTopColor: "transparent", borderRadius: "50%", animation: "acspin 0.8s linear infinite" }} />
          ) : <span style={{ fontSize: 18 }}>✨</span>}
          <span style={{ fontSize: 17, fontWeight: 900, color: generating ? colors.textSecondary : "#fff" }}>
            {generating ? t("sendingToAi", "Sending to AI...") : t("generateLessonBtn", "Generate Lesson ✨")}
          </span>
        </button>
      </div>
      <style>{`@keyframes acspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function AddContentPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0a0a1a" }} />}>
      <AddContentContent />
    </Suspense>
  );
}
