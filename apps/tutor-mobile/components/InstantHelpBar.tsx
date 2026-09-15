// apps/tutor-mobile/components/InstantHelpBar.tsx
// ShikshaHub Phase 4 — RN mirror of apps/tutor's InstantHelpBar.tsx. See
// that file's header comment for why this is mounted globally (in
// (app)/_layout.tsx) rather than per-screen.

import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { semantic, spacing, radii } from "@gloows/tutor-ui";
import {
  useTutorProfile,
  useIncomingInstantHelpRequests,
  useActiveInstantHelpSession,
} from "@gloows/shared-logic";
import { functions } from "@/lib/firebase";

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
  const { t } = useTranslation();
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

  if (!session && !request) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 90, paddingHorizontal: spacing.xl }}
    >
      {session ? (
        <View style={{
          borderRadius: radii.lg, padding: spacing.md,
          backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: semantic.success,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: semantic.success, fontSize: 11, fontWeight: "900" }}>
                🟢 {t("instantHelpSessionActive", "Instant Help session active")}
              </Text>
              <Text style={{ color: semantic.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {session.studentName || "Student"} · {session.subject} · {formatElapsed(now - toMillis(session.startedAt))}
                {" · ~₹"}{Math.floor(Math.max(0, (now - toMillis(session.startedAt)) / 60000)) * (session.creditsPerMinute ?? 0)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={endSession}
              disabled={actingOn}
              style={{ backgroundColor: semantic.danger, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9, opacity: actingOn ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{t("endSession", "End Session")}</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={{ color: semantic.danger, fontSize: 11, fontWeight: "600", marginTop: 6 }}>{error}</Text> : null}
        </View>
      ) : request ? (
        <View style={{
          borderRadius: radii.lg, padding: spacing.md,
          backgroundColor: semantic.primary, borderWidth: 1, borderColor: semantic.primary,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>
              ⚡ {t("instantHelpIncoming", "Instant Help request")}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" }}>
              {Math.max(0, Math.floor((toMillis(request.expiresAt) - now) / 1000))}s
            </Text>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 }}>
            {request.studentName || "A student"} · {request.subject} · {request.creditsPerMinute}/min
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <TouchableOpacity
              onPress={() => respond("declined")}
              disabled={actingOn}
              style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radii.md, paddingVertical: 10, alignItems: "center", opacity: actingOn ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{t("decline", "Decline")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => respond("accepted")}
              disabled={actingOn}
              style={{ flex: 1, backgroundColor: "#fff", borderRadius: radii.md, paddingVertical: 10, alignItems: "center", opacity: actingOn ? 0.5 : 1 }}
            >
              <Text style={{ color: semantic.primary, fontSize: 11, fontWeight: "700" }}>{t("accept", "Accept")}</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={{ color: "#fecaca", fontSize: 11, fontWeight: "600", marginTop: 6 }}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
