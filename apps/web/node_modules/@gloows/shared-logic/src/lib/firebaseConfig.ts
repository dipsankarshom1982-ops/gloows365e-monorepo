// packages/shared-logic/src/lib/firebaseConfig.ts
//
// ✅ Platform-agnostic Firebase initializer.
// Used by: shared-logic services, web app, admin panel.
//
// The MOBILE app (apps/mobile) uses its own lib/firebase.ts which adds
// AsyncStorage persistence on top of this config.
//
// DO NOT import react-native or expo packages here.

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// ── Lazy singleton ────────────────────────────────────────────────────────
// Each platform (mobile/web/admin) calls initSharedFirebase() once at startup
// with its own env config. After that, getSharedDb() / getSharedAuth() etc.
// return the initialized instances.

let _app: FirebaseApp | null = null;

export function initSharedFirebase(config: FirebaseConfig): FirebaseApp {
  if (getApps().length > 0) {
    _app = getApp();
  } else {
    _app = initializeApp(config);
  }
  return _app;
}

export function getSharedApp(): FirebaseApp {
  if (!_app && getApps().length > 0) _app = getApp();
  if (!_app) throw new Error("[shared-logic] Firebase not initialized. Call initSharedFirebase() first.");
  return _app;
}

export function getSharedAuth(): Auth {
  return getAuth(getSharedApp());
}

export function getSharedDb(): Firestore {
  return getFirestore(getSharedApp());
}

export function getSharedFunctions(): Functions {
  return getFunctions(getSharedApp());
}

export function getSharedStorage(): FirebaseStorage {
  return getStorage(getSharedApp());
}

// ── Convenience re-exports so services can do:
//    import { auth, db } from "@gloows/shared-logic/lib/firebaseConfig"
export const auth = { get current() { return getSharedAuth(); } };
export const db   = { get current() { return getSharedDb(); } };
