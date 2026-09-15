"use client";

// PATH: apps/web/src/services/crashReporter.ts
// Mirrors mobile services/crashReporter.ts's write side — writes to the
// same crashReports/{reportId} collection admin's CrashReports.tsx already
// reads (TYPE_META already has a "manual" entry: "📋 Manual Report").
// Web only implements logCrash's "manual" path (student-submitted bug
// reports) — mobile also has global JS-error/rejection handlers wired up
// at app startup; nothing on web currently calls those automatically.

import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function reportBug(description: string, screen?: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  await addDoc(collection(db, "crashReports"), {
    type: "manual",
    message: description.slice(0, 1000),
    screen,
    uid,
    appVersion: "web",
    platform: "web",
    osVersion: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : undefined,
    timestamp: serverTimestamp(),
    resolved: false,
  });
}
