import { auth } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/header";
import { useTheme } from "@/context/ThemeContext";

type FieldId = "current" | "next" | "confirm";

export default function ChangePasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState<Record<FieldId, boolean>>({
    current: false,
    next: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const toggleShow = (id: FieldId) =>
    setShow((prev) => ({ ...prev, [id]: !prev[id] }));

  const validate = (): string | null => {
    if (!current.trim()) return "Please enter your current password.";
    if (next.length < 6) return "New password must be at least 6 characters.";
    if (next !== confirm) return "Passwords do not match.";
    if (next === current) return "New password must be different from the current one.";
    return null;
  };

  const handleChange = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    const user = auth.currentUser;
    if (!user?.email) {
      setError("No authenticated user found. Please log in again.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      setSuccess(true);
    } catch (e: any) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else if (e.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else if (e.code === "auth/requires-recent-login") {
        setError("Session expired. Please log out and log in again before changing your password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const PasswordField = ({
    id,
    label,
    value,
    onChange,
  }: {
    id: FieldId;
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <View style={styles.fieldWrapper}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show[id]}
          placeholder="••••••••"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          onFocus={() => setError("")}
        />
        <TouchableOpacity onPress={() => toggleShow(id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={show[id] ? "eye-off-outline" : "eye-outline"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu={true} />
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: `${colors.accent}15` }]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Password Changed!</Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            Your password has been updated successfully.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <Text style={styles.btnText}>Back to Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu={true} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Title */}
          <View style={styles.pageHeader}>
            <Text style={[styles.title, { color: colors.accent }]}>🔑 Change Password</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Enter your current password, then set a new one.
            </Text>
          </View>

          {/* Form */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <PasswordField
              id="current"
              label="Current Password"
              value={current}
              onChange={setCurrent}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <PasswordField
              id="next"
              label="New Password"
              value={next}
              onChange={setNext}
            />
            <PasswordField
              id="confirm"
              label="Confirm New Password"
              value={confirm}
              onChange={setConfirm}
            />

            {/* Password strength hint */}
            {next.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map((n) => (
                  <View
                    key={n}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          next.length >= n * 3
                            ? next.length >= 10
                              ? "#22c55e"
                              : next.length >= 6
                              ? "#f59e0b"
                              : "#ef4444"
                            : colors.border,
                      },
                    ]}
                  />
                ))}
                <Text style={[styles.strengthLabel, { color: colors.textSecondary }]}>
                  {next.length < 6 ? "Too short" : next.length < 10 ? "Fair" : "Strong"}
                </Text>
              </View>
            )}
          </View>

          {/* Error */}
          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: loading ? `${colors.accent}80` : colors.accent }]}
            onPress={handleChange}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.btnText}>Update Password</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Back */}
          <TouchableOpacity
            style={[styles.outlineBtn, { borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
            <Text style={[styles.outlineBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  pageHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 13, fontWeight: "500", lineHeight: 20 },

  card: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    marginBottom: 12,
  },
  divider: { height: 1, marginVertical: 4 },

  fieldWrapper: { marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, fontWeight: "500" },

  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: "600", minWidth: 50 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "500", flex: 1 },

  btn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  outlineBtn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  outlineBtnText: { fontSize: 15, fontWeight: "600" },

  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  successIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center" },
  successTitle: { fontSize: 24, fontWeight: "800" },
  successSub: { fontSize: 14, fontWeight: "500", textAlign: "center", lineHeight: 22 },
});
