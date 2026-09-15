// apps/tutor-mobile/components/onboarding/SuccessScreen.tsx
// Shown after submitTutorOnboarding succeeds — see ../../app/(auth)/
// onboarding.tsx.

import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PrimaryButton } from "./OnboardingUI";

export default function SuccessScreen({ t }: { t: (k: string, o?: any) => string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>{t("obSuccessTitle")}</Text>
      <Text style={styles.thankYou}>{t("obSuccessThankYou")}</Text>
      <Text style={styles.body}>{t("obSuccessBody")}</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{t("obSuccessStatus")}</Text>
      </View>

      <PrimaryButton onPress={() => router.replace("/dashboard")}>
        {t("obSuccessDashboardButton")}
      </PrimaryButton>

      <TouchableOpacity onPress={() => router.push("/verification")} style={{ marginTop: 16 }}>
        <Text style={styles.statusLink}>{t("obSuccessStatusLink")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 44, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: "#F8FAFC", marginBottom: 8, textAlign: "center", letterSpacing: -0.3 },
  thankYou: { fontSize: 14, color: "#E2E8F0", fontWeight: "700", marginBottom: 6, textAlign: "center" },
  body: { fontSize: 14, color: "#94A3B8", marginBottom: 24, textAlign: "center", lineHeight: 20 },
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 24,
    borderWidth: 1, borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.1)",
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FBBF24" },
  statusText: { color: "#FCD34D", fontSize: 13.5, fontWeight: "800" },
  statusLink: { color: "#94A3B8", fontSize: 13.5, fontWeight: "700" },
});
