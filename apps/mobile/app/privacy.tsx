import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/header";
import { useTheme } from "@/context/ThemeContext";

type Section = {
  id: string;
  icon: string;
  title: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    id: "collect",
    icon: "📋",
    title: "Data We Collect",
    body:
      "We collect information you provide directly — such as your name, email address, phone number, school, class, and profile picture — when you create or update your account. We also collect usage data like quiz scores, lesson progress, and in-app activity to personalise your learning experience.",
  },
  {
    id: "use",
    icon: "⚙️",
    title: "How We Use Your Data",
    body:
      "Your data is used to deliver and improve the GLOOWS365E learning experience, including personalised content recommendations, progress tracking, leaderboards, and notifications. We do not sell your personal data to third parties.",
  },
  {
    id: "storage",
    icon: "🗄️",
    title: "Data Storage & Security",
    body:
      "All data is stored securely on Google Firebase servers. We apply industry-standard encryption in transit (TLS) and at rest. Access to your data is restricted to authorised GLOOWS365E systems and personnel.",
  },
  {
    id: "third",
    icon: "🔗",
    title: "Third-Party Services",
    body:
      "GLOOWS365E integrates with trusted third-party services including Google Firebase (auth, database, storage), Cloudflare Stream (video delivery), and Razorpay (payments). Each service operates under its own privacy policy.",
  },
  {
    id: "rights",
    icon: "✅",
    title: "Your Rights",
    body:
      "You may request access to, correction of, or deletion of your personal data at any time through Profile Settings → Delete Account, or by contacting us at support@nextvidya.in. We will process your request within 30 days.",
  },
  {
    id: "children",
    icon: "👧",
    title: "Children's Privacy",
    body:
      "GLOOWS365E is designed for students and may be used by children under 13 with parental consent. We encourage parents to review their child's account activity. We do not knowingly collect sensitive data from children without verifiable parental consent.",
  },
  {
    id: "updates",
    icon: "🔄",
    title: "Policy Updates",
    body:
      "We may update this Privacy Policy from time to time. When we do, we will notify you via in-app message or email. Continued use of the app after changes constitutes your acceptance of the revised policy.",
  },
];

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu={true} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={[styles.title, { color: colors.accent }]}>🔒 Privacy Policy</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Last updated: May 2026
          </Text>
          <View style={[styles.heroBadge, { backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}30` }]}>
            <Text style={[styles.heroText, { color: colors.accent }]}>
              We respect your privacy and are committed to protecting your personal data.
            </Text>
          </View>
        </View>

        {/* Accordion Sections */}
        <View style={styles.sections}>
          {SECTIONS.map((sec) => {
            const open = expanded === sec.id;
            return (
              <View
                key={sec.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: open ? colors.accent : colors.border }]}
              >
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggle(sec.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardIcon}>{sec.icon}</Text>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{sec.title}</Text>
                  </View>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {open && (
                  <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                    {sec.body}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Contact CTA */}
        <View style={[styles.contactBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="mail-outline" size={22} color={colors.accent} />
          <View style={styles.contactText}>
            <Text style={[styles.contactTitle, { color: colors.text }]}>Questions about privacy?</Text>
            <Text style={[styles.contactSub, { color: colors.textSecondary }]}>
              support@nextvidya.in
            </Text>
          </View>
        </View>

        {/* Back */}
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backBtnText}>Back to Settings</Text>
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
  heroBadge: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  heroText: { fontSize: 13, fontWeight: "600", lineHeight: 20 },
  sections: { paddingHorizontal: 20, gap: 10, marginTop: 10 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  cardIcon: { fontSize: 18 },
  cardTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  cardBody: {
    fontSize: 13,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontWeight: "500",
  },
  contactBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  contactText: { flex: 1 },
  contactTitle: { fontSize: 14, fontWeight: "700" },
  contactSub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  backBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  backBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
