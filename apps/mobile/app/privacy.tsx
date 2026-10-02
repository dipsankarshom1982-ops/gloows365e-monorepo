import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc } from "firebase/firestore";

import Header from "@/components/header";
import { useTheme } from "@/context/ThemeContext";
import { db } from "@/lib/firebase";

type Section = {
  id: string;
  icon: string;
  title: string;
  body: string;
};

// Bumped whenever policy content materially changes. Recorded into
// users/{uid}.consent.policyVersion and students/{uid}.parentalConsent.policyVersion
// at signup/registration — see app/(auth)/signup.tsx and app/(auth)/register.tsx —
// so a future policy change can be told apart from consent captured under an
// older version.
export const PRIVACY_POLICY_VERSION = "2026-07-17";

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
      "Your data is used to deliver and improve the Gloows365 learning experience, including personalised content recommendations, progress tracking, leaderboards, and notifications. We do not sell your personal data to third parties.",
  },
  {
    id: "storage",
    icon: "🗄️",
    title: "Data Storage & Security",
    body:
      "All data is stored securely on Google Firebase servers. We apply industry-standard encryption in transit (TLS) and at rest. Access to your data is restricted to authorised Gloows365 systems and personnel.",
  },
  {
    id: "third",
    icon: "🔗",
    title: "Third-Party Services",
    body:
      "Gloows365 integrates with trusted third-party services including Google Firebase (auth, database, storage), Cloudflare Stream (video delivery), and Razorpay (payments). Each service operates under its own privacy policy.",
  },
  {
    id: "rights",
    icon: "✅",
    title: "Your Rights",
    body:
      "Under the Digital Personal Data Protection Act, 2023, you have the right to access, correct, and erase your personal data. Go to Profile Settings → \"Export My Data\" to download everything we hold about you, or Profile Settings → \"Delete My Account\" to permanently erase your account and associated data. You can also reach us at support@gloows365.in. We process data-rights requests within 30 days. Some records (e.g. payment/financial records) may be retained beyond account deletion where Indian law requires it.",
  },
  {
    id: "children",
    icon: "👧",
    title: "Children's Privacy",
    body:
      "Gloows365 is built for school students in Class 6–12, most of whom are under 18. Registration requires an OTP-verified parent/guardian phone number and explicit parental consent, captured at signup, before any student account is created. We do not run behavioral tracking or targeted advertising on any account — ads shown in the app are selected only by subject/class relevance, never by inferred interests or browsing behavior. Parents may review or request deletion of their child's data at any time via support@gloows365.in.",
  },
  {
    id: "grievance",
    icon: "📮",
    title: "Grievance Redressal",
    // Fallback shown until publicConfig/grievanceOfficer loads (or if it's
    // never been set by an admin) — see the officer-details form in the
    // admin panel's Grievances page. Overridden below once loaded.
    body:
      "For any complaint or concern about how your personal data is handled, write to support@gloows365.in with the subject line \"Grievance\". We aim to acknowledge grievances within 7 days and resolve them within 30 days.",
  },
  {
    id: "updates",
    icon: "🔄",
    title: "Policy Updates",
    body:
      "We may update this Privacy Policy from time to time. When we do, we will notify you via in-app message or email. Continued use of the app after changes constitutes your acceptance of the revised policy.",
  },
];

type GrievanceOfficer = { name?: string; designation?: string; email?: string; phone?: string };

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [officer, setOfficer] = useState<GrievanceOfficer | null>(null);

  useEffect(() => {
    getDoc(doc(db, "publicConfig", "grievanceOfficer"))
      .then((snap) => { if (snap.exists()) setOfficer(snap.data() as GrievanceOfficer); })
      .catch(() => { /* fall back to the generic contact-us copy below */ });
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  // Set by an admin in the admin panel's Grievances page — see
  // publicConfig/grievanceOfficer in firestore.rules. Never fabricate a
  // name here; the generic fallback in SECTIONS stays until it's set.
  const sections = officer?.name
    ? SECTIONS.map((sec) =>
        sec.id === "grievance"
          ? {
              ...sec,
              body:
                `Grievance Officer: ${officer.name}${officer.designation ? `, ${officer.designation}` : ""}. ` +
                `For any complaint or concern about how your personal data is handled, write to ${officer.email || "support@gloows365.in"}` +
                `${officer.phone ? ` or call ${officer.phone}` : ""} with the subject line "Grievance". ` +
                `We aim to acknowledge grievances within 7 days and resolve them within 30 days.`,
            }
          : sec
      )
    : SECTIONS;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu={true} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={[styles.title, { color: colors.accent }]}>🔒 Privacy Policy</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Last updated: 17 July 2026
          </Text>
          <View style={[styles.heroBadge, { backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}30` }]}>
            <Text style={[styles.heroText, { color: colors.accent }]}>
              We respect your privacy and are committed to protecting your personal data.
            </Text>
          </View>
        </View>

        {/* Accordion Sections */}
        <View style={styles.sections}>
          {sections.map((sec) => {
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
        {/* FIX (leftover rebrand): this said support@nextvidya.in — stale
            from before the NextVidya → GLOOWS365E rebrand. Also made the
            box a real mailto: link since it's meant as a CTA — mirrors
            web's src/app/(app)/settings/privacy/page.tsx, already fixed there. */}
        <TouchableOpacity
          style={[styles.contactBox, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => Linking.openURL("mailto:support@gloows365.in")}
          activeOpacity={0.75}
        >
          <Ionicons name="mail-outline" size={22} color={colors.accent} />
          <View style={styles.contactText}>
            <Text style={[styles.contactTitle, { color: colors.text }]}>Questions about privacy?</Text>
            <Text style={[styles.contactSub, { color: colors.textSecondary }]}>
              support@gloows365.in
            </Text>
          </View>
        </TouchableOpacity>

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
