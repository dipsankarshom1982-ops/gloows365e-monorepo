// apps/tutor-mobile/components/dashboard/PhoneVerifyModal.tsx
// Mirrors apps/tutor/src/components/dashboard/PhoneVerifyModal.tsx — see
// its header for why this is a deliberate small duplicate of onboarding's
// OTP stub rather than a refactor of Step2BasicInfo.tsx.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors, semantic, spacing } from "@gloows/tutor-ui";

type Props = { phoneNumber: string; onVerified: () => void; onClose: () => void };

export default function PhoneVerifyModal({ phoneNumber, onVerified, onClose }: Props) {
  const { t } = useTranslation();
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  function handleSend() {
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); }, 700);
  }

  function handleVerify() {
    if (!/^\d{6}$/.test(otpCode)) { setError(t("ob2InvalidOtpError")); return; }
    setError(null);
    setVerifying(true);
    setTimeout(() => { setVerifying(false); onVerified(); }, 600);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.xl }}>
        <View style={{ backgroundColor: semantic.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.slate[700], padding: spacing.lg }}>
          <Text style={{ fontSize: 14, fontWeight: "900", color: semantic.textPrimary, marginBottom: 2 }}>{t("dashVerifyMobileTitle")}</Text>
          <Text style={{ fontSize: 12, color: semantic.textMuted, marginBottom: spacing.md }}>+91 {phoneNumber}</Text>

          {!sent ? (
            <TouchableOpacity
              onPress={handleSend} disabled={sending}
              style={{ backgroundColor: semantic.primary, borderRadius: 10, paddingVertical: 11, alignItems: "center", opacity: sending ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{sending ? "…" : t("ob2SendOtp")}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                value={otpCode}
                onChangeText={(v) => { setOtpCode(v.replace(/\D/g, "").slice(0, 6)); if (error) setError(null); }}
                keyboardType="number-pad" maxLength={6}
                placeholder={t("ob2OtpPlaceholder")} placeholderTextColor={colors.slate[500]}
                style={{
                  borderRadius: 10, borderWidth: 1, borderColor: colors.slate[700], backgroundColor: semantic.background,
                  paddingVertical: 10, textAlign: "center", letterSpacing: 6, color: semantic.textPrimary, fontSize: 15, marginBottom: 8,
                }}
              />
              {error && <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>{error}</Text>}
              <TouchableOpacity
                onPress={handleVerify} disabled={verifying || otpCode.length !== 6}
                style={{ backgroundColor: semantic.primary, borderRadius: 10, paddingVertical: 11, alignItems: "center", opacity: (verifying || otpCode.length !== 6) ? 0.5 : 1 }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{verifying ? "…" : t("ob2VerifyOtp")}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={onClose} style={{ marginTop: spacing.md, alignItems: "center" }}>
            <Text style={{ color: semantic.textMuted, fontWeight: "700", fontSize: 12 }}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
