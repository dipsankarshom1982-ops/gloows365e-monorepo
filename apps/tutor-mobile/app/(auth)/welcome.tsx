// apps/tutor-mobile/app/(auth)/welcome.tsx
// Redesigned to match apps/mobile's (auth)/welcome.tsx — the Gloows365E
// student app's welcome screen (indigo→violet gradient, floating brand
// logo with a "365" pill badge, language chips, gradient pill CTA) — so
// Gloows Tutor's first screen reads as part of the same ecosystem instead
// of a plain, unbranded card. Ported with RN's built-in Animated API
// (no reanimated dep here, unlike apps/mobile) and expo-linear-gradient
// (already a dependency) instead of expo-haptics (not installed).

import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Animated, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { SUPPORTED_TUTOR_LANGUAGES, type TutorLanguageCode } from "@gloows/tutor-i18n";

// Brand logo — matches apps/mobile's header.tsx / (auth)/welcome.tsx and
// apps/tutor's (auth)/welcome/page.tsx brand mark exactly.
function BrandLogo() {
  return (
    <View style={styles.logoWrap}>
      <Text style={styles.gloows}>
        <Text style={{ color: "#A5B4FC" }}>Gl</Text>
        <Text style={{ color: "#F1F5F9" }}>oows</Text>
      </Text>
      <LinearGradient
        colors={["#6366F1", "#8B5CF6", "#EC4899"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.pill}
      >
        <Text style={styles.pillText}>365</Text>
      </LinearGradient>
      <Text style={styles.eTag}>E</Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split("-")[0] ?? "en") as TutorLanguageCode;

  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -12, duration: 2000, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const handleGetStarted = () => router.push("/register");

  return (
    <LinearGradient colors={["#1E1B4B", "#4F46E5", "#7C3AED"]} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        {/* Glow effects */}
        <View style={styles.glow1} />
        <View style={styles.glow2} />

        {/* Floating logo */}
        <Animated.View style={{ transform: [{ translateY: float }] }}>
          <BrandLogo />
        </Animated.View>

        {/* Tagline */}
        <Text style={styles.subtitle}>{t("welcomeSubtitle")}</Text>

        {/* Language selection */}
        <View style={styles.languageContainer}>
          {SUPPORTED_TUTOR_LANGUAGES.map((lang) => {
            const active = lang.code === currentLang;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langBtn, active && styles.activeLang]}
                onPress={() => i18n.changeLanguage(lang.code)}
              >
                <Text style={[styles.langText, active && styles.activeLangText]}>{lang.native}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={handleGetStarted}>
          <LinearGradient colors={["#ffffff", "#E0E7FF"]} style={styles.buttonInner}>
            <Text style={styles.buttonText}>{t("getStarted")} →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/login")}>
          <Text style={styles.loginLink}>{t("loginTitle")}</Text>
        </TouchableOpacity>

        {/* Trust line */}
        <Text style={styles.footer}>{t("welcomeFooter")}</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },

  glow1: {
    position: "absolute", top: 60, left: -50,
    width: 200, height: 200, borderRadius: 200,
    backgroundColor: "#818CF8", opacity: 0.2,
  },
  glow2: {
    position: "absolute", bottom: 80, right: -40,
    width: 180, height: 180, borderRadius: 200,
    backgroundColor: "#C084FC", opacity: 0.2,
  },

  logoWrap:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 10 },
  gloows:    { fontSize: 44, fontWeight: "900", letterSpacing: -0.5 },
  pill:      { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 3, justifyContent: "center", alignItems: "center" },
  pillText:  { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  eTag:      { fontSize: 16, fontWeight: "900", color: "#FBBF24", marginBottom: 18 },

  subtitle: {
    textAlign: "center", color: "#E0E7FF",
    marginTop: 10, marginBottom: 25, fontSize: 15, lineHeight: 22,
  },

  languageContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 30 },
  langBtn: {
    borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 25,
    margin: 5, backgroundColor: "rgba(255,255,255,0.08)",
  },
  activeLang: { backgroundColor: "#fff", borderColor: "#fff" },
  langText: { color: "#fff", fontSize: 12 },
  activeLangText: { color: "#312E81", fontWeight: "700" },

  button: { borderRadius: 30, overflow: "hidden" },
  buttonInner: { paddingVertical: 16, paddingHorizontal: 60, borderRadius: 30 },
  buttonText: { color: "#312E81", fontWeight: "bold", fontSize: 16 },

  loginLink: { marginTop: 16, color: "#E0E7FF", fontSize: 14, textDecorationLine: "underline" },
  footer: { marginTop: 20, color: "#C7D2FE", fontSize: 12, textAlign: "center" },
});
