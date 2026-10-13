// apps/web/src/lib/firebase.ts
//
// Web-specific Firebase initializer.
// Uses browserSessionPersistence instead of AsyncStorage.
//
// FEATURE (bug report — "if pwa app close by user, need a system auto
// logout, after open its need to login again"): this used to initialize
// with browserLocalPersistence, which writes the auth session to
// localStorage — data that survives indefinitely, including a full close
// of the installed PWA (swiping it away / force-closing it) and every
// later relaunch, until the person explicitly logs out. That's why closing
// and reopening the app kept people signed in.
//
// browserSessionPersistence instead writes to sessionStorage, which is
// scoped to that one browsing-context instance: it survives page reloads
// and in-app navigation (so a refresh mid-session won't log anyone out),
// but is wiped the moment the tab/window — or, for an installed PWA, the
// whole app process — is actually closed. Reopening the app after that is
// a brand-new browsing context with empty sessionStorage, so
// StudentProfileContext's onAuthStateChanged reports no user and
// AuthGuard sends them back to /login, exactly as requested. Merely
// backgrounding/minimizing the app (not closing it) doesn't destroy the
// context, so that alone won't force a re-login.
//
// ⚠️ ORDER MATTERS HERE — and a resolver MUST be passed (see below):
//
// ROOT CAUSE of auth/argument-error on signInWithPopup (confirmed):
// initializeAuth() does NOT default to including the popup/redirect
// resolver the way getAuth() does. getAuth() auto-attaches
// browserPopupRedirectResolver for you; initializeAuth() only sets up
// whatever you explicitly pass in `deps`. If you call
// initializeAuth(app, { persistence }) WITHOUT also passing
// `popupRedirectResolver: browserPopupRedirectResolver`, the resulting
// Auth instance never gets `_popupRedirectResolver` set at all. The very
// first thing signInWithPopup does is assert that this is set
// (`_assert(this._popupRedirectResolver, this, "argument-error")`) —
// before it ever opens a window. That's why the popup never opens and the
// error is synchronous: it's failing before reaching the part of the code
// that would open a popup, not failing because of anything popup-related.
// signInWithEmailAndPassword doesn't touch _popupRedirectResolver at all,
// which is why only the Google sign-in path was affected.
//
// Fix: always pass popupRedirectResolver explicitly when using
// initializeAuth(), exactly as Firebase's own docs example for
// initializeAuth shows.

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

// ── Step 1: create (or reuse) the app — must happen before any auth call ──
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// ── Step 2: claim Auth on this app with browser persistence, FIRST ───────
// This MUST run before initSharedFirebase() below, or before any other
// module that might call plain getAuth(app) on this same app.
//
// popupRedirectResolver: browserPopupRedirectResolver is REQUIRED here —
// without it, signInWithPopup throws auth/argument-error synchronously,
// before ever opening a popup window (see comment above).
// initializeAuth() with browserSessionPersistence requires real browser APIs
// (window, indexedDB, etc.) that don't exist during Next.js's server-side
// static prerendering. Calling it there doesn't break the build — Firebase
// catches its own internal assertion failure and just logs
// "INTERNAL ASSERTION FAILED: Expected a class definition" — but it's
// noise on every build and conceptually the wrong call to make outside a
// browser. Guard it so the server path uses plain getAuth(app) (a stub
// that's never actually used for sign-in during prerendering) and only the
// real browser path does the persistence/resolver setup below.
let auth: ReturnType<typeof getAuth>;
if (typeof window !== "undefined") {
  try {
    auth = initializeAuth(app, {
      persistence: browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // If this throws (e.g. Fast Refresh re-evaluating this module after it
    // already ran once), fall back to getAuth(app) — which DOES include
    // browserPopupRedirectResolver by default — and re-assert persistence in
    // case the existing instance wasn't configured the way we need.
    auth = getAuth(app);
    void auth.setPersistence(browserSessionPersistence);
  }
} else {
  auth = getAuth(app);
}

// ── Step 3: NOW it's safe for shared-logic to claim/reuse the same app ───
// initSharedFirebase only calls initializeApp/getApp — never getAuth — so
// this is safe here. Keeping the call (rather than removing it) because
// other shared-logic exports (getSharedDb, getSharedFunctions, etc.) still
// rely on _app being set internally.
initSharedFirebase(firebaseConfig);

// FIX (bug report — "login not redirecting on mobile" / mobile data
// inconsistently not showing, e.g. V-Coins, wallet, profile fields):
// plain getFirestore(app) lets the SDK pick its transport automatically,
// which defaults to WebChannel streaming. On a meaningful slice of Indian
// mobile carrier networks (and some corporate/school wifi proxies) that
// streaming connection gets silently swallowed by a middlebox — no error,
// the request just never resolves. Every symptom reported as "works on
// PC, not on mobile" (getDoc() in the post-login routing chain hanging
// until login/page.tsx's 8s timeout dumps everyone to /home regardless of
// where they should actually land; onSnapshot() listeners for V-Coins/
// wallet/drawer never firing) is consistent with exactly this. Forcing
// auto-detected long-polling makes the SDK fall back to plain HTTP
// requests when streaming doesn't work, which passes through those same
// middleboxes fine. This is Firebase's own documented fix for this class
// of issue — see https://firebase.google.com/docs/firestore/query-data/listen#events-and-changes
// note on long polling. (This used to also set `useFetchStreams: false` to
// pair with it, guarding against older mobile WebViews that implement
// fetch() streaming incorrectly — that option was removed from the SDK's
// FirestoreSettings type in a later firebase package upgrade, so it's gone;
// experimentalAutoDetectLongPolling alone still covers the original bug.)
//
// initializeFirestore() (unlike getFirestore()) throws if Firestore was
// already initialized for this app — which happens on every Fast Refresh
// re-evaluation of this module in dev, same reentry issue the auth setup
// above already guards against. Fall back to plain getFirestore(app) in
// that case; it just returns the already-configured instance.
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