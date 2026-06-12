// apps/web/src/lib/firebase.ts
//
// Web-specific Firebase initializer.
// Uses browserLocalPersistence instead of AsyncStorage.

import {
  getApp, getApps, initializeApp,
} from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { initSharedFirebase } from "@gloows/shared-logic";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Initialize shared-logic with this config (so all shared services work)
initSharedFirebase(firebaseConfig);

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Web uses browserLocalPersistence (not AsyncStorage)
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, { persistence: browserLocalPersistence });
} catch {
  auth = getAuth(app);
}

export { auth, app };
