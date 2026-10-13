"use client";

// PATH: apps/web/src/app/(app)/shikshahub/messages/thread/page.tsx
// ShikshaHub messaging phase — one conversation thread:
// /shikshahub/messages/thread?peer={tutorUid}. Query string, not a
// dynamic path segment, for the same static-export reason
// .../profile/page.tsx already documents. conversationId is computed
// client-side via conversationIdFor (mirrors the server's own
// deterministic formula) — no conversation doc may exist yet if this is
// the first message, useConversationMessages just renders empty until
// sendTutorMessageCall creates it.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile, useConversationMessages } from "@gloows/shared-logic";
import {
  conversationIdFor, fetchTutorById, markConversationReadCall, sendTutorMessageCall,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import { ShikshaHubStyles, TutorAvatar } from "../../_shared";

function ShikshaHubThreadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useAppTranslation();
  const { user } = useStudentProfile();
  const peerUid = searchParams.get("peer") ?? "";

  const [tutor, setTutor] = useState<MarketplaceTutor | null>(null);
  const [tutorLoading, setTutorLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationId = user?.uid && peerUid ? conversationIdFor(user.uid, peerUid) : null;
  const { messages, loading: messagesLoading } = useConversationMessages(conversationId);

  useEffect(() => {
    if (!peerUid) return;
    fetchTutorById(peerUid).then(setTutor).finally(() => setTutorLoading(false));
  }, [peerUid]);

  useEffect(() => {
    if (conversationId && !messagesLoading && messages.length > 0) {
      markConversationReadCall(conversationId).catch(() => {});
    }
  }, [conversationId, messagesLoading, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !peerUid) return;
    setSending(true);
    setError("");
    try {
      await sendTutorMessageCall(peerUid, trimmed);
      setText("");
    } catch (e: any) {
      setError(e?.message ?? "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  if (!peerUid) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Invalid conversation.</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <ShikshaHubStyles />
      <div className="shikshahub-container" style={{ padding: "16px", maxWidth: 720, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => router.push("/shikshahub/messages")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text)", padding: 4 }}
            aria-label="Back"
          >
            ←
          </button>
          {!tutorLoading && tutor && <TutorAvatar tutor={tutor} size={36} />}
          <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text)" }}>
            {tutorLoading ? "…" : (tutor?.name || "Tutor")}
          </span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "16px 0", overflowY: "auto" }}>
          {messagesLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 12.5, fontWeight: 600 }}>
              {t("shikshaHubMessageStartHint", "Send a message to start the conversation.")}
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.senderRole === "student";
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "75%", padding: "9px 13px", borderRadius: 16,
                    background: mine ? "#0d9488" : "var(--bg-card)",
                    color: mine ? "#fff" : "var(--text)",
                    border: mine ? "none" : "1px solid var(--border)",
                    fontSize: 13, lineHeight: "18px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={t("shikshaHubMessagePlaceholder", "Write a message…")}
            maxLength={2000}
            style={{
              flex: 1, border: "1px solid var(--border)", borderRadius: 20, padding: "10px 16px",
              fontSize: 13, background: "var(--bg-card)", color: "var(--text)", outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            style={{
              border: "none", borderRadius: 20, padding: "0 20px", fontSize: 13, fontWeight: 800,
              background: "#0d9488", color: "#fff", cursor: sending || !text.trim() ? "not-allowed" : "pointer",
              opacity: sending || !text.trim() ? 0.5 : 1,
            }}
          >
            {t("shikshaHubMessageSend", "Send")}
          </button>
        </div>
        {!!error && <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: "#ef4444" }}>{error}</div>}
      </div>
    </div>
  );
}

export default function ShikshaHubThreadPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Loading…</div>}>
      <ShikshaHubThreadContent />
    </Suspense>
  );
}
