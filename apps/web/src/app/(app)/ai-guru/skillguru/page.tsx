"use client";
// PATH: apps/web/src/app/(app)/ai-guru/skillguru/page.tsx
// Replaces apps/web/src/app/(app)/ai-guru/vidyaguru/page.tsx.
//
// REBUILD (VidyaGuru → SkillGuru): VidyaGuru was a generic "ask me
// anything about your studies" chat tutor — functionally the same job
// Ask AI Guru already does as a single-shot search, just turned into an
// ongoing conversation. That overlap is gone now: SkillGuru drops the
// generic-syllabus framing entirely and becomes a dedicated skills coach
// — resume building, interview prep, communication, coding/tech basics,
// and soft skills (teamwork, leadership, time management). See
// lib/aiGuru/skillGuruDomains.ts for the category definitions, starter
// prompts, and the reasoning behind keeping the same backend endpoint.
//
// NEW in this rebuild:
//   - Skill-category picker (5 categories) replaces the old single flat
//     STARTER_PROMPTS list — picking a category shows that category's own
//     starter prompts instead of one generic set for everything.
//   - Every outgoing message is prefixed with a skill-context tag (see
//     buildSkillContextPrefix) naming the active category, so the shared
//     /vidyaguruChat endpoint stays anchored to skills coaching rather
//     than drifting back into syllabus-doubt tutoring.
//   - Header shows the active category's emoji/color instead of a fixed
//     emerald identity for every conversation, so switching skill areas
//     visibly changes the screen, not just the prompt.
//
// UNCHANGED: still calls the same Cloud Function endpoint (via
// services/skillGuruApi.ts, renamed from vidyaguruApi.ts — same
// request/response shape), still persists to Firestore (via
// services/skillGuruSessions.ts, new "skillGuruSessions" collection —
// see that file for why this doesn't carry over old VidyaGuru history),
// still renders followUps as suggestion chips. Voice input/output is
// still intentionally not included on web.

