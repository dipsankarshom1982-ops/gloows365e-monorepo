// apps/tutor-mobile/components/ui.tsx
// RN counterpart to apps/tutor/src/components/ui.tsx — same primitives,
// same @gloows/tutor-ui tokens, platform-native implementation (no shared
// JSX with web, per the approved "shared tokens, platform-specific
// components" design-system decision).

import { colors, semantic, radii, spacing, typography } from "@gloows/tutor-ui";
import {
  ActivityIndicator, Text, TextInput, TextInputProps,
  TouchableOpacity, TouchableOpacityProps, View,
} from "react-native";

export function Button({
  title, variant = "primary", loading, style, ...props
}: TouchableOpacityProps & { title: string; variant?: "primary" | "secondary"; loading?: boolean }) {
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={loading || props.disabled}
      style={[{
        width: "100%",
        borderRadius: radii.md,
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isPrimary ? semantic.primary : semantic.surfaceElevated,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: colors.slate[600],
        opacity: (loading || props.disabled) ? 0.5 : 1,
      }, style]}
      {...props}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={{ color: isPrimary ? "#fff" : semantic.textPrimary, fontWeight: "700", fontSize: typography.size.md }}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Input({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label && <Text style={{ color: semantic.textSecondary, fontSize: typography.size.xs, fontWeight: "600", marginBottom: 6 }}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.slate[500]}
        style={[{
          borderRadius: radii.md,
          backgroundColor: semantic.surface,
          borderWidth: 1,
          borderColor: colors.slate[700],
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md - 2,
          color: semantic.textPrimary,
          fontSize: typography.size.md,
        }, style]}
        {...props}
      />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{
      borderRadius: radii.lg,
      backgroundColor: semantic.surface,
      borderWidth: 1,
      borderColor: colors.slate[700],
      padding: spacing.lg,
    }, style]}>
      {children}
    </View>
  );
}

const BADGE_TONES: Record<string, string> = {
  default: colors.slate[700],
  success: "rgba(34,197,94,0.15)",
  warning: "rgba(245,158,11,0.15)",
  danger:  "rgba(239,68,68,0.15)",
};
const BADGE_TEXT: Record<string, string> = {
  default: colors.slate[300],
  success: colors.success,
  warning: colors.warning,
  danger:  colors.danger,
};

export function Badge({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" | "danger" }) {
  return (
    <View style={{ borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: BADGE_TONES[tone], alignSelf: "flex-start" }}>
      <Text style={{ color: BADGE_TEXT[tone], fontSize: typography.size.xs, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={{ paddingVertical: spacing["3xl"], alignItems: "center" }}>
      <ActivityIndicator color={semantic.accent} />
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing["3xl"], paddingHorizontal: spacing.xl }}>
      <Text style={{ fontSize: 40, marginBottom: spacing.sm, opacity: 0.4 }}>🎓</Text>
      <Text style={{ color: semantic.textPrimary, fontWeight: "700", textAlign: "center" }}>{title}</Text>
      {subtitle && (
        <Text style={{ color: semantic.textMuted, fontSize: typography.size.sm, marginTop: 4, textAlign: "center" }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
