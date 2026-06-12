import { useEffect, useRef } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { recordClick, recordImpression } from "@/services/adService";
import type { Ad } from "@/lib/ads/types";

interface Props {
  ad: Ad;
  module: string;
  classLevel?: string;
  style?: object;
}

function daysUntil(endDate: any): number | null {
  if (!endDate) return null;
  const ms = (endDate.toMillis?.() ?? new Date(endDate).getTime()) - Date.now();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default function ScholarshipAdCard({ ad, module, classLevel = "all", style }: Props) {
  const impressionFired = useRef(false);

  useEffect(() => {
    if (!impressionFired.current) {
      impressionFired.current = true;
      recordImpression(ad.id, module, classLevel);
    }
  }, [ad.id, module, classLevel]);

  const days = daysUntil(ad.endDate);

  const handlePress = async () => {
    await recordClick(ad.id, module);
    if (ad.ctaRoute) router.push(ad.ctaRoute as any);
    else if (ad.ctaUrl) Linking.openURL(ad.ctaUrl).catch(() => {});
  };

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[S.wrapper, style]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.88}>
        <LinearGradient
          colors={["#78350f", "#d97706", "#fbbf24"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={S.card}
        >
          {/* Left content */}
          <View style={S.left}>
            <View style={S.topTag}>
              <Ionicons name="school" size={11} color="#fff" />
              <Text style={S.tagText}>Scholarship</Text>
            </View>
            <Text style={S.title} numberOfLines={2}>{ad.title}</Text>
            <Text style={S.sponsor} numberOfLines={1}>{ad.sponsorName}</Text>
          </View>

          {/* Right: deadline + CTA */}
          <View style={S.right}>
            {days !== null && (
              <View style={S.deadlinePill}>
                <Text style={S.deadlineDays}>{days}</Text>
                <Text style={S.deadlineLabel}>days left</Text>
              </View>
            )}
            <TouchableOpacity style={S.ctaBtn} onPress={handlePress}>
              <Text style={S.ctaText}>{ad.ctaText || "Apply →"}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginVertical: 8 },
  card:    { borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 90 },

  left:    { flex: 1, gap: 4 },
  topTag:  { flexDirection: "row", alignItems: "center", gap: 4 },
  tagText: { color: "#fff", fontSize: 10, fontWeight: "700", opacity: 0.9 },
  title:   { color: "#fff", fontSize: 14, fontWeight: "900", lineHeight: 19 },
  sponsor: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "500" },

  right:         { alignItems: "center", gap: 8 },
  deadlinePill:  { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  deadlineDays:  { color: "#fff", fontSize: 18, fontWeight: "900" },
  deadlineLabel: { color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "600" },

  ctaBtn:  { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  ctaText: { color: "#92400e", fontSize: 12, fontWeight: "800" },
});
