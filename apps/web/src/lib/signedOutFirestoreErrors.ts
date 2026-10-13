"use client";

// PATH: apps/web/src/lib/signedOutFirestoreErrors.ts
//
// Logging out (Drawer → signOut) changes Firestore's credentials while the
// page that was open is still mounted. Any Firestore read or listener still
// in flight at that moment is re-sent without a user and rejected with
// permission-denied; when that promise has no handler it surfaces as an
// uncaught "FirebaseError: Missing or insufficient permissions." even though
// the user has already left and nothing is wrong (seen intermittently on slow
// networks during Web runtime QA, right after logout).
//
// This only swallows that exact case: a Firestore permission-denied rejection
// while NO user is signed in. A permission-denied for a signed-in user is a
// real rules/access problem and is left untouched, and nothing about what the
// rules allow changes — this only stops post-logout noise reaching the console.

import { getAuth } from "firebase/auth";

let installed = false;

export function isSignedOutPermissionDenied(reason: unknown, signedIn: boolean): boolean {
  if (signedIn || !reason || typeof reason !== "object") return false;
  const r = reason as { name?: unknown; code?: unknown };
  const code = typeof r.code === "string" ? r.code : "";
  return r.name === "FirebaseError" && (code === "permission-denied" || code === "firestore/permission-denied");
}

export function installSignedOutFirestoreErrorFilter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("unhandledrejection", (event) => {
    if (isSignedOutPermissionDenied(event.reason, !!getAuth().currentUser)) event.preventDefault();
  });
}
