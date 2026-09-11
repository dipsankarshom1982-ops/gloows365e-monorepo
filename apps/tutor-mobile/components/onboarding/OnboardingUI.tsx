// apps/tutor-mobile/components/onboarding/OnboardingUI.tsx
// RN counterpart to apps/tutor/src/components/onboarding/OnboardingUI.tsx
// — same visual system (deep navy gradient, brand mark, glyph-icon
// fields, gradient CTA) as ../../app/(auth)/login.tsx, ported to RN
// primitives. No new dependency: hand-built <View> glyphs instead of
// @expo/vector-icons, same convention login.tsx/register.tsx already
// established for this app.

import { useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type BannerTone = "error" | "success" | "info";

const TONE = {
  error:   { box: "rgba(248,113,113,0.10)", border: "#F87171", badge: "#F87171", text: "#FCA5A5" },
  success: { box: "rgba(74,222,128,0.10)",  border: "#4ADE80", badge: "#4ADE80", text: "#86EFAC" },
  info:    { box: "rgba(129,140,248,0.10)", border: "#818CF8", badge: "#818CF8", text: "#C7D2FE" },
} as const;

export function Banner({ tone, children }: { tone: BannerTone; children: string }) {
  const c = TONE[tone];
  return (
    <View style={[styles.banner, { backgroundColor: c.box, borderLeftColor: c.border }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={[styles.bannerBadge, { backgroundColor: c.badge }]}>
        <Text style={styles.bannerBadgeText}>{tone === "success" ? "✓" : tone === "info" ? "i" : "!"}</Text>
      </View>
      <Text style={[styles.bannerText, { color: c.text }]}>{children}</Text>
    </View>
  );
}

export function FieldError({ children }: { children: string }) {
  return <Text style={styles.fieldError} accessibilityRole="alert">{children}</Text>;
}

export function BrandMark() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.logoWrap}>
        <Text style={styles.gloows}>
          <Text style={{ color: "#A5B4FC" }}>Gl</Text>
          <Text style={{ color: "#F1F5F9" }}>oows</Text>
        </Text>
        <LinearGradient colors={["#6366F1", "#8B5CF6", "#22D3EE"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pill}>
          <Text style={styles.pillText}>365</Text>
        </LinearGradient>
        <Text style={styles.eTag}>E</Text>
      </View>
      <View style={styles.tutorBadge}>
        <Text style={styles.tutorBadgeText}>TUTOR</Text>
      </View>
    </View>
  );
}

export function ProgressBar({ step, totalSteps, t }: { step: number; totalSteps: number; t: (k: string, o?: any) => string }) {
  const percent = Math.round(((step - 1) / totalSteps) * 100);
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{t("onboardingStepOf", { current: step, total: totalSteps })}</Text>
        <Text style={styles.progressPercent}>{percent}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

// Every field in this flow is mandatory (see Step2/3/4's file headers),
// so this only ever renders the required asterisk — no "(optional)"
// fallback text.
export function SectionLabel({ children }: { children: string; required?: boolean }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabelText}>{children}</Text>
      <Text style={styles.requiredMark}>*</Text>
    </View>
  );
}

export function Chip({ active, onPress, children }: { active: boolean; onPress: () => void; children: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </TouchableOpacity>
  );
}

export function TextField({
  label, required, value, onChangeText, placeholder, error, hint, keyboardType, maxLength, editable, multiline, onFocus, onBlur,
}: {
  label: string; required?: boolean; value: string; onChangeText: (v: string) => void;
  placeholder?: string; error?: string | null; hint?: string;
  keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
  maxLength?: number; editable?: boolean; multiline?: boolean;
  onFocus?: () => void; onBlur?: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <SectionLabel>{label}</SectionLabel>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5B6478"
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={editable}
        multiline={multiline}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[styles.input, error && styles.inputError, multiline && styles.inputMultiline]}
      />
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {error && <FieldError>{error}</FieldError>}
    </View>
  );
}

