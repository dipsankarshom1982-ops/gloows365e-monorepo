"use client";
// PATH: apps/web/src/app/(app)/ai-guru/vidyaguru/page.tsx
//
// REBUILD (visual identity + theme + India-student-friendly UX): this page
// previously used purple/violet (#4c1d95/#7c3aed) throughout — the same
// generic "AI assistant" palette every other AI Guru screen on web also
// leans on — and was hardcoded dark-only, ignoring the app's own
// ThemeContext (useTheme/isDarkMode/colors) entirely, unlike most of the
// rest of the app. Mirrors the same emerald + gold identity rebuild
// already done for mobile's app/ai-guru/vidyaguru.tsx — see that file's
// header comment for the full reasoning on color choice.
//
// NEW in this pass (ported from mobile's rebuild, adapted for web):
//   - Theme-aware: now reads useTheme()/isDarkMode/colors instead of a
//     fixed dark gradient, matching how the rest of this app already
//     behaves.
//   - Greeting references the student's class (and board, when known)
//     instead of a generic "ask me anything" line.
//   - Starter prompts reworded to feel like genuine doubts brought to a
//     1-on-1 tutor (confusion, exam nerves, "explain it simpler") instead
//     of factual lookups — that tone belongs to ask.tsx's search
//     experience, not here.
//   - Language indicator promoted to a tappable gold badge linking to
//     /settings/language, instead of a passive "Online · {language}" line.
//
// UNCHANGED from the previous fix (history/persistence/follow-ups are
// correct and untouched): still calls /vidyaguruChat via
// services/vidyaguruApi.ts with full conversationHistory, still persists
// to Firestore via services/vidyaguruSessions.ts, still renders followUps
// as suggestion chips.
//
// Voice input/output is still intentionally not included — see the
// previous header comment (now superseded by this one) for why; nothing
// has changed about that constraint.

