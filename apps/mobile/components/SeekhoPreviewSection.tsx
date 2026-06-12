import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const CATEGORIES = [
  { emoji: "🗣️", label: "English\nSpeaking", colors: ["#1e40af", "#3b82f6"] as [string, string] },
  { emoji: "💻", label: "Computer",           colors: ["#064e3b", "#059669"] as [string, string] },
  { emoji: "💃", label: "Dance",              colors: ["#831843", "#db2777"] as [string, string] },
  { emoji: "🎵", label: "Singing",            colors: ["#4c1d95", "#7c3aed"] as [string, string] },
  { emoji: "🎨", label: "Drawing",            colors: ["#7c2d12", "#ea580c"] as [string, string] },
  { emoji: "✂️", label: "Craft",              colors: ["#134e4a", "#0d9488"] as [string, string] },
  { emoji: "📚", label: "Class 6–12",         colors: ["#1e3a5f", "#2563eb"] as [string, string] },
  { emoji: "🔬", label: "Science",            colors: ["#1a2e05", "#4d7c0f"] as [string, string] },
  { emoji: "🔢", label: "Mathematics",        colors: ["#450a0a", "#b91c1c"] as [string, string] },
  { emoji: "🌟", label: "General\nSkills",    colors: ["#451a03", "#d97706"] as [string, string] },
];

const CARD_W = 110;

export default function SeekhoPreviewSection() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const idxRef    = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % CATEGORIES.length;
      scrollRef.current?.scrollTo({
        x: idxRef.current * (CARD_W + 12),
        animated: true,
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={S.section}>
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>{t("seekhoPreviewTitle")}</Text>
          <Text style={[S.sectionSub, { color: colors.textSecondary }]}>
            {t("seekhoPreviewSub")}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(drawer)/(tabs)/seekho")}>
          <Text style={S.viewAll}>{t("explore")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.scrollContent}
        scrollEventThrottle={16}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.label}
            activeOpacity={0.82}
            onPress={() => router.push("/(drawer)/(tabs)/seekho")}
            style={S.cardWrap}
          >
            <LinearGradient
              colors={cat.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={S.card}
            >
              <Text style={S.cardEmoji}>{cat.emoji}</Text>
              <Text style={S.cardLabel}>{cat.label}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  section:      { marginVertical: 16 },
  header:       { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  sectionSub:   { fontSize: 12, fontWeight: "500" },
  viewAll:      { fontSize: 13, fontWeight: "700", color: "#6366f1", marginTop: 4 },

  scrollContent: { paddingLeft: 16, paddingRight: 4, paddingBottom: 8 },

  cardWrap: { marginRight: 12 },
  card: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    padding: 10,
  },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardLabel: { color: "#fff", fontSize: 11, fontWeight: "800", textAlign: "center", lineHeight: 15 },
});
