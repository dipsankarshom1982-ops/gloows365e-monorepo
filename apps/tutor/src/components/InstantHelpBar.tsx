"use client";
// apps/tutor/src/components/InstantHelpBar.tsx
// ShikshaHub Phase 4 — a tutor's global Instant Help status bar. Mounted
// once in the (app) layout (not per-page) because a request can arrive or
// a session can be running no matter which screen the tutor happens to be
// on — same reasoning a chat app's incoming-call overlay isn't scoped to
// one route. Two live states, mutually exclusive by construction
// (requestInstantHelp refuses to create a request for a tutor who already
// has a pending one or an active session — see functions/src/
// instantHelp.ts):
//   • an incoming pending request → accept/decline card with a live
//     countdown to when it auto-expires
//   • an active session → a persistent bar with an elapsed timer, a
//     running cost estimate, and an End Session button
// Nothing renders if neither applies, so this is a no-op for tutors not
// using Instant Help.

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  useTutorProfile,
  useIncomingInstantHelpRequests,
  useActiveInstantHelpSession,
} from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";

const respondToInstantHelpRequestCallFn = httpsCallable<
  { requestId: string; action: "accepted" | "declined" },
  { status: string; sessionId?: string }
>(functions, "respondToInstantHelpRequest");

const endInstantHelpSessionCallFn = httpsCallable<
  { sessionId: string },
  { status: string; endReason?: string; minutesCharged: number }
>(functions, "endInstantHelpSession");

function useNowTicker(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function toMillis(ts: any): number {
  return ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : 0);
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function InstantHelpBar() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { requests } = useIncomingInstantHelpRequests(user?.uid);
  const { session } = useActiveInstantHelpSession(user?.uid, "tutor");
  const [actingOn, setActingOn] = useState(false);
  const [error, setError] = useState("");
  const now = useNowTicker();

  const request = requests[0] ?? null;

  async function respond(action: "accepted" | "declined") {
    if (!request?.id) return;
    setActingOn(true);
    setError("");
    try {
      await respondToInstantHelpRequestCallFn({ requestId: request.id, action });
    } catch (e: any) {
      setError(e?.message ?? "Could not respond to this request.");
    } finally {
      setActingOn(false);
    }
  }

  async function endSession() {
    if (!session?.id) return;
    setActingOn(true);
    setError("");
    try {
      await endInstantHelpSessionCallFn({ sessionId: session.id });
    } catch (e: any) {
      setError(e?.message ?? "Could not end this session.");
    } finally {
      setActingOn(false);
    }
  }

  if (session) {
    const elapsedMs = now - toMillis(session.startedAt);
    const elapsedMin = Math.max(0, elapsedMs / 60000);
    const estimatedEarnings = Math.floor(elapsedMin) * (session.creditsPerMinute ?? 0);
    return (
      <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
        <div className="max-w-lg mx-auto rounded-xl bg-success/15 border border-success/40 backdrop-blur px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-success text-xs font-black">
                🟢 {t("instantHelpSessionActive", "Instant Help session active")}
              </p>
              <p className="text-slate-300 text-[11px] mt-0.5 truncate">
                {session.studentName || "Student"} · {session.subject} · {formatElapsed(elapsedMs)} · ~₹{estimatedEarnings}
              </p>
            </div>
            <button
              onClick={endSession}
              disabled={actingOn}
              className="shrink-0 rounded-lg bg-danger text-white text-xs font-bold px-3 py-2 disabled:opacity-50"
            >
              {t("endSession", "End Session")}
            </button>
          </div>
          {error && <p className="text-danger text-[11px] font-semibold mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  if (request) {
    const secondsLeft = Math.max(0, Math.floor((toMillis(request.expiresAt) - now) / 1000));
    return (
      <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
        <div className="max-w-lg mx-auto rounded-xl bg-brand-900/95 border border-brand-500 backdrop-blur px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-white text-xs font-black">
              ⚡ {t("instantHelpIncoming", "Instant Help request")}
            </p>
            <span className="text-white/70 text-[11px] font-bold tabular-nums">{secondsLeft}s</span>
          </div>
          <p className="text-white/85 text-[12px] mt-1">
            {request.studentName || "A student"} · {request.subject} · {request.creditsPerMinute}/min
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => respond("declined")}
              disabled={actingOn}
              className="flex-1 rounded-lg bg-white/10 text-white text-xs font-bold py-2.5 disabled:opacity-50"
            >
              {t("decline", "Decline")}
            </button>
            <button
              onClick={() => respond("accepted")}
              disabled={actingOn}
              className="flex-1 rounded-lg bg-white text-brand-900 text-xs font-bold py-2.5 disabled:opacity-50"
            >
              {t("accept", "Accept")}
            </button>
          </div>
          {error && <p className="text-danger text-[11px] font-semibold mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  return null;
}