import { useRef, useState } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { useStudentProfile } from "@gloows/shared-logic";
import { useLanguage, useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { askVidyaGuru, type ConversationTurn } from "@/services/vidyaguruApi";
import { ensureSession, appendMessages, type StoredMessage } from "@/services/vidyaguruSessions";

interface Message {
  id:        string;
  role:      "user" | "assistant";
  text:      string;
  createdAt: number;
}

// FEATURE (distinct identity from other AI Guru screens): same emerald +
// gold identity as mobile's rebuild — not the purple/violet
// (#4c1d95/#7c3aed) every other AI Guru screen on web already uses.
const EMERALD      = "#10b981";
const EMERALD_DARK = "#0f6e56";
const GOLD         = "#d4a017";

// FEATURE (starter prompts): reworded from factual/encyclopedic
// ("Explain photosynthesis", "What caused WWII") to genuine doubts a
// student brings to a personal tutor — mirrors mobile's rebuild exactly,
// keeping the tone consistent across platforms.
const STARTER_PROMPTS = [
  "I don't understand this topic at all, can you explain it simply?",
  "I'm nervous about my exam next week, what should I do?",
  "Can you explain this like I'm in Class 6, step by step?",
  "Give me 3 tricks to remember this chapter easily",
  "I keep making the same mistake in my homework, help me fix it",
  "Quiz me on what I studied today",
];

// One session per mount, matching the existing "chat resets on navigate
// away and back" boundary the UI already had — see vidyaguruSessions.ts
// for why this is a session-scoped doc rather than per-message docs.
function newSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function VidyaGuruPage() {
  const { studentProfile } = useStudentProfile();
  const { languageName }   = useLanguage();
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const firstName    = studentProfile?.name?.split(" ")[0] ?? "there";
  const studentClass = String(studentProfile?.class ?? "10");
  const board        = studentProfile?.board as string | undefined;

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState("");
  const [thinking,  setThinking]  = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const taRef     = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep messages in a ref so sendMessage's async callback never reads a
  // stale closure value — same pattern mobile's vidyaguru.tsx already
  // uses, and the actual fix for "history was never sent": building
  // conversationHistory from state here would risk using a snapshot from
  // before the latest setMessages call resolved.
  const messagesRef = useRef<Message[]>([]);
  const sessionIdRef = useRef<string>(newSessionId());

  async function sendMessage(text?: string) {
    const q = (text || input).trim();
    if (!q || thinking) return;

    const studentMsg: Message = { id: `s_${Date.now()}`, role: "user", text: q, createdAt: Date.now() };
    const nextMessages = [...messagesRef.current, studentMsg];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setInput("");
    setThinking(true);
    setFollowUps([]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      const errMsg: Message = { id: `g_${Date.now()}`, role: "assistant", text: t("pleaseLogInVidyaGuru", "Please log in to use VidyaGuru."), createdAt: Date.now() };
      messagesRef.current = [...messagesRef.current, errMsg];
      setMessages([...messagesRef.current]);
      setThinking(false);
      return;
    }

    // Persist the student's message immediately — don't wait on the AI
    // response, so a slow/failed reply doesn't also lose what was asked.
    ensureSession(uid, sessionIdRef.current).then(() =>
      appendMessages(uid, sessionIdRef.current, [
        { id: studentMsg.id, role: "student", text: studentMsg.text, createdAt: studentMsg.createdAt },
      ])
    ).catch(() => { /* best-effort — a failed save shouldn't block the chat */ });

    // Build history from the ref (always current), excluding the message
    // just appended — the backend receives that one as `message` itself,
    // not as part of the prior-turns history.
    const conversationHistory: ConversationTurn[] = messagesRef.current.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "guru" : "student",
      text: m.text,
    }));

    try {
      const resp = await askVidyaGuru({
        message: q,
        conversationHistory,
        studentName: firstName,
        classLevel:  studentClass,
        language:    languageName,
      });

      const guruMsg: Message = { id: `g_${Date.now()}`, role: "assistant", text: resp.answer, createdAt: Date.now() };
      messagesRef.current = [...messagesRef.current, guruMsg];
      setMessages([...messagesRef.current]);
      setFollowUps(resp.followUps ?? []);

      appendMessages(uid, sessionIdRef.current, [
        { id: guruMsg.id, role: "guru", text: guruMsg.text, createdAt: guruMsg.createdAt },
      ]).catch(() => {});
    } catch (e: any) {
      const errText = e?.message ?? t("networkErrorRetry", "Network error. Please try again.");
      const errMsg: Message = { id: `g_${Date.now()}`, role: "assistant", text: errText, createdAt: Date.now() };
      messagesRef.current = [...messagesRef.current, errMsg];
      setMessages([...messagesRef.current]);
      // Not persisted — an error message isn't part of the tutoring
      // record worth keeping, and retrying the same question shouldn't
      // accumulate duplicate error entries in storage.
    }

    setThinking(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function clearChat() {
    messagesRef.current = [];
    setMessages([]);
    setFollowUps([]);
    sessionIdRef.current = newSessionId(); // new session, doesn't touch the saved prior one
  }

  // Theme-aware colors — emerald/gold instead of the purple/violet every
  // other AI Guru screen on web uses, and now actually respecting
  // isDarkMode/colors instead of a hardcoded dark gradient.
  const bgGradient   = isDarkMode ? "linear-gradient(180deg,#06140f,#0a1f17)" : "linear-gradient(180deg,#f0fbf6,#e3f5ec)";
  const headerBg     = isDarkMode ? "rgba(6,20,15,0.97)" : "rgba(255,255,255,0.92)";
  const surfaceBg    = isDarkMode ? "#0f3d2e" : colors.card;
  const borderCol    = isDarkMode ? EMERALD_DARK : colors.border;
  const textColor    = isDarkMode ? "#f1f5f9" : colors.text;
  const mutedColor   = isDarkMode ? "#5a8b78" : colors.textSecondary;
  const bubbleAssistantBg = isDarkMode ? "#0f3d2e" : "#e6f5ee";
  const bubbleAssistantBorder = isDarkMode ? EMERALD_DARK : "#bfe8d4";

  // Greeting body — board/class-aware, same logic as mobile's rebuild.
  const greetingBody = board
    ? t(
        "vidyaGuruGreetingWithBoard",
        `I'm VidyaGuru, your personal AI teacher for Class ${studentClass} (${board}). Ask me anything — doubts, homework help, exam tips, or just a friendly chat about what you're learning. I can answer in ${languageName} too!`,
        { classLevel: studentClass, board, language: languageName }
      )
    : t(
        "vidyaGuruGreetingNoBoard",
        `I'm VidyaGuru, your personal AI teacher for Class ${studentClass}. Ask me anything — doubts, homework help, exam tips, or just a friendly chat about what you're learning. I can answer in ${languageName} too!`,
        { classLevel: studentClass, language: languageName }
      );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: bgGradient, overflow: "hidden" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        textarea{resize:none;font-family:inherit}
        textarea::placeholder{color:${mutedColor}}
        .vg-btn{cursor:pointer}.vg-btn:hover{opacity:.85}
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 10, borderBottom: `1px solid ${borderCol}`, flexShrink: 0, background: headerBg }}>
        <Link href="/ai-guru" style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: mutedColor, fontSize: 20, fontWeight: 900 }}>‹</Link>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg,${EMERALD_DARK},${EMERALD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🧑‍🏫</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: textColor, fontSize: 15, fontWeight: 900 }}>{t("vidyaGuruAI", "VidyaGuru")}</div>
          <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>● {t("onlineLabel", "Online")}</div>
        </div>

        {/* Language badge — gold-themed (VidyaGuru's highlight color),
            tappable, jumps to language settings. Mirrors mobile's rebuild
            where this was promoted from a passive label to an actionable
            control, since preferred language was specifically called out
            as something that should be easy to act on, not just see. */}
        <Link
          href="/settings/language"
          className="vg-btn"
          style={{
            display: "flex", alignItems: "center", gap: 5, textDecoration: "none",
            background: isDarkMode ? "rgba(212,160,23,0.15)" : "#fef3d6",
            border: `1px solid ${GOLD}`, borderRadius: 14, padding: "5px 10px",
          }}
        >
          <span style={{ fontSize: 12 }}>🌐</span>
          <span style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>{languageName}</span>
        </Link>

        <button className="vg-btn" onClick={clearChat} style={{ color: mutedColor, fontSize: 12, background: "none", border: `1px solid ${borderCol}`, borderRadius: 20, padding: "5px 10px" }}>{t("clearLabel", "Clear")}</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 24, gap: 12 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${EMERALD_DARK},${EMERALD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, boxShadow: `0 0 30px ${EMERALD}66` }}>🧑‍🏫</div>
            <div style={{ color: textColor, fontSize: 20, fontWeight: 900 }}>नमस्ते {firstName}! 👋</div>
            <div style={{ color: mutedColor, fontSize: 13, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
              {greetingBody}
            </div>
            <div style={{ width: "100%", marginTop: 8 }}>
              <div style={{ color: mutedColor, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>{t("tryAskingVidyaGuru", "OR TRY ASKING")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {STARTER_PROMPTS.map((p) => (
                  <button key={p} className="vg-btn" onClick={() => sendMessage(p)} style={{ textAlign: "left", padding: "10px 14px", borderRadius: 12, border: `1px solid ${borderCol}`, background: surfaceBg, color: textColor, fontSize: 13, lineHeight: 1.4 }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 14, gap: 8 }}>
            {m.role === "assistant" && (
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${EMERALD_DARK},${EMERALD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 4 }}>🧑‍🏫</div>
            )}
            <div style={{
              maxWidth: "80%", padding: "12px 16px",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? EMERALD_DARK : bubbleAssistantBg,
              border: m.role === "assistant" ? `1px solid ${bubbleAssistantBorder}` : undefined,
            }}>
              <div style={{ color: m.role === "user" ? "#e6f5ee" : textColor, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          </div>
        ))}

        {thinking && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${EMERALD_DARK},${EMERALD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🧑‍🏫</div>
            <div style={{ display: "flex", gap: 4, padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: bubbleAssistantBg, border: `1px solid ${bubbleAssistantBorder}` }}>
              {[0, 1, 2].map((j) => <div key={j} style={{ width: 8, height: 8, borderRadius: "50%", background: EMERALD, animation: `bounce .9s ease-in-out ${j * .15}s infinite` }} />)}
            </div>
          </div>
        )}

        {/* Follow-up suggestions — unchanged from the previous fix: the
            backend has returned these in VidyaGuruResponse.followUps all
            along, nothing rendered them before on either platform.
            Tapping one sends it as the next message, same as a starter
            prompt. Re-skinned to gold (matches the language badge — both
            are "secondary/highlight" actions, not primary like Send). */}
        {!thinking && followUps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, marginBottom: 14 }}>
            <div style={{ color: mutedColor, fontSize: 11, fontWeight: 700, paddingLeft: 4, letterSpacing: 0.5 }}>{t("followUpSuggestions", "CONTINUE WITH:")}</div>
            {followUps.map((f, i) => (
              <button key={i} className="vg-btn" onClick={() => sendMessage(f)} style={{ textAlign: "left", padding: "9px 14px", borderRadius: 12, border: `1px solid ${GOLD}59`, background: isDarkMode ? "rgba(212,160,23,0.1)" : "#fef3d6", color: GOLD, fontSize: 13 }}>
                {f}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 20px", borderTop: `1px solid ${borderCol}`, background: headerBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: surfaceBg, border: `1px solid ${EMERALD}4d`, borderRadius: 26, padding: "5px 5px 5px 14px" }}>
          <textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={t("askVidyaGuruPlaceholder", "Ask VidyaGuru anything…")} rows={1} maxLength={500}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: textColor, fontSize: 15, lineHeight: 1.5, paddingTop: 6, paddingBottom: 6 }}
          />
          <button className="vg-btn" onClick={() => sendMessage()} disabled={!input.trim() || thinking} style={{
            width: 40, height: 40, borderRadius: 20, border: "none",
            background: input.trim() && !thinking ? `linear-gradient(135deg,${EMERALD},${EMERALD_DARK})` : surfaceBg,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            opacity: input.trim() && !thinking ? 1 : .4,
          }}>
            <span style={{ color: "#fff", fontSize: 18, lineHeight: 1 }}>↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}