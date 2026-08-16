import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { Button } from "@/components/ui";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background, justifyContent: "space-between", padding: spacing["2xl"] }}>
      <View />
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 48, marginBottom: spacing.xl }}>🎓</Text>
        <Text style={{ fontSize: 28, fontWeight: "900", color: semantic.textPrimary, textAlign: "center", marginBottom: spacing.md }}>
          {t("welcomeTitle")}
        </Text>
        <Text style={{ fontSize: 14, color: semantic.textSecondary, textAlign: "center" }}>
          {t("welcomeSubtitle")}
        </Text>
      </View>
      <View style={{ gap: spacing.md }}>
        <Button title={t("getStarted")} onPress={() => router.push("/register")} />
        <Button title={t("loginTitle")} variant="secondary" onPress={() => router.push("/login")} />
      </View>
    </SafeAreaView>
  );
}
