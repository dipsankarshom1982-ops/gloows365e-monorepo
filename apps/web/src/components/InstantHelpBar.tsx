"use client";
// apps/web/src/components/InstantHelpBar.tsx
// ShikshaHub Phase 4 — a student's global Instant Help status bar. Mirrors
// apps/tutor's InstantHelpBar.tsx (same "mount once in the app layout, not
// per-page" reasoning — a tutor can accept/decline no matter where the
// student happens to be browsing), just showing the student's own side of
// the same two states:
//   • a still-"pending" request they sent → waiting card with a live
//     countdown + a Cancel button
//   • an "active" session → a persistent bar with an elapsed timer, a
//     running spend estimate, and an End Session button
//
// ShikshaHub Phase 6 — a third state: the moment `session` transitions
// from non-null to null (the session just ended), this checks whether
// that session already has a tutorReviews/{sessionId} doc; if not, it
// shows an inline "Rate this session" prompt right here instead of
// returning null, since this is already the one component watching this
// student's live session state from anywhere in the app.

import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStudentProfile, useMyInstantHelpRequest, useActiveInstantHelpSession, type InstantHelpSession } from "@gloows/shared-logic";
import { useAppTranslation } from "@/context/LanguageContext";
import { cancelInstantHelpRequestCall, endInstantHelpSessionCall, submitTutorReviewCall } from "@/lib/shikshahub";

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
  const { t } = useAppTranslation();
  const { user } = useStudentProfile();
  const { request } = useMyInstantHelpRequest(user?.uid);
  const { session } = useActiveInstantHelpSession(user?.uid, "student");
  const [actingOn, setActingOn] = useState(false);
  const [error, setError] = useState("");
  const now = useNowTicker();

  const [pendingReview, setPendingReview] = useState<InstantHelpSession | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const prevSessionRef = useRef<InstantHelpSession | null>(null);

  useEffect(() => {
    const prev = prevSessionRef.current;
    if (prev?.id && !session) {
      getDoc(doc(db, "tutorReviews", prev.id)).then((snap) => {
        if (!snap.exists()) setPendingReview(prev);
      }).catch(() => {});
    }
    prevSessionRef.current = session;
  }, [session]);

  async function cancelRequest() {
    if (!request?.id) return;
    setActingOn(true);
    setError("");
    try {
      await cancelInstantHelpRequestCall(request.id);
    } catch (e: any) {
      setError(e?.message ?? "Could not cancel this request.");
    } finally {
      setActingOn(false);
    }
  }

  async function endSession() {
    if (!session?.id) return;
    setActingOn(true);
    setError("");
    try {
      await endInstantHelpSessionCall(session.id);
    } catch (e: any) {
      setError(e?.message ?? "Could not end this session.");
    } finally {
      setActingOn(false);
    }
  }

  async function submitReview() {
    if (!pendingReview?.id || rating < 1) return;
    setSubmittingReview(true);
    try {
      await submitTutorReviewCall(pendingReview.id, rating, reviewText.trim() || undefined);
      setPendingReview(null);
      setRating(0);
      setReviewText("");
    } catch (e: any) {
      setError(e?.message ?? "Could not submit review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (session) {
    const elapsedMs = now - toMillis(session.startedAt);
    const elapsedMin = Math.max(0, elapsedMs / 60000);
    const estimatedSpend = Math.floor(elapsedMin) * (session.creditsPerMinute ?? 0);
    return (
      <div style={{ position: "fixed", bottom: 76, left: 0, right: 0, zIndex: 50, padding: "0 16px" }}>
        <div style={{
          maxWidth: 480, margin: "0 auto", borderRadius: 14, padding: "12px 14px",
          background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", backdropFilter: "blur(8px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#10b981", fontSize: 11, fontWeight: 900 }}>
                🟢 {t("instantHelpSessionActive", "Instant Help session active")}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {session.tutorName || "Tutor"} · {session.subject} · {formatElapsed(elapsedMs)} · ~{estimatedSpend} credits
              </div>
            </div>
            <button
              onClick={endSession}
              disabled={actingOn}
              style={{ flexShrink: 0, border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, padding: "9px 12px", cursor: actingOn ? "default" : "pointer", opacity: actingOn ? 0.5 : 1 }}
            >
              {t("endSession", "End Session")}
            </button>
          </div>
          {error && <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 600, marginTop: 6 }}>{error}</div>}
        </div>
      </div>
    );
  }

  if (request) {
    const secondsLeft = Math.max(0, Math.floor((toMillis(request.expiresAt) - now) / 1000));
    return (
      <div style={{ position: "fixed", bottom: 76, left: 0, right: 0, zIndex: 50, padding: "0 16px" }}>
        <div style={{
          maxWidth: 480, margin: "0 auto", borderRadius: 14, padding: "12px 14px",
          background: "linear-gradient(135deg,#0f766e,#0d9488)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>
              ⚡ {t("instantHelpWaiting", "Waiting for tutor to respond…")}
            </span>
            <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 700 }}>{secondsLeft}s</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 }}>
            {request.tutorName || "Tutor"} · {request.subject}
          </div>
          <button
            onClick={cancelRequest}
            disabled={actingOn}
            style={{ marginTop: 8, width: "100%", border: "none", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "9px 0", cursor: actingOn ? "default" : "pointer", opacity: actingOn ? 0.5 : 1 }}
          >
            {t("cancelRequest", "Cancel Request")}
          </button>
          {error && <div style={{ color: "#fecaca", fontSize: 11, fontWeight: 600, marginTop: 6 }}>{error}</div>}
        </div>
      </div>
    );
  }

  if (pendingReview) {
    return (
      <div style={{ position: "fixed", bottom: 76, left: 0, right: 0, zIndex: 50, padding: "0 16px" }}>
        <div style={{
          maxWidth: 480, margin: "0 auto", borderRadius: 14, padding: "14px",
          background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}>
          <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 800 }}>
            {t("reviewPromptTitle", "How was your session with")} {pendingReview.tutorName || "your tutor"}?
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", padding: 0, opacity: n <= rating ? 1 : 0.3 }}
                aria-label={`${n} star`}
              >
                ⭐
              </button>
            ))}
          </div>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder={t("reviewTextPlaceholder", "Optional: share more about your experience")}
            rows={2}
            maxLength={1000}
            style={{ width: "100%", marginTop: 8, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, padding: 8, resize: "none" }}
          />
          {error && <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 600, marginTop: 6 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => setPendingReview(null)}
              style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, background: "transparent", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, padding: "9px 0", cursor: "pointer" }}
            >
              {t("reviewSkip", "Skip")}
            </button>
            <button
              onClick={submitReview}
              disabled={rating < 1 || submittingReview}
              style={{ flex: 1, border: "none", borderRadius: 10, background: "linear-gradient(90deg,#0f766e,#14b8a6)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "9px 0", cursor: rating < 1 || submittingReview ? "default" : "pointer", opacity: rating < 1 || submittingReview ? 0.5 : 1 }}
            >
              {submittingReview ? t("reviewSubmitting", "Submitting…") : t("reviewSubmit", "Submit Review")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