import { useRef, useState } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { useStudentProfile } from "@gloows/shared-logic";
import { useLanguage, useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { askSkillGuru, type ConversationTurn } from "@/services/skillGuruApi";
import { ensureSession, appendMessages, type StoredMessage } from "@/services/skillGuruSessions";
import {
  SKILL_CATEGORIES,
  getSkillCategory,
  buildSkillContextPrefix,
  buildSkillGuruGreeting,
  type SkillCategoryKey,
} from "@/lib/aiGuru/skillGuruDomains";

interface Message {
  id:        string;
  role:      "user" | "assistant";
  text:      string;
  createdAt: number;
}

// Identity colors when no category is picked yet (neutral indigo, matches
// the rest of the AI Guru suite) — once a category is active, its own
// color (from SKILL_CATEGORIES) takes over the header/avatar/send button.
const NEUTRAL      = "#6366f1";
const NEUTRAL_DARK = "#4338ca";
const GOLD         = "#d4a017";

function newSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function SkillGuruPage() {
  const { studentProfile } = useStudentProfile();
  const { languageName }   = useLanguage();
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const firstName    = studentProfile?.name?.split(" ")[0] ?? "there";
  const studentClass = String(studentProfile?.class ?? "10");

  const [activeCategory, setActiveCategory] = useState<SkillCategoryKey | null>(null);
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState("");
  const [thinking,  setThinking]  = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  // Set only on a CREDITS_EXHAUSTED response — undefined keeps the
  // paywall's plain pre-credits copy/CTA.
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);
  const taRef     = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep messages in a ref so sendMessage's async callback never reads a
  // stale closure value.
  const messagesRef = useRef<Message[]>([]);
  const sessionIdRef = useRef<string>(newSessionId());

  const category = activeCategory ? getSkillCategory(activeCategory) : null;
  const accent      = category?.color ?? NEUTRAL;
  const accentDark  = category ? `${category.color}cc` : NEUTRAL_DARK;

  async function sendMessage(text?: string, categoryOverride?: SkillCategoryKey) {
    const q = (text || input).trim();
    if (!q || thinking) return;

    // FIX: this used to hard-block after 1 message per session via a
    // client-side, never-resetting studentMessagesSentRef counter —
    // stricter than the server's real daily limit (1/day, functions/src/
    // usageCheck.ts's checkVidyaGuruLimit — this page and ai-guru/
    // vidyaguru share the same /vidyaguruChat backend function) and meant
    // nobody could ever reach the credits fallback past their first
    // message of a session. Removed; the server is the source of truth.
    // Mirrors apps/mobile/app/ai-guru/skillguru.tsx's identical fix.

    const effectiveCategoryKey = categoryOverride ?? activeCategory;
    if (categoryOverride && categoryOverride !== activeCategory) setActiveCategory(categoryOverride);
    const effectiveCategory = effectiveCategoryKey ? getSkillCategory(effectiveCategoryKey) : null;

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
      const errMsg: Message = { id: `g_${Date.now()}`, role: "assistant", text: t("pleaseLogInSkillGuru", "Please log in to use SkillGuru."), createdAt: Date.now() };
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
    // just appended — the backend receives that one as `message` itself.
    const conversationHistory: ConversationTurn[] = messagesRef.current.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "guru" : "student",
      text: m.text,
    }));

    // Prefix the outgoing message with a skill-context tag so the shared
    // chat endpoint stays anchored to skills coaching — see
    // skillGuruDomains.ts for why this exists instead of a backend field.
    const outgoingMessage = effectiveCategory
      ? `${buildSkillContextPrefix(effectiveCategory)}${q}`
      : q;

    try {
      const resp = await askSkillGuru({
        message: outgoingMessage,
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
      // FIX: this used to render every failure (including a genuine
      // CREDITS_EXHAUSTED/FREE_LIMIT_REACHED block) as a plain assistant
      // chat bubble, so the paywall modal below was dead UI — showPaywall
      // was only ever set by the now-removed client pre-gate. Route
      // through the paywall for those two codes specifically, same as
      // mobile's app/ai-guru/skillguru.tsx.
      if (e?.code === "CREDITS_EXHAUSTED") {
        setCreditInfo({ balance: e.creditBalance ?? 0, required: e.creditsRequired ?? 1 });
        setShowPaywall(true);
      } else if (e?.code === "FREE_LIMIT_REACHED") {
        setCreditInfo(undefined);
        setShowPaywall(true);
      } else {
        const errText = e?.message ?? t("networkErrorRetry", "Network error. Please try again.");
        const errMsg: Message = { id: `g_${Date.now()}`, role: "assistant", text: errText, createdAt: Date.now() };
        messagesRef.current = [...messagesRef.current, errMsg];
        setMessages([...messagesRef.current]);
        // Not persisted — an error message isn't part of the coaching
        // record worth keeping.
      }
    }

    setThinking(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function clearChat() {
    messagesRef.current = [];
    setMessages([]);
    setFollowUps([]);
    setActiveCategory(null);
    sessionIdRef.current = newSessionId(); // new session, doesn't touch the saved prior one
  }

  function pickCategory(key: SkillCategoryKey) {
    setActiveCategory(key);
  }

  // Theme-aware colors — accent follows the active skill category once
  // one is picked, falling back to neutral indigo before that.
  const bgGradient   = isDarkMode ? "linear-gradient(180deg,#0a0a1a,#0d0d24)" : "linear-gradient(180deg,#f5f6fb,#eef0fa)";
  const headerBg      = isDarkMode ? "rgba(10,10,26,0.97)" : "rgba(255,255,255,0.92)";
  const surfaceBg     = isDarkMode ? "#161b33" : colors.card;
  const borderCol     = isDarkMode ? "#2a2f52" : colors.border;
  const textColor     = isDarkMode ? "#f1f5f9" : colors.text;
  const mutedColor    = isDarkMode ? "#7c83a8" : colors.textSecondary;
  const bubbleAssistantBg     = isDarkMode ? "#161b33" : "#eef0fa";
  const bubbleAssistantBorder = isDarkMode ? "#2a2f52" : "#d8dcf3";

  const greetingBody = buildSkillGuruGreeting(t, languageName);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: bgGradient, overflow: "hidden" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        textarea{resize:none;font-family:inherit}
        textarea::placeholder{color:${mutedColor}}
        .sg-btn{cursor:pointer}.sg-btn:hover{opacity:.85}
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 10, borderBottom: `1px solid ${borderCol}`, flexShrink: 0, background: headerBg }}>
        <Link href="/ai-guru" style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: mutedColor, fontSize: 20, fontWeight: 900 }}>‹</Link>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg,${accentDark},${accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{category?.emoji ?? "🎯"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: textColor, fontSize: 15, fontWeight: 900 }}>{t("skillGuruAI", "SkillGuru")}</div>
          <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>● {category ? category.label : t("onlineLabel", "Online")}</div>
        </div>

        {/* Language badge — gold-themed, tappable, jumps to language
            settings. */}
        <Link
          href="/settings/language"
          className="sg-btn"
          style={{
            display: "flex", alignItems: "center", gap: 5, textDecoration: "none",
            background: isDarkMode ? "rgba(212,160,23,0.15)" : "#fef3d6",
            border: `1px solid ${GOLD}`, borderRadius: 14, padding: "5px 10px",
          }}
        >
          <span style={{ fontSize: 12 }}>🌐</span>
          <span style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>{languageName}</span>
        </Link>

        <button className="sg-btn" onClick={clearChat} style={{ color: mutedColor, fontSize: 12, background: "none", border: `1px solid ${borderCol}`, borderRadius: 20, padding: "5px 10px" }}>{t("clearLabel", "Clear")}</button>
      </div>

      {/* Skill-category strip — always visible so the student can switch
          focus mid-conversation, not just at the start. */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 16px", flexShrink: 0, borderBottom: `1px solid ${borderCol}` }}>
        {SKILL_CATEGORIES.map((c) => (
          <button
            key={c.key}
            className="sg-btn"
            onClick={() => pickCategory(c.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 20,
              border: `1px solid ${activeCategory === c.key ? c.color : borderCol}`,
              background: activeCategory === c.key ? `${c.color}18` : "transparent",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13 }}>{c.emoji}</span>
            <span style={{ color: activeCategory === c.key ? c.color : mutedColor, fontSize: 12, fontWeight: 700 }}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 24, gap: 12 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${accentDark},${accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, boxShadow: `0 0 30px ${accent}66` }}>{category?.emoji ?? "🎯"}</div>
            <div style={{ color: textColor, fontSize: 20, fontWeight: 900 }}>{t("helloGreet", "Hello")} {firstName}! 👋</div>
            <div style={{ color: mutedColor, fontSize: 13, textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
              {category ? category.description : greetingBody}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 14, gap: 8 }}>
            {m.role === "assistant" && (
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${accentDark},${accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 4 }}>{category?.emoji ?? "🎯"}</div>
            )}
            <div style={{
              maxWidth: "80%", padding: "12px 16px",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? accentDark : bubbleAssistantBg,
              border: m.role === "assistant" ? `1px solid ${bubbleAssistantBorder}` : undefined,
            }}>
              <div style={{ color: m.role === "user" ? "#fff" : textColor, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          </div>
        ))}

        {thinking && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${accentDark},${accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{category?.emoji ?? "🎯"}</div>
            <div style={{ display: "flex", gap: 4, padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: bubbleAssistantBg, border: `1px solid ${bubbleAssistantBorder}` }}>
              {[0, 1, 2].map((j) => <div key={j} style={{ width: 8, height: 8, borderRadius: "50%", background: accent, animation: `bounce .9s ease-in-out ${j * .15}s infinite` }} />)}
            </div>
          </div>
        )}

        {/* Follow-up suggestions — tapping one sends it as the next
            message, same as a starter prompt. */}
        {!thinking && followUps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, marginBottom: 14 }}>
            <div style={{ color: mutedColor, fontSize: 11, fontWeight: 700, paddingLeft: 4, letterSpacing: 0.5 }}>{t("followUpSuggestions", "CONTINUE WITH:")}</div>
            {followUps.map((f, i) => (
              <button key={i} className="sg-btn" onClick={() => sendMessage(f)} style={{ textAlign: "left", padding: "9px 14px", borderRadius: 12, border: `1px solid ${GOLD}59`, background: isDarkMode ? "rgba(212,160,23,0.1)" : "#fef3d6", color: GOLD, fontSize: 13 }}>
                {f}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 20px", borderTop: `1px solid ${borderCol}`, background: headerBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: surfaceBg, border: `1px solid ${accent}4d`, borderRadius: 26, padding: "5px 5px 5px 14px" }}>
          <textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={t("askSkillGuruPlaceholder", "Ask SkillGuru about a skill…")} rows={1} maxLength={500}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: textColor, fontSize: 15, lineHeight: 1.5, paddingTop: 6, paddingBottom: 6 }}
          />
          <button className="sg-btn" onClick={() => sendMessage()} disabled={!input.trim() || thinking} style={{
            width: 40, height: 40, borderRadius: 20, border: "none",
            background: input.trim() && !thinking ? `linear-gradient(135deg,${accent},${accentDark})` : surfaceBg,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            opacity: input.trim() && !thinking ? 1 : .4,
          }}>
            <span style={{ color: "#fff", fontSize: 18, lineHeight: 1 }}>↑</span>
          </button>
        </div>
      </div>

      {/* Paywall overlay — shown on a CREDITS_EXHAUSTED/FREE_LIMIT_REACHED
          response from the shared /vidyaguruChat backend. */}
      {showPaywall && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 50, padding: 24 }} onClick={() => setShowPaywall(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, borderRadius: 24, padding: 28, background: isDarkMode ? "#161b33" : colors.background, border: `1px solid ${borderCol}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg,${accentDark},${accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{category?.emoji ?? "🎯"}</div>
            <div style={{ color: textColor, fontSize: 19, fontWeight: 900 }}>{t("paywallTitleSkillGuru", "Continue with SkillGuru?")}</div>
            <div style={{ color: mutedColor, fontSize: 14, lineHeight: 1.55 }}>
              {creditInfo
                ? `You've used your free question for today. You have ${creditInfo.balance} credit${creditInfo.balance===1?"":"s"} — buy more or upgrade to Premium for unlimited conversations.`
                : t("paywallBody", "You've used your free question for today. Upgrade to Premium for unlimited conversations!")}
            </div>
            <Link
              href={creditInfo ? "/ai-guru/credits" : "/ai-guru/subscription"}
              style={{ width: "100%", padding: "14px 0", borderRadius: 16, background: creditInfo ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : `linear-gradient(135deg,${accent},${accentDark})`, color: "#fff", fontSize: 15, fontWeight: 800, textAlign: "center", textDecoration: "none", display: "block" }}
            >
              {creditInfo ? "⚡ Buy Credits" : `✨ ${t("upgradeToPremium", "Upgrade to Premium")}`}
            </Link>
            {creditInfo && (
              <Link href="/ai-guru/subscription" style={{ color: mutedColor, fontSize: 12, textDecoration: "none" }}>
                Or upgrade to Premium for unlimited access
              </Link>
            )}
            <button className="sg-btn" onClick={() => setShowPaywall(false)} style={{ background: "none", border: "none", color: mutedColor, fontSize: 13, fontWeight: 600, padding: "4px 0" }}>
              {t("maybeLater", "Maybe Later")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
