// PATH: apps/mobile/app/shikshahub/bookings.tsx
// ShikshaHub Phase 2 — "My Bookings". Mirrors
// apps/web/src/app/(app)/shikshahub/bookings/page.tsx. Every booking the
// signed-in student has ever requested (useStudentBookings — same
// onSnapshot-hook shape as apps/tutor's useTutorBookings, just scoped by
// studentUid). Lets the student cancel a "requested"/"accepted" booking
// (cancelBookingCall) — any party can cancel per the approved Phase 2
// scope.

import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile, useStudentBookings, type Booking } from "@gloows/shared-logic";
import { cancelBookingCall } from "@/lib/shikshahub";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_META: Record<Booking["status"], { label: string; color: string }> = {
  requested: { label: "Requested", color: "#f59e0b" },
  accepted:  { label: "Accepted",  color: "#22c55e" },
  declined:  { label: "Declined",  color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "#94a3b8" },
};

export default function ShikshaHubMyBookingsScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { user } = useStudentProfile();
  const { bookings, loading } = useStudentBookings(user?.uid);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [rowError, setRowError]     = useState<Record<string, string>>({});

  async function handleCancel(bookingId: string) {
    setCancelling(bookingId);
    setRowError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      await cancelBookingCall(bookingId);
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [bookingId]: e?.message ?? "Could not cancel this booking." }));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>
          {t("shikshaHubMyBookingsTitle") ?? "My Bookings"}
        </Text>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator color="#14b8a6" />
        </View>
      ) : bookings.length === 0 ? (
        <View style={S.center}>
          <Text style={{ fontSize: 40 }}>🎓</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>
            {t("shikshaHubNoMyBookings") ?? "You haven't booked a tutor yet."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={S.list} showsVerticalScrollIndicator={false}>
          {bookings.map((b) => {
            const meta = STATUS_META[b.status];
            const cancellable = b.status === "requested" || b.status === "accepted";
            return (
              <View key={b.id} style={[S.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <View>
                    <Text style={[S.cardName, { color: colors.text }]}>{b.tutorName || "Tutor"}</Text>
                    <Text style={[S.cardMeta, { color: colors.textSecondary }]}>
                      {b.subject} · {b.sessionType === "trial" ? (t("shikshaHubTrial") ?? "Trial") : (t("shikshaHubRegular") ?? "Regular")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: meta.color }} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: meta.color }}>{meta.label}</Text>
                  </View>
                </View>

                <View style={S.cardRow}>
                  <Text style={[S.cardDetail, { color: colors.textSecondary }]}>{b.requestedDate}</Text>
                  <Text style={[S.cardDetail, { color: colors.textSecondary }]}>{b.requestedStartTime} – {b.requestedEndTime}</Text>
                  <Text style={[S.cardDetail, { color: colors.textSecondary }]}>₹{b.sessionFee}</Text>
                </View>

                {cancellable && (
                  <TouchableOpacity
                    onPress={() => handleCancel(b.id!)}
                    disabled={cancelling === b.id}
                    style={[S.cancelBtn, { borderColor: colors.border }, cancelling === b.id && { opacity: 0.6 }]}
                  >
                    <Text style={[S.cancelBtnText, { color: colors.text }]}>
                      {cancelling === b.id ? (t("shikshaHubCancelling") ?? "Cancelling…") : (t("shikshaHubCancelBooking") ?? "Cancel booking")}
                    </Text>
                  </TouchableOpacity>
                )}

                {rowError[b.id!] && (
                  <Text style={S.errorText}>{rowError[b.id!]}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 60 },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardName: { fontSize: 14, fontWeight: "800" },
  cardMeta: { fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  cardRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardDetail: { fontSize: 12, fontWeight: "600" },

  cancelBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignSelf: "flex-start" },
  cancelBtnText: { fontSize: 12, fontWeight: "700" },
  errorText: { fontSize: 11.5, fontWeight: "600", color: "#ef4444" },
});
