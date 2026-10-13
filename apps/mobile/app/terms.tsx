// PATH: app/terms.tsx
//
// No Terms & Conditions page existed before this — Parent Permissions
// (app/(auth)/parent-permissions.tsx) needs one to link to, alongside the
// existing Privacy Policy (app/privacy.tsx), whose accordion structure this
// mirrors.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/header";
import { useTheme } from "@/context/ThemeContext";

type Section = { id: string; icon: string; title: string; body: string };

// Bumped whenever terms content materially changes. Recorded into
// students/{uid}.parentPermissions.policyVersion alongside
// PRIVACY_POLICY_VERSION at Parent Permissions — see
// app/(auth)/parent-permissions.tsx.
export const TERMS_VERSION = "2026-09-23";

const SECTIONS: Section[] = [
  {
    id: "acceptance",
    icon: "📜",
    title: "Acceptance of Terms",
    body:
      "By creating a Gloows365 account for your child, you agree to these Terms & Conditions. If you do not agree, please do not proceed with registration.",
  },
  {
    id: "eligibility",
    icon: "🎓",
    title: "Eligibility & Parental Responsibility",
    body:
      "Gloows365 is built for school students, most of whom are minors. A parent or legal guardian must create and verify the account on the student's behalf, and remains responsible for the accuracy of the information provided and for supervising the student's use of the platform.",
  },
  {
    id: "conduct",
    icon: "🤝",
    title: "Acceptable Use",
    body:
      "The platform must be used only for lawful, educational purposes. Uploading harmful, abusive, or copyrighted content without rights, attempting to bypass moderation, or misusing rewards/referral systems may result in suspension or termination of the account.",
  },
  {
    id: "content",
    icon: "🎬",
    title: "User-Generated Content",
    body:
      "Content submitted by students (such as SkillBattle reels) is reviewed through our moderation pipeline before publication. By submitting content you confirm you own the rights to it or have permission to use it, and you grant Gloows365 a license to host and display it on the platform.",
  },
  {
    id: "payments",
    icon: "💳",
    title: "Payments & Refunds",
    body:
      "Paid features (such as tutor bookings or premium content) are processed through Razorpay. Refunds, where applicable, are handled per the policy shown at the time of purchase and may take a few business days to reflect.",
  },
  {
    id: "termination",
    icon: "🚪",
    title: "Suspension & Termination",
    body:
      "We may suspend or terminate an account that violates these terms, misuses the platform, or poses a safety risk to other users. You may request account deletion at any time via Profile Settings or by contacting support.",
  },
  {
    id: "liability",
    icon: "⚖️",
    title: "Limitation of Liability",
    body:
      "Gloows365 is provided on an \"as is\" basis. While we take reasonable care to ensure accuracy and availability, we are not liable for indirect or incidental damages arising from use of the platform, to the extent permitted by law.",
  },
  {
    id: "updates",
    icon: "🔄",
    title: "Changes to These Terms",
    body:
      "We may update these Terms from time to time. Material changes will be notified via in-app message or email. Continued use of the app after changes constitutes acceptance of the revised terms.",
  },
];

export default function TermsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu={true} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.pageHeader}>
          <Text style={[styles.title, { color: colors.accent }]}>📜 Terms & Conditions</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Last updated: 23 September 2026
          </Text>
        </View>

        <View style={styles.sections}>
          {SECTIONS.map((sec) => {
            const open = expanded === sec.id;
            return (
              <View
                key={sec.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: open ? colors.accent : colors.border }]}
              >
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggle(sec.id)} activeOpacity={0.75}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardIcon}>{sec.icon}</Text>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{sec.title}</Text>
                  </View>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                {open && (
                  <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{sec.body}</Text>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.contactBox, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => Linking.openURL("mailto:support@gloows365.in")}
          activeOpacity={0.75}
        >
          <Ionicons name="mail-outline" size={22} color={colors.accent} />
          <View style={styles.contactText}>
            <Text style={[styles.contactTitle, { color: colors.text }]}>Questions about these terms?</Text>
            <Text style={[styles.contactSub, { color: colors.textSecondary }]}>support@gloows365.in</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.accent }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  pageHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 12, fontWeight: "500", marginBottom: 12 },
  sections: { paddingHorizontal: 20, gap: 10, marginTop: 10 },
  card: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  cardIcon: { fontSize: 18 },
  cardTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  cardBody: { fontSize: 13, lineHeight: 21, paddingHorizontal: 14, paddingBottom: 14, fontWeight: "500" },
  contactBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  contactText: { flex: 1 },
  contactTitle: { fontSize: 14, fontWeight: "700" },
  contactSub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  backBtn: { marginHorizontal: 20, marginTop: 20, paddingVertical: 14, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  backBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
