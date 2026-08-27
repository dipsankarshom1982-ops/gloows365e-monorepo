"use client";
// PATH: apps/web/src/app/(app)/ai-guru/player/page.tsx
// Player — mirror of mobile app/ai-guru/player.tsx
// Tabs: Intro, Scenes, Concepts, Activity, Notes, Flashcards, Mission
// Plus floating "Ask AI Guru" modal for in-lesson follow-up questions.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { getLesson, updateLessonProgress } from "@/services/aiGuruFirestore";
import { sendFollowUp } from "@/services/aiGuruApi";
import { AiGuruLesson, KeyConcept, LessonJson } from "@/lib/aiGuru/types";
import SceneCard from "@/components/aiGuru/SceneCard";
import FlashcardDeck from "@/components/aiGuru/FlashcardDeck";
import ProgressXpBar from "@/components/aiGuru/ProgressXpBar";
import AiGuruAvatar from "@/components/aiGuru/AiGuruAvatar";
import PracticalActivityCard from "@/components/aiGuru/PracticalActivityCard";
import { useTheme } from "@/context/ThemeContext";
import type { Colors } from "@/context/ThemeContext";

type Section = "intro" | "scenes" | "concepts" | "activity" | "notes" | "flashcards" | "mission";

const SECTIONS: { id: Section; label: string; emoji: string }[] = [
  { id: "intro", label: "Intro", emoji: "🚀" },
  { id: "scenes", label: "Scenes", emoji: "🎬" },
  { id: "concepts", label: "Concepts", emoji: "💡" },
  { id: "activity", label: "Activity", emoji: "🔧" },
  { id: "notes", label: "Notes", emoji: "📝" },
  { id: "flashcards", label: "Flashcards", emoji: "🃏" },
  { id: "mission", label: "Mission", emoji: "🏆" },
];

// Card style for plain info cards across sections — follows the theme.
function cardStyle(colors: Colors, isDarkMode: boolean): React.CSSProperties {
  return { background: isDarkMode ? "#1e293b" : colors.card, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10 };
}

