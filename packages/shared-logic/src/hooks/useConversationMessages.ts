"use client";

// packages/shared-logic/src/hooks/useConversationMessages.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub messaging phase — live messages for one conversation.
// Newest-first fetch bounded to the most recent 200, reversed for
// oldest-first display — same "fetch a bounded batch" discipline the
// scheduled sweeps in functions/src already follow, applied client-side
// since there's no pagination UI yet (a natural future improvement once
// a conversation realistically needs it).

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { TutorMessage } from "../types/conversation";

export interface UseConversationMessagesReturn {
  messages: TutorMessage[];
  loading: boolean;
}

const MESSAGE_LIMIT = 200;

export function useConversationMessages(conversationId: string | null | undefined): UseConversationMessagesReturn {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(
        collection(db, "tutorConversations", conversationId, "messages"),
        orderBy("createdAt", "desc"),
        limit(MESSAGE_LIMIT)
      ),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorMessage));
        setMessages(docs.reverse());
        setLoading(false);
      },
      (err) => {
        console.error("[useConversationMessages]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [conversationId]);

  return { messages, loading };
}