// Searchable single-select — RN has no native <select>, and no picker
// library is installed (see this file's header on avoiding new
// dependencies), so this is a plain full-screen Modal + FlatList + a
// filter TextInput. Used for State (36 options) — genuinely needs
// search — and reused for any other single-pick-from-a-list field.
export function SelectField({
  label, required, value, options, onSelect, placeholder,
}: {
  label: string; required?: boolean; value: string; options: readonly string[];
  onSelect: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query]
  );

  return (
    <View style={styles.fieldWrap}>
      <SectionLabel>{label}</SectionLabel>
      <TouchableOpacity style={styles.selectBox} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={value ? styles.selectValueText : styles.selectPlaceholderText}>{value || placeholder}</Text>
        <Text style={styles.selectChevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search…"
              placeholderTextColor="#5B6478"
              style={styles.modalSearch}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => { onSelect(item); setOpen(false); setQuery(""); }}
                >
                  <Text style={[styles.modalRowText, item === value && styles.modalRowTextActive]}>{item}</Text>
                  {item === value && <Text style={styles.modalRowCheck}>✓</Text>}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 360 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function PrimaryButton({
  onPress, disabled, loading, loadingLabel, children, style,
}: {
  onPress?: () => void; disabled?: boolean; loading?: boolean; loadingLabel?: string;
  children: string; style?: object;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.88} style={[styles.primaryButton, style, disabled && { opacity: 0.5 }]}>
      <LinearGradient colors={["#4F46E5", "#6366F1", "#22D3EE"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryButtonInner}>
        {loading ? (
          <View style={styles.buttonLoadingRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.primaryButtonText}>{loadingLabel}</Text>
          </View>
        ) : (
          <Text style={styles.primaryButtonText}>{children}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ onPress, disabled, children }: { onPress: () => void; disabled?: boolean; children: string }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={[styles.secondaryButton, disabled && { opacity: 0.5 }]}>
      <Text style={styles.secondaryButtonText}>{children}</Text>
    </TouchableOpacity>
  );
}

export function TextLink({ onPress, disabled, children }: { onPress: () => void; disabled?: boolean; children: string }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.textLink, disabled && { opacity: 0.5 }]}>
      <Text style={styles.textLinkText}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  logoWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  gloows:   { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  pill:     { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, justifyContent: "center", alignItems: "center" },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  eTag:     { fontSize: 9, fontWeight: "900", color: "#FBBF24" },
  tutorBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "rgba(99,102,241,0.16)", borderWidth: 1, borderColor: "rgba(99,102,241,0.4)" },
  tutorBadgeText: { color: "#A5B4FC", fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  progressWrap: { marginBottom: 22 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { color: "#64748B", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  progressPercent: { color: "#A5B4FC", fontSize: 11, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: "#818CF8" },

  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  sectionLabelText: { color: "#CBD5E1", fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  requiredMark: { color: "#F87171", fontSize: 10, fontWeight: "900" },

  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.05)", minHeight: 40, justifyContent: "center" },
  chipActive: { borderColor: "#818CF8", backgroundColor: "rgba(99,102,241,0.15)" },
  chipText: { color: "#CBD5E1", fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#C7D2FE" },

  fieldWrap: { marginBottom: 16 },
  input: {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
    color: "#F8FAFC", fontSize: 15, fontWeight: "500",
  },
  inputError: { borderColor: "#F87171" },
  inputMultiline: { minHeight: 110, textAlignVertical: "top" },
  hint: { color: "#5B6478", fontSize: 12, marginTop: 6, marginLeft: 2 },
  fieldError: { color: "#FCA5A5", fontSize: 12, fontWeight: "600", marginTop: 6, marginLeft: 2 },

  banner: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 16, borderLeftWidth: 3 },
  bannerBadge: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 1 },
  bannerBadgeText: { color: "#0B1226", fontSize: 10, fontWeight: "900" },
  bannerText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },

  primaryButton: { borderRadius: 18, overflow: "hidden", height: 54, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 5 },
  primaryButtonInner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },
  buttonLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  secondaryButton: { height: 54, paddingHorizontal: 22, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  secondaryButtonText: { color: "#CBD5E1", fontWeight: "800", fontSize: 15 },

  textLink: { marginTop: 16, paddingVertical: 6, alignItems: "center" },
  textLinkText: { color: "#94A3B8", fontSize: 13.5, fontWeight: "700" },

  // ── SelectField / modal picker ──
  selectBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
  },
  selectValueText: { color: "#F8FAFC", fontSize: 15, fontWeight: "500" },
  selectPlaceholderText: { color: "#5B6478", fontSize: 15 },
  selectChevron: { color: "#64748B", fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#0B1226", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 32, paddingHorizontal: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "800" },
  modalClose: { color: "#94A3B8", fontSize: 18, fontWeight: "700" },
  modalSearch: {
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    color: "#F8FAFC", fontSize: 14,
  },
  modalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  modalRowText: { color: "#CBD5E1", fontSize: 14.5 },
  modalRowTextActive: { color: "#A5B4FC", fontWeight: "700" },
  modalRowCheck: { color: "#818CF8", fontSize: 14, fontWeight: "900" },
});
