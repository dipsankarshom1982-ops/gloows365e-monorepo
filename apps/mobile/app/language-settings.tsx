import Header from "@/components/header";
import { useLanguage, useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

// ─── English + all 22 languages from the 8th Schedule of the Constitution ───
export const INDIAN_LANGUAGES = [
  { name: "English",   native: "English",     region: "Official language of India" },
  { name: "Assamese",  native: "অসমীয়া",    region: "Assam" },
  { name: "Bengali",   native: "বাংলা",       region: "West Bengal, Assam" },
  { name: "Bodo",      native: "बड़ो",        region: "Assam" },
  { name: "Dogri",     native: "डोगरी",       region: "Jammu & Kashmir" },
  { name: "Gujarati",  native: "ગુજરાતી",     region: "Gujarat" },
  { name: "Hindi",     native: "हिन्दी",       region: "Widely spoken across India" },
  { name: "Kannada",   native: "ಕನ್ನಡ",       region: "Karnataka" },
  { name: "Kashmiri",  native: "کٲشُر",       region: "Jammu & Kashmir" },
  { name: "Konkani",   native: "कोंकणी",      region: "Goa, Coastal Karnataka" },
  { name: "Maithili",  native: "मैथिली",      region: "Bihar, Jharkhand" },
  { name: "Malayalam", native: "മലയാളം",      region: "Kerala, Lakshadweep" },
  { name: "Manipuri",  native: "মৈতৈলোন্",   region: "Manipur" },
  { name: "Marathi",   native: "मराठी",       region: "Maharashtra, Goa" },
  { name: "Nepali",    native: "नेपाली",      region: "Sikkim, West Bengal" },
  { name: "Odia",      native: "ଓଡ଼ିଆ",       region: "Odisha" },
  { name: "Punjabi",   native: "ਪੰਜਾਬੀ",      region: "Punjab, Haryana" },
  { name: "Sanskrit",  native: "संस्कृतम्",   region: "Classical / Liturgical" },
  { name: "Santali",   native: "ᱥᱟᱱᱛᱟᱲᱤ",  region: "Jharkhand, Odisha, West Bengal" },
  { name: "Sindhi",    native: "سنڌي",        region: "Gujarat, Rajasthan" },
  { name: "Tamil",     native: "தமிழ்",       region: "Tamil Nadu, Puducherry" },
  { name: "Telugu",    native: "తెలుగు",      region: "Andhra Pradesh, Telangana" },
  { name: "Urdu",      native: "اردو",        region: "Widespread across India" },
] as const;

export type IndianLanguageName = (typeof INDIAN_LANGUAGES)[number]["name"];

export default function LanguageSettingsScreen() {
  const { colors, isDarkMode } = useTheme();
  const { languageName, changeLanguage } = useLanguage();
  const { t } = useAppTranslation();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [query,  setQuery]  = useState("");

  const textMain = isDarkMode ? "#f1f5f9" : colors.text;
  const textSec  = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;

  const handleSelect = async (lang: string) => {
    if (lang === languageName) return;
    setSaving(true);
    try {
      await changeLanguage(lang);
    } finally {
      setSaving(false);
    }
  };

  const filtered = INDIAN_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.native.includes(query) ||
      l.region.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SafeAreaView style={[S.container, { backgroundColor: isDarkMode ? "#0a0a1a" : colors.background }]}>
      {isDarkMode && (
        <LinearGradient
          colors={["#060612", "#0d0d24", "#060612"]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <Header hideMenu />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Title ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={S.titleRow}>
          <View style={S.titleBlock}>
            <Text style={[S.title, { color: colors.accent }]}>🌐 {t("languageTitle")}</Text>
            <Text style={[S.subtitle, { color: textSec }]}>{t("languageSubtitle")}</Text>
          </View>
          {saving && <ActivityIndicator color={colors.accent} />}
        </Animated.View>

        {/* ── Current selection pill ── */}
        {!saving && (
          <Animated.View entering={FadeIn.duration(400).delay(80)} style={S.currentRow}>
            <LinearGradient
              colors={isDarkMode ? ["#1e1b4b", "#312e81"] : ["#ede9fe", "#ddd6fe"]}
              style={[S.currentPill, { borderColor: colors.accent }]}
            >
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={[S.currentText, { color: colors.accent }]}>{languageName}</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Search box ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <View style={[S.searchBox, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
            <Ionicons name="search-outline" size={17} color={textSec} />
            <TextInput
              style={[S.searchInput, { color: textMain }]}
              placeholder={t("searchLanguage")}
              placeholderTextColor={textSec}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={17} color={textSec} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── Language list ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(180)} style={S.list}>
          {filtered.length === 0 && (
            <Text style={[S.empty, { color: textSec }]}>
              {t("noLanguagesMatch") ?? "No languages match your search."}
            </Text>
          )}
          {filtered.map((lang, idx) => {
            const isActive = languageName === lang.name;
            return (
              <TouchableOpacity
                key={lang.name}
                style={[
                  S.item,
                  {
                    backgroundColor: isActive ? `${colors.accent}18` : surfaceBg,
                    borderColor: isActive ? colors.accent : borderCol,
                  },
                  idx === 0 && S.itemFirst,
                  idx === filtered.length - 1 && S.itemLast,
                ]}
                onPress={() => handleSelect(lang.name)}
                activeOpacity={0.75}
              >
                {/* Native script badge */}
                <View style={[S.nativeBadge, { backgroundColor: isActive ? `${colors.accent}22` : isDarkMode ? "#334155" : `${colors.textSecondary}12` }]}>
                  <Text style={[S.nativeText, { color: isActive ? colors.accent : textMain }]}>
                    {lang.native}
                  </Text>
                </View>

                {/* Name + region */}
                <View style={S.nameBlock}>
                  <Text style={[S.langName, { color: isActive ? colors.accent : textMain }]}>
                    {lang.name}
                  </Text>
                  <Text style={[S.langRegion, { color: textSec }]}>{lang.region}</Text>
                </View>

                {/* Checkmark */}
                {isActive ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={borderCol} />
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* ── Info card ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(260)}>
          <View style={[S.infoCard, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
            <Ionicons name="information-circle-outline" size={18} color={textSec} />
            <Text style={[S.infoText, { color: textSec }]}>
              {t("languageInfoText") ??
                "These are the 22 languages listed in the 8th Schedule of the Constitution of India. Your selected language will be used to personalise lessons and content across the app."}
            </Text>
          </View>
        </Animated.View>

        {/* ── Back button ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(320)} style={S.backBtnWrap}>
          <TouchableOpacity
            style={[S.backBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={textMain} />
            <Text style={[S.backText, { color: textMain }]}>
              {t("backToSettings") ?? "Back to Settings"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:   { flex: 1 },

  titleRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  titleBlock:  { flex: 1 },
  title:       { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  subtitle:    { fontSize: 13, fontWeight: "500", lineHeight: 18 },

  currentRow:  { paddingHorizontal: 20, marginBottom: 12 },
  currentPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  currentText: { fontSize: 14, fontWeight: "800" },

  searchBox:   { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 16, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "500" },

  list:        { paddingHorizontal: 20, gap: 0 },
  empty:       { textAlign: "center", marginTop: 30, fontSize: 14 },

  item:        { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderTopWidth: 0 },
  itemFirst:   { borderTopWidth: 1, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  itemLast:    { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },

  nativeBadge: { minWidth: 72, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  nativeText:  { fontSize: 15, fontWeight: "700" },

  nameBlock:   { flex: 1 },
  langName:    { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  langRegion:  { fontSize: 12, fontWeight: "500" },

  infoCard:    { flexDirection: "row", gap: 10, marginHorizontal: 20, marginTop: 24, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  infoText:    { flex: 1, fontSize: 12, fontWeight: "500", lineHeight: 18 },

  backBtnWrap: { paddingHorizontal: 20, marginTop: 20 },
  backBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  backText:    { fontSize: 15, fontWeight: "600" },
});
