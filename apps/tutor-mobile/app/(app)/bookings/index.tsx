// apps/tutor-mobile/app/(app)/bookings/index.tsx
// ShikshaHub Phase 2 — RN counterpart to apps/tutor's
// (app)/bookings/page.tsx (which previously existed only on teacher web —
// see the Phase 2 architecture map). Same useTutorBookings hook, same
// respondToBooking/cancelBooking callables, no local status mutation on
// success — the onSnapshot listener picks up the Admin-SDK write.

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorBookings, useTutorProfile, type Booking } from "@gloows/shared-logic";
import { functions } from "@/lib/firebase";
import { Badge, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const STATUS_TONE: Record<Booking["status"], "default" | "success" | "warning" | "danger"> = {
  requested: "warning",
  accepted:  "success",
  declined:  "danger",
  cancelled: "default",
  // Booking completion phase.
  completed: "success",
};

const respondToBookingCall = httpsCallable<
  { bookingId: string; action: "accepted" | "declined" },
  { status: Booking["status"] }
>(functions, "respondToBooking");

const cancelBookingCall = httpsCallable<
  { bookingId: string },
  { status: Booking["status"] }
>(functions, "cancelBooking");

export default function BookingsScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { bookings, loading } = useTutorBookings(user?.uid);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function respond(bookingId: string, action: "accepted" | "declined") {
    setActingOn(bookingId);
    setRowError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      await respondToBookingCall({ bookingId, action });
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [bookingId]: e?.message ?? "Could not update this booking." }));
    } finally {
      setActingOn(null);
    }
  }

  async function cancel(bookingId: string) {
    setActingOn(bookingId);
    setRowError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      await cancelBookingCall({ bookingId });
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [bookingId]: e?.message ?? "Could not cancel this booking." }));
    } finally {
      setActingOn(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, paddingTop: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, paddingHorizontal: spacing.xl, marginBottom: spacing.xl }}>
          {t("shikshaHubBookingRequestsTitle")}
        </Text>

        {loading ? (
          <LoadingState />
        ) : bookings.length === 0 ? (
          <EmptyState
            title={t("shikshaHubNoBookingsTitle")}
            subtitle={t("shikshaHubNoBookingsSubtitle")}
          />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
            {bookings.map((b) => (
              <Card key={b.id} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <View>
                    <Text style={{ fontWeight: "700", color: semantic.textPrimary }}>{b.studentName || "Student"}</Text>
                    <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 4 }}>
                      {b.subject} · {b.sessionType === "trial" ? t("shikshaHubTrial") : t("shikshaHubRegular")}
                    </Text>
                  </View>
                  <Badge label={b.status} tone={STATUS_TONE[b.status]} />
                </View>

                <View style={{ marginTop: spacing.md, gap: 2 }}>
                  <Text style={{ fontSize: 12, color: semantic.textMuted }}>{b.requestedDate}</Text>
                  <Text style={{ fontSize: 12, color: semantic.textMuted }}>{b.requestedStartTime} – {b.requestedEndTime}</Text>
                  <Text style={{ fontSize: 12, color: semantic.textMuted }}>₹{b.sessionFee}</Text>
                </View>

                {b.status === "requested" && (
                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                    <TouchableOpacity
                      onPress={() => respond(b.id!, "accepted")}
                      disabled={actingOn === b.id}
                      style={{ flex: 1, borderRadius: 8, backgroundColor: semantic.success ?? "#22c55e", paddingVertical: 9, alignItems: "center", opacity: actingOn === b.id ? 0.5 : 1 }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{t("shikshaHubAccept")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => respond(b.id!, "declined")}
                      disabled={actingOn === b.id}
                      style={{ flex: 1, borderRadius: 8, backgroundColor: semantic.surfaceElevated, borderWidth: 1, borderColor: semantic.border ?? "#334155", paddingVertical: 9, alignItems: "center", opacity: actingOn === b.id ? 0.5 : 1 }}
                    >
                      <Text style={{ color: semantic.textPrimary, fontSize: 12, fontWeight: "700" }}>{t("shikshaHubDecline")}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(b.status === "requested" || b.status === "accepted") && (
                  <TouchableOpacity
                    onPress={() => cancel(b.id!)}
                    disabled={actingOn === b.id}
                    style={{ marginTop: spacing.sm, borderRadius: 8, backgroundColor: semantic.surfaceElevated, borderWidth: 1, borderColor: semantic.border ?? "#334155", paddingVertical: 9, alignItems: "center", opacity: actingOn === b.id ? 0.5 : 1 }}
                  >
                    <Text style={{ color: semantic.textPrimary, fontSize: 12, fontWeight: "700" }}>{t("shikshaHubCancelBooking")}</Text>
                  </TouchableOpacity>
                )}

                {rowError[b.id!] ? (
                  <Text style={{ color: semantic.danger ?? "#ef4444", fontSize: 12, fontWeight: "600", marginTop: spacing.sm }}>
                    {rowError[b.id!]}
                  </Text>
                ) : null}
              </Card>
            ))}
          </ScrollView>
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}