function PlayerContent() {
  const router = useRouter();
  const params = useSearchParams();
  const lessonId = params.get("lessonId");
  const { colors, isDarkMode } = useTheme();

  const [lesson, setLesson] = useState<AiGuruLesson | null>(null);
  const [lj, setLj] = useState<LessonJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("intro");
  const [sceneIdx, setSceneIdx] = useState(0);
  const [xp, setXp] = useState(0);
  const [askVisible, setAskVisible] = useState(false);
  const [askText, setAskText] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    getLesson(lessonId).then((l) => {
      setLesson(l);
      setLj(l?.lessonJson ?? null);
      setLoading(false);
    });
  }, [lessonId]);

  useEffect(() => {
    if (!lj || section !== "scenes" || !lessonId) return;
    updateLessonProgress(lessonId, sceneIdx, lj.scenes.length).catch(() => {});
  }, [sceneIdx, section, lj, lessonId]);

  async function handleFollowUp(mode: string) {
    if (!lj || !lessonId) return;
    setAskLoading(true);
    setAskAnswer(null);
    setAskVisible(true);
    try {
      const scene = lj.scenes[sceneIdx];
      const resp = await sendFollowUp(lessonId, scene?.narration ?? askText, lesson?.language ?? "English", mode as any);
      setAskAnswer(resp.answer);
      setXp((v) => v + 5);
    } catch {
      alert("Could not get AI response.");
    } finally {
      setAskLoading(false);
    }
  }

  async function handleAsk() {
    if (!askText.trim() || !lessonId) return;
    setAskLoading(true);
    setAskAnswer(null);
    try {
      const resp = await sendFollowUp(lessonId, askText.trim(), lesson?.language ?? "English", "ask_doubt" as any);
      setAskAnswer(resp.answer);
      setAskText("");
      setXp((v) => v + 5);
    } catch {
      alert("Could not get AI response.");
    } finally {
      setAskLoading(false);
    }
  }

  if (loading || !lj) {
    return (
      <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#0a0a1a,#0f172a)" : colors.background, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "plspin 0.8s linear infinite" }} />
        <span style={{ color: colors.textSecondary, fontSize: 14 }}>Loading your lesson...</span>
        <style>{`@keyframes plspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const totalScenes = lj.scenes.length;
  const progress = totalScenes > 0 ? Math.round(((sceneIdx + 1) / totalScenes) * 100) : 0;

  return (
    <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#0a0a1a,#0f172a)" : colors.background, display: "flex", flexDirection: "column" }}>
      <style>{`.pl-btn{cursor:pointer;border:none;background:none}.pl-btn:hover{opacity:.88}.pl-btn:disabled{cursor:default;opacity:.4}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 10px", gap: 10 }}>
        <button className="pl-btn" onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: 10, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 20, fontWeight: 900, flexShrink: 0 }}>‹</button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ color: colors.text, fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lj.lessonTitle}</span>
          <ProgressXpBar xp={xp} maxXp={(lj.flashcards?.length ?? 5) * 15} label="Session XP" />
        </div>
        <button className="pl-btn" onClick={() => { setAskVisible(true); setAskAnswer(null); }} style={{ width: 38, height: 38, borderRadius: 19, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>💬</button>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 12px 10px", maxHeight: 52 }}>
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button key={s.id} className="pl-btn" onClick={() => setSection(s.id)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0,
              background: active ? "rgba(99,102,241,0.25)" : (isDarkMode ? "#1e293b" : colors.card),
              border: active ? "1px solid #6366f1" : "1px solid transparent",
            }}>
              <span style={{ fontSize: 14 }}>{s.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#a5b4fc" : colors.textSecondary }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", maxWidth: 700, margin: "0 auto", width: "100%" }}>
        {section === "intro" && <IntroSection lj={lj} colors={colors} isDarkMode={isDarkMode} />}
        {section === "scenes" && (
          <SceneSection lj={lj} sceneIdx={sceneIdx} setSceneIdx={setSceneIdx} progress={progress} totalScenes={totalScenes} onFollowUp={handleFollowUp} colors={colors} isDarkMode={isDarkMode} />
        )}
        {section === "concepts" && <ConceptsSection lj={lj} colors={colors} isDarkMode={isDarkMode} />}
        {section === "activity" && <ActivitySection lj={lj} lessonId={lessonId!} lesson={lesson} onXp={(v) => setXp((x) => x + v)} colors={colors} isDarkMode={isDarkMode} />}
        {section === "notes" && <NotesSection lj={lj} colors={colors} isDarkMode={isDarkMode} />}
        {section === "flashcards" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <FlashcardDeck flashcards={lj.flashcards} />
            <div style={{ height: 24 }} />
          </div>
        )}
        {section === "mission" && <MissionSection lj={lj} colors={colors} isDarkMode={isDarkMode} />}
      </div>

      {/* Ask AI Guru Modal */}
      {askVisible && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.7)", zIndex: 50 }} onClick={() => setAskVisible(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 600, background: isDarkMode ? "#0f172a" : colors.background, borderRadius: "24px 24px 0 0", padding: 20, display: "flex", flexDirection: "column", gap: 14, maxHeight: "75vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AiGuruAvatar size={44} speaking={askLoading} />
              <span style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: 800 }}>Ask AI Guru</span>
              <button className="pl-btn" onClick={() => { setAskVisible(false); setAskAnswer(null); }} style={{ color: colors.textSecondary, fontSize: 22 }}>✕</button>
            </div>

            {askAnswer ? (
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                <span style={{ color: isDarkMode ? "#cbd5e1" : colors.text, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{askAnswer}</span>
              </div>
            ) : askLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16 }}>
                <div style={{ width: 20, height: 20, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "plspin 0.8s linear infinite" }} />
                <span style={{ color: colors.textSecondary, fontSize: 14 }}>AI Guru is thinking...</span>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                value={askText} onChange={(e) => setAskText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                placeholder="Ask anything about this lesson..."
                rows={1}
                style={{ flex: 1, background: isDarkMode ? "#1e293b" : colors.card, borderRadius: 14, padding: 14, color: colors.text, fontSize: 14, maxHeight: 100, border: `1px solid ${isDarkMode ? "#334155" : colors.border}`, outline: "none", resize: "none" }}
              />
              <button className="pl-btn" onClick={handleAsk} disabled={!askText.trim() || askLoading} style={{ width: 44, height: 44, borderRadius: 14, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#fff", fontSize: 16 }}>➤</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0a0a1a" }} />}>
      <PlayerContent />
    </Suspense>
  );
}

// ── Sub-section components ──────────────────────────────────────────────────

function IntroSection({ lj, colors, isDarkMode }: { lj: LessonJson; colors: Colors; isDarkMode: boolean }) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ borderRadius: 20, padding: 20, background: "linear-gradient(135deg,#1e1b4b,#312e81)", display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 900 }}>{lj.storyHook.title}</span>
        <span style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.55 }}>{lj.storyHook.narration}</span>
        <div style={{ background: "rgba(99,102,241,0.2)", borderRadius: 12, padding: 12 }}>
          <div style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>🎯 Your Mission</div>
          <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.4 }}>{lj.storyHook.studentMission}</div>
        </div>
      </div>

      <div style={cardStyle(colors, isDarkMode)}>
        <span style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>📌 What you'll learn</span>
        {lj.learningObjectives.map((o, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "#6366f1", fontSize: 14, marginTop: 1 }}>→</span>
            <span style={{ flex: 1, color: isDarkMode ? "#cbd5e1" : colors.text, fontSize: 14, lineHeight: 1.4 }}>{o}</span>
          </div>
        ))}
      </div>

      {lj.prerequisites?.length > 0 && (
        <div style={{ ...cardStyle(colors, isDarkMode), border: `1px solid ${isDarkMode ? "#334155" : colors.border}` }}>
          <span style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>📋 Prerequisites</span>
          {lj.prerequisites.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "#6366f1", fontSize: 14, marginTop: 1 }}>•</span>
              <span style={{ flex: 1, color: isDarkMode ? "#cbd5e1" : colors.text, fontSize: 14, lineHeight: 1.4 }}>{p}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

function SceneSection({ lj, sceneIdx, setSceneIdx, progress, totalScenes, onFollowUp, colors, isDarkMode }: {
  lj: LessonJson; sceneIdx: number; setSceneIdx: (i: number) => void;
  progress: number; totalScenes: number; onFollowUp: (mode: string) => void;
  colors: Colors; isDarkMode: boolean;
}) {
  const scene = lj.scenes[sceneIdx];
  if (!scene) return null;
  const cardBg = isDarkMode ? "#1e293b" : colors.card;
  const trackBg = isDarkMode ? "#334155" : colors.border;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", gap: 10 }}>
        <button className="pl-btn" disabled={sceneIdx === 0} onClick={() => setSceneIdx(sceneIdx - 1)} style={{ width: 36, height: 36, borderRadius: 10, background: cardBg, display: "flex", alignItems: "center", justifyContent: "center", color: sceneIdx === 0 ? trackBg : "#6366f1", fontSize: 16 }}>‹</button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ height: 4, background: cardBg, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#6366f1", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <span style={{ color: colors.textSecondary, fontSize: 10, textAlign: "center" }}>{sceneIdx + 1} / {totalScenes}</span>
        </div>
        <button className="pl-btn" disabled={sceneIdx === totalScenes - 1} onClick={() => setSceneIdx(sceneIdx + 1)} style={{ width: 36, height: 36, borderRadius: 10, background: cardBg, display: "flex", alignItems: "center", justifyContent: "center", color: sceneIdx === totalScenes - 1 ? trackBg : "#6366f1", fontSize: 16 }}>›</button>
      </div>
      <SceneCard
        key={sceneIdx}
        scene={scene}
        totalScenes={totalScenes}
        onExplainAgain={() => onFollowUp("explain_simple")}
        onSimplify={() => onFollowUp("explain_simple")}
        onExample={() => onFollowUp("real_life_example")}
        onTranslate={() => onFollowUp("translate")}
      />
    </div>
  );
}

