"use client";

// PATH: apps/web/src/app/restart-education/ai-advisor/page.tsx
// Web port of apps/mobile/app/restart-education/ai-advisor.tsx — calls the
// same restartEducationAdvisor Cloud Function and reads/writes the same
// restartEducationChats/{uid} doc, so a conversation started on one
// platform continues seamlessly on the other.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import AuthGuard from "@/components/layout/AuthGuard";
import LeadCaptureModal from "@/components/restart/LeadCaptureModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const advisorCF = httpsCallable<{ message: string }, { reply: string }>(
  functions, "restartEducationAdvisor"
);

const PREDEFINED_OPTIONS = [
  { emoji: "❌", text: "I failed Class 10" },
  { emoji: "❌", text: "I failed Class 12" },
  { emoji: "💸", text: "I left school due to financial problems" },
  { emoji: "👷", text: "I am working and want to study" },
  { emoji: "📖", text: "Tell me about Open Schooling" },
  { emoji: "🎓", text: "Tell me about Distance Learning" },
  { emoji: "🛠️", text: "Tell me about Vocational Education" },
  { emoji: "💡", text: "What are my options at my age?" },
  { emoji: "💬", text: "Other" },
];

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Hello! I'm your Education Advisor. 🎓\n\nI'm here to help you find the best way to continue your education. There's no judgment here — just guidance.\n\nWhat brings you here today? You can choose one of the options below or type your own question.",
  timestamp: Date.now(),
};

