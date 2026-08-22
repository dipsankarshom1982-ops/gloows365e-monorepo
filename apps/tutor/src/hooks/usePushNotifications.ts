"use client";

// apps/tutor/src/hooks/usePushNotifications.ts
// Web push notifications phase — browser Web Push via Firebase Cloud
// Messaging, the tutor-web counterpart to apps/tutor-mobile's Expo-based
// hooks/usePushNotifications.ts. Deliberately manual opt-in only — no
// silent auto-register on load like the mobile version — because a
// browser's notification permission prompt is widely blocked or
// down-ranked by abuse heuristics when it fires without a direct user
// gesture. This only ever calls Notification.requestPermission() from
// inside the Profile screen's toggle click handler.
//
// Token is written to tutors/{uid}.webPushToken — a SEPARATE field from
// pushToken (the Expo token apps/tutor-mobile writes to the same doc):
// the two are different token formats sent through completely different
// APIs (Expo's push API vs. the Admin SDK's admin.messaging().send()).
// See functions/src/shikshahubNotify.ts's notifyTutor(), which now sends
// through both independently, whichever field(s) exist.

import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { app, auth, db } from "@/lib/firebase";

const PREF_KEY = "tutor_web_push_enabled";

// Firebase Console → your project → Project Settings → Cloud Messaging →
// Web configuration → Web Push certificates → Generate key pair. Public
// value (embedded client-side by design — a VAPID key is not a secret),
// still a placeholder pending that key being generated for
// gloows-03b6sz-staging — see this phase's git-review note for the
// pending follow-up. Until it's set, registerForPushNotifications()
// no-ops rather than calling getToken() with an empty key.
const VAPID_KEY = "";

async function savePushTokenToFirestore(token: string | null): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(doc(db, "tutors", uid), { webPushToken: token }, { merge: true });
  } catch (e) {
    console.log("savePushToken:", e);
  }
}

async function registerForPushNotifications(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    console.log("firebase/messaging: web push not supported in this browser.");
    return false;
  }
  if (!VAPID_KEY) {
    console.log("firebase/messaging: VAPID_KEY not configured yet — skipping token registration.");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  try {
    const [{ getMessaging, getToken }, registration] = await Promise.all([
      import("firebase/messaging"),
      navigator.serviceWorker.register("/firebase-messaging-sw.js"),
    ]);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    await savePushTokenToFirestore(token);
  } catch (e) {
    // Non-fatal — permission is granted even if token fetch fails (e.g.
    // VAPID_KEY not yet configured, or the browser rejects registration).
    console.log("firebase/messaging: could not get push token:", e);
    return false;
  }

  return true;
}

export function usePushNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const val = typeof window !== "undefined" ? window.localStorage.getItem(PREF_KEY) : null;
    if (val !== null) setEnabled(val === "true");
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      if (!enabled) {
        const success = await registerForPushNotifications();
        if (success) {
          setEnabled(true);
          window.localStorage.setItem(PREF_KEY, "true");
        }
      } else {
        await savePushTokenToFirestore(null);
        setEnabled(false);
        window.localStorage.setItem(PREF_KEY, "false");
      }
    } finally {
      setLoading(false);
    }
  };

  return { enabled, loading, toggle };
}
