// PATH: apps/mobile/components/shikshahub/TutorCard.tsx
// ShikshaHub redesign — compact, conversion-focused tutor result card.
// Replaces the old emoji-in-a-big-empty-box layout with: a real/initials
// avatar, verified + rating on one line, subject tags, a real availability
// line (Instant Help online, or the tutor's own next declared slot — never
// a fabricated one), a real price line, and a primary CTA that's visually
// dominant over the secondary "View Profile" action.

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import InitialsAvatar from "./InitialsAvatar";
import { nextAvailableLabel, type MarketplaceTutor } from "@/lib/shikshahub";

export default function TutorCard({
  tutor,
  colors,
  t,
  onPressProfile,
  onPressPrimary,
}: {
  tutor: MarketplaceTutor;
  colors: any;
  t: (key: string) => string | undefined;
  onPressProfile: () => void;
  onPressPrimary: () => void;
}) {
  const availabilityLabel = tutor.isOnlineForInstantHelp
    ? (t("shikshaHubAvailableNow") ?? "Available Now")
    : (() => {
        const next = nextAvailableLabel(tutor.availability);
        return next ? `${t("shikshaHubNextAvailable") ?? "Next available"}: ${next}` : null;
      })();

  return (
    <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity onPress={onPressProfile} activeOpacity={0.85} style={S.topRow}>
        <View style={S.avatarWrap}>
          <InitialsAvatar name={tutor.name} uri={tutor.profilePic} size={48} />
          {tutor.isOnlineForInstantHelp && <View style={S.onlineDot} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[S.name, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
              {tutor.name || "Tutor"}
            </Text>
            <Text style={S.verifiedTick}>✓</Text>
          </View>
          {tutor.ratingAverage != null && tutor.ratingCount > 0 && (
            <Text style={[S.rating, { color: colors.textSecondary }]} numberOfLines={1}>
              ⭐ {tutor.ratingAverage.toFixed(1)} · {tutor.ratingCount} {t("shikshaHubReviews") ?? "Reviews"}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {!!tutor.qualification && (
        <Text style={[S.meta, { color: colors.textSecondary }]} numberOfLines={1}>🎓 {tutor.qualification}</Text>
      )}
      {tutor.teachingExperienceYears != null && (
        <Text style={[S.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          🧑‍🏫 {tutor.teachingExperienceYears} {t("shikshaHubYearsExp") ?? "yrs experience"}
        </Text>
      )}

      {tutor.subjects.length > 0 && (
        <View style={S.tagRow}>
          {tutor.subjects.slice(0, 3).map((s) => (
            <Text key={s} style={S.tag} numberOfLines={1}>{s}</Text>
          ))}
        </View>
      )}

      {availabilityLabel && (
        <Text
          style={[S.availability, { color: tutor.isOnlineForInstantHelp ? "#10b981" : colors.textSecondary }]}
          numberOfLines={1}
        >
          {tutor.isOnlineForInstantHelp ? "🟢 " : ""}{availabilityLabel}
        </Text>
      )}

      {tutor.sessionFee != null && (
        <Text style={[S.price, { color: colors.text }]}>₹{tutor.sessionFee}<Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>/{t("shikshaHubHourSuffix") ?? "hr"}</Text></Text>
      )}

      <View style={S.actionsRow}>
        <TouchableOpacity onPress={onPressProfile} style={[S.secondaryBtn, { borderColor: colors.border }]}>
          <Text style={[S.secondaryBtnText, { color: colors.text }]}>{t("shikshaHubViewProfile") ?? "View Profile"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onPressPrimary} style={S.primaryBtn}>
          <Text style={S.primaryBtnText}>
            {tutor.isOnlineForInstantHelp
              ? (t("shikshaHubInstantSession") ?? "⚡ Instant Session")
              : (t("shikshaHubBookSession") ?? "Book Session")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, gap: 6 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute", right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#10b981", borderWidth: 2, borderColor: "#0f172a",
  },
  name: { fontSize: 14, fontWeight: "800" },
  verifiedTick: { fontSize: 12, fontWeight: "900", color: "#14b8a6" },
  rating: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  meta: { fontSize: 11, fontWeight: "600" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },
  tag: {
    fontSize: 10, fontWeight: "700", color: "#0d9488", backgroundColor: "rgba(20,184,166,0.12)",
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden", maxWidth: 110,
  },
  availability: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  price: { fontSize: 15, fontWeight: "900", marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  secondaryBtnText: { fontSize: 10.5, fontWeight: "700" },
  primaryBtn: { flex: 1.3, borderRadius: 10, paddingVertical: 8, alignItems: "center", backgroundColor: "#0f766e" },
  primaryBtnText: { fontSize: 10.5, fontWeight: "800", color: "#fff" },
});
