import { useState } from "react";
import { router, Link } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { auth } from "@/lib/firebase";
import { Button, Input } from "@/components/ui";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/");
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, justifyContent: "center", padding: spacing["2xl"] }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("loginTitle")}
        </Text>
        <Input label={t("emailLabel")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Input label={t("passwordLabel")} value={password} onChangeText={setPassword} secureTextEntry />
        {error && <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700", marginBottom: spacing.md }}>{error}</Text>}
        <Button title={submitting ? t("loading") : t("loginButton")} onPress={handleLogin} loading={submitting} />
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, gap: 4 }}>
          <Text style={{ color: semantic.textMuted, fontSize: 13 }}>{t("noAccount")}</Text>
          <Link href="/register"><Text style={{ color: semantic.accent, fontSize: 13, fontWeight: "700" }}>{t("signUpLink")}</Text></Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