function ConceptsSection({ lj, colors, isDarkMode }: { lj: LessonJson; colors: Colors; isDarkMode: boolean }) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {lj.keyConcepts.map((kc: KeyConcept, i: number) => (
        <div key={i} style={cardStyle(colors, isDarkMode)}>
          <span style={{ color: "#a5b4fc", fontSize: 16, fontWeight: 900 }}>{kc.term}</span>
          <span style={{ color: isDarkMode ? "#cbd5e1" : colors.text, fontSize: 14, lineHeight: 1.4 }}>{kc.simpleMeaning}</span>
          {kc.realLifeExample && (
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              <span style={{ color: "#06b6d4", fontSize: 12, fontWeight: 700 }}>Real-life: </span>
              <span style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}>{kc.realLifeExample}</span>
            </div>
          )}
        </div>
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
}

function ActivitySection({ lj, lessonId, lesson, onXp, colors, isDarkMode }: { lj: LessonJson; lessonId: string; lesson: AiGuruLesson | null; onXp: (v: number) => void; colors: Colors; isDarkMode: boolean }) {
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(response: string) {
    setLoading(true);
    try {
      const resp = await sendFollowUp(lessonId, response, lesson?.language ?? "English", "evaluate_practical");
      setEvalResult(resp.answer);
      onXp(15);
    } catch {
      alert("Could not evaluate your response.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <PracticalActivityCard activity={lj.practicalActivity} onSubmit={handleSubmit} loading={loading} />
      {evalResult && (
        <div style={{ background: isDarkMode ? "#0f172a" : colors.card, borderRadius: 16, padding: 16, border: "1px solid #6366f1" }}>
          <div style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 800, marginBottom: 8 }}>🤖 AI Guru Feedback</div>
          <div style={{ color: isDarkMode ? "#cbd5e1" : colors.text, fontSize: 14, lineHeight: 1.55 }}>{evalResult}</div>
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

function NotesSection({ lj, colors, isDarkMode }: { lj: LessonJson; colors: Colors; isDarkMode: boolean }) {
  const cardBg = isDarkMode ? "#1e293b" : colors.card;
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>📝 Quick Revision Notes</span>
      {lj.quickRevisionNotes.map((note, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: cardBg, borderRadius: 12, padding: 12, borderLeft: "3px solid #6366f1" }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "#6366f1", marginTop: 7, flexShrink: 0 }} />
          <span style={{ flex: 1, color: isDarkMode ? "#cbd5e1" : colors.text, fontSize: 14, lineHeight: 1.4 }}>{note}</span>
        </div>
      ))}
      {lj.examTips?.length > 0 && (
        <>
          <span style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 800, letterSpacing: 0.3, marginTop: 20 }}>🎯 Exam Tips</span>
          {lj.examTips.map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: cardBg, borderRadius: 12, padding: 12, borderLeft: "3px solid #fbbf24" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#fbbf24", marginTop: 7, flexShrink: 0 }} />
              <span style={{ flex: 1, color: isDarkMode ? "#cbd5e1" : colors.text, fontSize: 14, lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
        </>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

function MissionSection({ lj, colors, isDarkMode }: { lj: LessonJson; colors: Colors; isDarkMode: boolean }) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ borderRadius: 20, padding: 24, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, background: "linear-gradient(135deg,#1a1a2e,#312e81)" }}>
        <span style={{ fontSize: 48 }}>🏆</span>
        <span style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 900 }}>{lj.finalMission.title}</span>
        <span style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.55 }}>{lj.finalMission.task}</span>
        {lj.finalMission.rewardText && (
          <div style={{ background: "rgba(251,191,36,0.15)", borderRadius: 12, padding: "8px 14px", border: "1px solid #fbbf24" }}>
            <span style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>🎁 {lj.finalMission.rewardText}</span>
          </div>
        )}
      </div>

      {lj.commonMistakes?.length > 0 && (
        <div style={cardStyle(colors, isDarkMode)}>
          <span style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>⚠️ Common Mistakes</span>
          {lj.commonMistakes.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: "#ef4444", fontSize: 13 }}>✗ {m.mistake}</span>
              <span style={{ color: "#10b981", fontSize: 13 }}>✓ {m.correction}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}
