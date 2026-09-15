// apps/tutor/public/firebase-messaging-sw.js
// Web push notifications phase — Firebase Cloud Messaging service worker.
// Handles BACKGROUND push (tab not focused / browser closed); a
// foregrounded tab still sees the update via the app's own in-app
// notifications bell, so there's no separate onMessage() foreground
// handler in usePushNotifications.ts — deliberately kept to this one
// responsibility to match this phase's approved scope.
//
// Config values are apps/tutor's own public Firebase Web App config (see
// src/lib/firebase.ts / .env) — hardcoded here because a service worker
// loads before any bundler/env-var processing runs, the same reason
// every firebase-messaging-sw.js does this. These are not secrets:
// Firestore/Auth/Storage security comes from firestore.rules, not from
// this key being hidden — see .env's own header comment.
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCpS6KjmnGAD5vCuB_swM2SWRd6-nhoiys",
  authDomain: "gloows-03b6sz.firebaseapp.com",
  projectId: "gloows-03b6sz",
  storageBucket: "gloows-03b6sz.firebasestorage.app",
  messagingSenderId: "1039247674814",
  appId: "1:1039247674814:web:071d5c2982065f6712bdef",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "Gloows Tutor";
  const body = (payload.notification && payload.notification.body) || "";
  self.registration.showNotification(title, { body });
});
