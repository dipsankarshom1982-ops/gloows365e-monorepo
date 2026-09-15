// apps/mobile/components/InstantHelpBar.tsx
// ShikshaHub Phase 4 — RN mirror of apps/web's InstantHelpBar.tsx. See
// that file's header comment for why this is mounted globally (app/
// _layout.tsx) rather than per-screen — a tutor can accept/decline, or a
// session can be running, no matter which screen a student happens to be
// on. Hooks all no-op without a uid, so this is also safe to mount before
// login (renders nothing).
//
// ShikshaHub Phase 6 — see apps/web's mirrored header comment: when
// `session` transitions to null, this checks for an existing review and
// shows an inline prompt if there isn't one yet.

import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
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

  if (!session && !request && !pendingReview) return null;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 90, paddingHorizontal: 16 }}>
      {session ? (
        <View style={{ borderRadius: 14, padding: 12, backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "#10b981" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "900" }}>
                🟢 {t("instantHelpSessionActive") ?? "Instant Help session active"}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {session.tutorName || "Tutor"} · {session.subject} · {formatElapsed(now - toMillis(session.startedAt))}
                {" · ~"}{Math.floor(Math.max(0, (now - toMillis(session.startedAt)) / 60000)) * (session.creditsPerMinute ?? 0)} credits
              </Text>
            </View>
            <TouchableOpacity
              onPress={endSession}
              disabled={actingOn}
              style={{ backgroundColor: "#ef4444", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, opacity: actingOn ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{t("endSession") ?? "End Session"}</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "600", marginTop: 6 }}>{error}</Text> : null}
        </View>
      ) : request ? (
        <View style={{ borderRadius: 14, padding: 12, backgroundColor: "#0f766e", borderWidth: 1, borderColor: "#0d9488" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>
              ⚡ {t("instantHelpWaiting") ?? "Waiting for tutor to respond…"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" }}>
              {Math.max(0, Math.floor((toMillis(request.expiresAt) - now) / 1000))}s
            </Text>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 }}>
            {request.tutorName || "Tutor"} · {request.subject}
          </Text>
          <TouchableOpacity
            onPress={cancelRequest}
            disabled={actingOn}
            style={{ marginTop: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingVertical: 9, alignItems: "center", opacity: actingOn ? 0.5 : 1 }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{t("cancelRequest") ?? "Cancel Request"}</Text>
          </TouchableOpacity>
          {error ? <Text style={{ color: "#fecaca", fontSize: 11, fontWeight: "600", marginTop: 6 }}>{error}</Text> : null}
        </View>
      ) : pendingReview ? (
        <View style={{ borderRadius: 14, padding: 14, backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" }}>
          <Text style={{ color: "#f1f5f9", fontSize: 13, fontWeight: "800" }}>
            {t("reviewPromptTitle") ?? "How was your session with"} {pendingReview.tutorName || "your tutor"}?
          </Text>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)}>
                <Text style={{ fontSize: 26, opacity: n <= rating ? 1 : 0.3 }}>⭐</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            placeholder={t("reviewTextPlaceholder") ?? "Optional: share more about your experience"}
            placeholderTextColor="#64748b"
            multiline
            maxLength={1000}
            style={{ marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0f172a", color: "#f1f5f9", fontSize: 12, padding: 8, minHeight: 44, textAlignVertical: "top" }}
          />
          {error ? <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "600", marginTop: 6 }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => setPendingReview(null)}
              style={{ flex: 1, borderWidth: 1, borderColor: "#334155", borderRadius: 10, paddingVertical: 9, alignItems: "center" }}
            >
              <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "700" }}>{t("reviewSkip") ?? "Skip"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submitReview}
              disabled={rating < 1 || submittingReview}
              style={{ flex: 1, backgroundColor: "#0d9488", borderRadius: 10, paddingVertical: 9, alignItems: "center", opacity: rating < 1 || submittingReview ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                {submittingReview ? (t("reviewSubmitting") ?? "Submitting…") : (t("reviewSubmit") ?? "Submit Review")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}
