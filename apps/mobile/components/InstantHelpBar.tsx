// apps/mobile/components/InstantHelpBar.tsx
// ShikshaHub Phase 4 — RN mirror of apps/web's InstantHelpBar.tsx. See
// that file's header comment for why this is mounted globally (app/
// _layout.tsx) rather than per-screen — a tutor can accept/decline, or a
// session can be running, no matter which screen a student happens to be
// on. Hooks all no-op without a uid, so this is also safe to mount before
// login (renders nothing).

import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useStudentProfile, useMyInstantHelpRequest, useActiveInstantHelpSession } from "@gloows/shared-logic";
import { useAppTranslation } from "@/context/LanguageContext";
import { cancelInstantHelpRequestCall, endInstantHelpSessionCall } from "@/lib/shikshahub";

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

  if (!session && !request) return null;

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
      ) : null}
    </View>
  );
}
