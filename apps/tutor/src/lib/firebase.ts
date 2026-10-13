// apps/tutor/src/lib/firebase.ts
//
// Copied from apps/web/src/lib/firebase.ts near-verbatim — same Firebase
// project, same Next.js static-export constraints, same
// signInWithPopup/browserPopupRedirectResolver requirement, same mobile-
// network long-polling fix. See that file's extensive comments for the
// full "why" behind each step; not re-explained here to avoid the two
// copies drifting into subtly different justifications for the same code.
// If either file's setup ever needs to change, change both.

import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import {
  browserSessionPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { initSharedFirebase } from "@gloows/shared-logic";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let auth: ReturnType<typeof getAuth>;
if (typeof window !== "undefined") {
  try {
    auth = initializeAuth(app, {
      persistence: browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    auth = getAuth(app);
    void auth.setPersistence(browserSessionPersistence);
  }
} else {
  auth = getAuth(app);
}

initSharedFirebase(firebaseConfig);

let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}
const functions = getFunctions(app);
const storage = getStorage(app);

export { auth, app, db, functions, storage, firebaseConfig };
