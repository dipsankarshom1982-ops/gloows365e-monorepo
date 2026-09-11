"use client";

// packages/shared-logic/src/hooks/useAppNotifications.ts
//
// ✅ Shared — works on mobile (React Native) and web (Next.js/React).
// ShikshaHub notifications phase — reads notifications/{uid}/items, the
// same subcollection functions/src/shikshahubNotify.ts writes to and
// apps/mobile's app/notifications.tsx already reads directly (that app
// keeps its own local hook rather than this shared one, since it existed
// first — this is what gives apps/tutor and apps/tutor-mobile the same
// capability, which had no notification inbox at all before this phase).
//
// firestore.rules already scopes notifications/{userId} (and its /items
// subcollection) to `request.auth.uid == userId`, same rule apps/mobile's
// existing inbox already relies on for its own direct client
// read/markRead calls — no rules change was needed for tutors to use it
// too, since any authenticated uid is symmetric under that rule.

import {
  collection, doc, onSnapshot, orderBy, query, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSharedDb } from "../lib/firebaseConfig";
import type { AppNotification } from "../types/notification";

export interface UseAppNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useAppNotifications(uid: string | null | undefined): UseAppNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(collection(db, "notifications", uid, "items"), orderBy("createdAt", "desc")),
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
        setLoading(false);
      },
      (err) => {
        console.error("[useAppNotifications]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  const markRead = async (id: string) => {
    if (!uid) return;
    const db = getSharedDb();
    await updateDoc(doc(db, "notifications", uid, "items", id), { read: true });
  };

  const markAllRead = async () => {
    if (!uid) return;
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const db = getSharedDb();
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, "notifications", uid, "items", n.id), { read: true }));
    await batch.commit();
  };

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    loading,
    markRead,
    markAllRead,
  };
}

// Lightweight unread-count-only variant for a nav badge, so a screen that
// just needs the number doesn't have to subscribe to full notification
// bodies (`where("read","==",false)` server-side instead of filtering
// the full list client-side).
export function useUnreadNotificationCount(uid: string | null | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }
    const db = getSharedDb();
    const unsub = onSnapshot(
      query(collection(db, "notifications", uid, "items"), where("read", "==", false)),
      (snap) => setCount(snap.size),
      (err) => console.error("[useUnreadNotificationCount]", err)
    );
    return () => unsub();
  }, [uid]);

  return count;
}
