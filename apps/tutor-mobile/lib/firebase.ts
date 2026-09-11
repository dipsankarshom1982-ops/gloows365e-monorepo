// apps/tutor-mobile/lib/firebase.ts
// Mirrors apps/mobile/lib/firebase.ts (AsyncStorage persistence for Auth,
// shared-logic bootstrap) — same Firebase project, same RN runtime, no
// reason for this to diverge. One deliberate difference: the `!`
// non-null assertions below aren't in apps/mobile's copy — that file has
// the same latent `string | undefined` vs `FirebaseConfig`'s `string`
// mismatch this one hit under a standalone `tsc --noEmit` (never
// surfaced there either, since nothing runs that check on it directly).
// Asserting here matches apps/tutor's already-verified-working web
// equivalent instead of carrying the same latent gap forward.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initSharedFirebase } from "@gloows/shared-logic";

const { getReactNativePersistence } = require("firebase/auth");

export const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

initSharedFirebase(firebaseConfig);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);
export { auth, db };
export const storage = getStorage(app);
export const functions = getFunctions(app);
