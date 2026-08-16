import { useState } from "react";
import { router, Link } from "expo-router";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { colors, semantic, spacing } from "@gloows/tutor-ui";
import { auth, functions } from "@/lib/firebase";
import { Button, Input } from "@/components/ui";

type TutorRole = "TUTOR" | "TEACHER" | "COACHING_CENTER";

const ROLES: { value: TutorRole; titleKey: string; descKey: string; icon: string }[] = [
  { value: "TUTOR",           titleKey: "roleTutor",          descKey: "roleTutorDesc",          icon: "🧑‍🏫" },
  { value: "TEACHER",         titleKey: "roleTeacher",        descKey: "roleTeacherDesc",        icon: "🏫" },
  { value: "COACHING_CENTER", titleKey: "roleCoachingCenter", descKey: "roleCoachingCenterDesc", icon: "🏢" },
];

const registerTutorAccountFn = httpsCallable<
  { tutorRole: TutorRole; name: string; phone?: string },
  { uid: string; tutorRole: TutorRole }
>(functions, "registerTutorAccount");

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [role, setRole]         = useState<TutorRole | null>(null);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setError(null);
    if (!role) { setError(t("selectRole")); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setSubmitting(true);
    let createdUid: string | null = null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      createdUid = cred.user.uid;
      await registerTutorAccountFn({ tutorRole: role, name: name.trim(), phone: phone.trim() });
      await cred.user.getIdToken(true);
      router.replace("/profile");
    } catch (err: any) {
      if (createdUid && auth.currentUser) {
        await deleteUser(auth.currentUser).catch(() => {});
      }
      setError(err?.message ?? "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing["2xl"] }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("registerTitle")}
        </Text>

        <Text style={{ color: semantic.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: spacing.sm }}>{t("selectRole")}</Text>
        <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
          {ROLES.map((r) => {
            const active = role === r.value;
            return (
              <TouchableOpacity
                key={r.value}
                onPress={() => setRole(r.value)}
                style={{
                  borderRadius: 10, borderWidth: 1, padding: spacing.md,
                  borderColor: active ? colors.brand[500] : colors.slate[700],
                  backgroundColor: active ? "rgba(79,70,229,0.12)" : semantic.surface,
                }}
              >
                <Text style={{ color: semantic.textPrimary, fontWeight: "700", fontSize: 13 }}>{r.icon}  {t(r.titleKey)}</Text>
                <Text style={{ color: semantic.textMuted, fontSize: 11, marginTop: 2 }}>{t(r.descKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input label={t("fullNameLabel")} value={name} onChangeText={setName} />
        <Input label={t("emailLabel")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Input label={t("phoneLabel")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label={t("passwordLabel")} value={password} onChangeText={setPassword} secureTextEntry />
        <Input label={t("confirmPasswordLabel")} value={confirm} onChangeText={setConfirm} secureTextEntry />
        {error && <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700", marginBottom: spacing.md }}>{error}</Text>}
        <Button title={submitting ? t("loading") : t("registerButton")} onPress={handleRegister} loading={submitting} />

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, gap: 4 }}>
          <Text style={{ color: semantic.textMuted, fontSize: 13 }}>{t("alreadyHaveAccount")}</Text>
          <Link href="/login"><Text style={{ color: semantic.accent, fontSize: 13, fontWeight: "700" }}>{t("loginLink")}</Text></Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
