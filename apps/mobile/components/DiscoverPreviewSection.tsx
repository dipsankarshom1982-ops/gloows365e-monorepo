import { useAppTranslation } from "@/context/LanguageContext";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const CHIPS = ["🔍 Search Now", "🎯 Top Careers", "🎓 Scholarships"];

export default function DiscoverPreviewSection() {
  const { t } = useAppTranslation();
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={S.section}>
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <Text style={S.sectionTitle}>{t("discoverPreviewTitle")}</Text>
          <Text style={S.sectionSub}>{t("discoverPreviewSub")}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/discover")}>
          <Text style={S.viewAll}>{t("explore")}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/discover")}
        activeOpacity={0.88}
        style={S.cardWrap}
      >
        {/* Animated glow border */}
        <Animated.View style={[S.glowBorder, { opacity: glowAnim }]} />

        <LinearGradient
          colors={["#0f0c29", "#302b63", "#24243e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.card}
        >
          {/* Glow orb decoration */}
          <View style={S.orb} />

          {/* Top row */}
          <View style={S.topRow}>
            <View style={S.badge}>
              <Text style={S.badgeText}>✨ {t("poweredByGemini") ?? "Powered by Gemini AI"}</Text>
            </View>
            <View style={S.liveBadge}>
              <View style={S.liveDot} />
              <Text style={S.liveText}>{t("activeLabel") ?? "Active"}</Text>
            </View>
          </View>

          {/* Main content */}
          <View style={S.mainRow}>
            <Text style={S.emoji}>🧭</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.title}>{t("discoverTitle")}</Text>
              <Text style={S.subtitle}>{t("discoverSubtitle")}</Text>
            </View>
          </View>

          {/* Feature chips */}
          <View style={S.chipsRow}>
            {CHIPS.map((c) => (
              <View key={c} style={S.chip}>
                <Text style={S.chipText}>{c}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <LinearGradient
            colors={["#6366f1", "#8b5cf6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={S.cta}
          >
            <Text style={S.ctaText}>{t("discoverCta")}</Text>
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const S = StyleSheet.create({
  section:     { marginVertical: 16 },
  header:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 2 },
  sectionSub:  { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.5)" },
  viewAll:     { fontSize: 13, fontWeight: "700", color: "#6366f1", marginTop: 4 },

  cardWrap:    { marginHorizontal: 16, borderRadius: 20, elevation: 8, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 },
  glowBorder:  { position: "absolute", inset: -2, borderRadius: 22, borderWidth: 2, borderColor: "#6366f1", zIndex: 0 },
  card:        { borderRadius: 20, padding: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(99,102,241,0.35)" },

  orb:         { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(99,102,241,0.15)", top: -50, right: -50 },

  topRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  badge:       { backgroundColor: "rgba(99,102,241,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(139,92,246,0.4)" },
  badgeText:   { color: "#a5b4fc", fontSize: 11, fontWeight: "700" },
  liveBadge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(6,182,212,0.15)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(6,182,212,0.3)" },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: "#06b6d4" },
  liveText:    { color: "#06b6d4", fontSize: 11, fontWeight: "700" },

  mainRow:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  emoji:       { fontSize: 44 },
  title:       { color: "#fff", fontWeight: "900", fontSize: 20, letterSpacing: 0.3 },
  subtitle:    { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "500", marginTop: 3 },

  chipsRow:    { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  chip:        { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  chipText:    { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },

  cta:         { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  ctaText:     { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
});