function AiAdvisorContent() {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showOptions, setShowOptions] = useState(true);
  const [initLoading, setInitLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) { setInitLoading(false); return; }
    getDoc(doc(db, "restartEducationChats", uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const msgs = (data.messages ?? []) as Message[];
          if (msgs.length > 0) {
            setMessages(msgs);
            setShowOptions(false);
          }
          setMessageCount(data.messageCount ?? 0);
          setLeadCaptured(data.leadCaptured ?? false);
        }
      })
      .catch(() => {})
      .finally(() => setInitLoading(false));
  }, [uid]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setShowOptions(false);
    setLoading(true);

    try {
      const result = await advisorCF({ message: text.trim() });
      const assistantMsg: Message = { role: "assistant", content: result.data.reply, timestamp: Date.now() };
      setMessages((prev) => [...prev, assistantMsg]);

      const newCount = messageCount + 1;
      setMessageCount(newCount);

      if (newCount >= 3 && !leadCaptured) {
        setTimeout(() => setShowLead(true), 1200);
      }
    } catch (e) {
      const msg = e instanceof Error && e.message.includes("Could not get a response")
        ? "I'm having trouble right now. Please check your connection and try again."
        : "Something went wrong. Please try again in a moment.";
      setMessages((prev) => [...prev, { role: "assistant", content: msg, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleLeadCaptured = async () => {
    setLeadCaptured(true);
    setShowLead(false);
    if (uid) {
      updateDoc(doc(db, "restartEducationChats", uid), { leadCaptured: true }).catch(() => {});
    }
  };

  if (initLoading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={S.spinner} />
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => router.back()} aria-label="Back">←</button>
        <div>
          <div style={S.headerTitle}>🤖 AI Education Advisor</div>
          <div style={S.headerSub}>Free · Confidential · Helpful</div>
        </div>
      </div>

      <div style={S.chatArea}>
        <div style={S.messagesList} ref={listRef}>
          {messages.map((item, i) => (
            <div key={i} style={{ ...S.bubble, ...(item.role === "user" ? S.bubbleUser : S.bubbleBot) }}>
              {item.role === "assistant" && <div style={S.botAvatar}>🤖</div>}
              <div style={{ ...S.bubbleContent, ...(item.role === "user" ? S.bubbleContentUser : S.bubbleContentBot) }}>
                <span style={{ ...S.bubbleText, ...(item.role === "user" ? S.bubbleTextUser : {}) }}>
                  {item.content}
                </span>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ ...S.bubble, ...S.bubbleBot }}>
              <div style={S.botAvatar}>🤖</div>
              <div style={{ ...S.bubbleContent, ...S.bubbleContentBot }}>
                <span style={S.typingText}>Thinking…</span>
              </div>
            </div>
          )}
        </div>

        {showOptions && (
          <div style={S.optionChipsScroll}>
            <div style={S.optionChips}>
              {PREDEFINED_OPTIONS.map((opt) => (
                <button key={opt.text} style={S.optionChip} onClick={() => sendMessage(opt.text)}>
                  <span>{opt.emoji}</span>
                  <span style={S.optionChipText}>{opt.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messageCount >= 3 && !leadCaptured && !showLead && (
          <button style={S.guidanceNudge} onClick={() => setShowLead(true)}>
            <span style={{ fontSize: 22 }}>🤝</span>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={S.guidanceNudgeTitle}>Get Free Personal Guidance</div>
              <div style={S.guidanceNudgeSub}>Our team will personally help you</div>
            </div>
            <span style={{ color: "#4ade80" }}>→</span>
          </button>
        )}

        <div style={S.inputBar}>
          <textarea
            style={S.textInput}
            placeholder="Type your question..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={500}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputText);
              }
            }}
          />
          <button
            style={{ ...S.sendBtn, ...((!inputText.trim() || loading) ? S.sendBtnDisabled : {}) }}
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
            aria-label="Send"
          >
            ➤
          </button>
        </div>
      </div>

      <LeadCaptureModal visible={showLead} onClose={() => setShowLead(false)} onSubmitted={handleLeadCaptured} />
    </div>
  );
}

export default function AiAdvisorPage() {
  return (
    <AuthGuard>
      <AiAdvisorContent />
    </AuthGuard>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh", display: "flex", flexDirection: "column",
    background: "linear-gradient(160deg, #0a0a1a, #1a1040)",
  },
  spinner: {
    width: 36, height: 36, border: "3px solid rgba(124,58,237,0.3)",
    borderTop: "3px solid #7c3aed", borderRadius: "50%",
  },
  header: {
    display: "flex", alignItems: "center", gap: 12, padding: 16,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.1)",
    border: "none", color: "#fff", fontSize: 16, cursor: "pointer",
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: 700 },
  headerSub: { color: "rgba(255,255,255,0.4)", fontSize: 11 },

  chatArea: {
    flex: 1, display: "flex", flexDirection: "column", maxWidth: 720,
    width: "100%", margin: "0 auto", minHeight: 0,
  },
  messagesList: { flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 },

  bubble: { display: "flex", alignItems: "flex-end", gap: 8 },
  bubbleUser: { flexDirection: "row-reverse" },
  bubbleBot: { flexDirection: "row" },
  botAvatar: {
    width: 30, height: 30, borderRadius: 15, background: "rgba(124,58,237,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14,
  },
  bubbleContent: { maxWidth: "78%", borderRadius: 18, padding: 12 },
  bubbleContentUser: { background: "#4338ca", borderBottomRightRadius: 4 },
  bubbleContentBot: { background: "rgba(255,255,255,0.08)", borderBottomLeftRadius: 4 },
  bubbleText: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  bubbleTextUser: { color: "#fff" },
  typingText: { color: "rgba(255,255,255,0.4)", fontSize: 12 },

  optionChipsScroll: { maxHeight: 110, overflowX: "auto", borderTop: "1px solid rgba(255,255,255,0.06)" },
  optionChips: { padding: 12, gap: 8, display: "flex", width: "max-content" },
  optionChip: {
    display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)",
    borderRadius: 20, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  },
  optionChipText: { maxWidth: 200 },

  guidanceNudge: {
    display: "flex", alignItems: "center", gap: 10, background: "rgba(22,163,74,0.15)",
    borderTop: "1px solid rgba(22,163,74,0.3)", padding: 14, margin: 12, borderRadius: 14,
    border: "none", cursor: "pointer", textAlign: "left",
  },
  guidanceNudgeTitle: { color: "#4ade80", fontSize: 13, fontWeight: 700 },
  guidanceNudgeSub: { color: "rgba(255,255,255,0.5)", fontSize: 11 },

  inputBar: {
    display: "flex", alignItems: "flex-end", gap: 8, padding: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  textInput: {
    flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "10px 16px",
    color: "#fff", fontSize: 14, maxHeight: 100, border: "none", resize: "none", fontFamily: "inherit",
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, background: "#7c3aed", border: "none",
    color: "#fff", fontSize: 16, cursor: "pointer", flexShrink: 0,
  },
  sendBtnDisabled: { background: "rgba(124,58,237,0.3)", cursor: "not-allowed" },
};
