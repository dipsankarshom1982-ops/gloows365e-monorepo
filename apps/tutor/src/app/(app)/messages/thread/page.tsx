"use client";
// apps/tutor/src/app/(app)/messages/thread/page.tsx
// Tutor-student messaging phase — one conversation thread:
// /messages/thread?peer={studentUid}. Query string, not a dynamic path
// segment, matching this app's other query-param pages (e.g.
// services/edit/page.tsx) under next.config.ts's output:"export".
// conversationId is computed client-side (mirrors the server's own
// deterministic formula) — this page never creates a conversation (only
// a student's first message does, see functions/src/tutorMessaging.ts's
// header comment), it only ever replies inside one that already exists.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { useConversationMessages, useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { LoadingState } from "@/components/ui";

const sendTutorMessageCall = httpsCallable<{ peerUid: string; text: string }, { conversationId: string; messageId: string }>(
  functions, "sendTutorMessage"
);
const markConversationReadCall = httpsCallable<{ conversationId: string }, { conversationId: string }>(
  functions, "markConversationRead"
);

function conversationIdFor(studentUid: string, tutorUid: string): string {
  return `${studentUid}_${tutorUid}`;
}

function MessagesThreadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const peerUid = searchParams.get("peer") ?? "";

  const [studentName, setStudentName] = useState("");
  const [nameLoading, setNameLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationId = user?.uid && peerUid ? conversationIdFor(peerUid, user.uid) : null;
  const { messages, loading: messagesLoading } = useConversationMessages(conversationId);

  useEffect(() => {
    if (!conversationId) return;
    getDoc(doc(db, "tutorConversations", conversationId))
      .then((snap) => setStudentName((snap.data()?.studentName as string | undefined) || "Student"))
      .catch(() => setStudentName("Student"))
      .finally(() => setNameLoading(false));
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && !messagesLoading && messages.length > 0) {
      markConversationReadCall({ conversationId }).catch(() => {});
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
      await sendTutorMessageCall({ peerUid, text: trimmed });
      setText("");
    } catch (e: any) {
      setError(e?.message ?? "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  if (!peerUid) {
    return <div className="p-6 text-slate-400 text-center">Invalid conversation.</div>;
  }

  return (
    <div className="min-h-dvh bg-bg pb-6 flex flex-col">
      <div className="max-w-lg mx-auto w-full flex flex-col flex-1 p-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
          <button onClick={() => router.push("/messages")} className="text-slate-300 text-lg px-1">←</button>
          <span className="font-bold text-slate-100 truncate">{nameLoading ? "…" : studentName}</span>
        </div>

        <div className="flex-1 flex flex-col gap-2 py-4 overflow-y-auto">
          {messagesLoading ? (
            <LoadingState />
          ) : messages.length === 0 ? (
            <p className="text-center text-slate-500 text-xs font-semibold py-10">{t("noMessagesInThreadHint")}</p>
          ) : (
            messages.map((m) => {
              const mine = m.senderRole === "tutor";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-5 whitespace-pre-wrap break-words ${
                    mine ? "bg-brand-600 text-white" : "bg-surface border border-slate-700 text-slate-100"
                  }`}>
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 pt-3 border-t border-slate-700">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={t("messagePlaceholder")}
            maxLength={2000}
            className="flex-1 rounded-full bg-surface border border-slate-700 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-bold px-5"
          >
            {t("sendMessage")}
          </button>
        </div>
        {!!error && <p className="text-danger text-xs font-semibold mt-2">{error}</p>}
      </div>
    </div>
  );
}

export default function MessagesThreadPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MessagesThreadContent />
    </Suspense>
  );
}
