import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
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

type LinkItem = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  href: string;
};

const LINKS: LinkItem[] = [
  {
    icon: "mail-outline",
    label: "Support",
    value: "support@nextvidya.in",
    href: "mailto:support@nextvidya.in",
  },
  {
    icon: "globe-outline",
    label: "Website",
    value: "www.nextvidya.in",
    href: "https://www.nextvidya.in",
  },
];

type FeatureItem = { icon: string; title: string; desc: string };
const FEATURES: FeatureItem[] = [
  { icon: "🎓", title: "Seekho", desc: "Structured video courses from class 4 to 12" },
  { icon: "⚔️", title: "Skill Battle", desc: "Live quiz battles to compete and earn VCoins" },
  { icon: "🤖", title: "AI Guru", desc: "Personalised AI-powered learning assistant" },
  { icon: "📺", title: "Reels", desc: "Bite-sized knowledge shorts for quick learning" },
  { icon: "🏅", title: "Leaderboard", desc: "Rank among peers and track your progress" },
];

export default function AboutScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu={true} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* App Identity */}
        <View style={styles.hero}>
          <View style={[styles.logoBox, { backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}30` }]}>
            <Text style={styles.logoText}>GL</Text>
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>GLOOWS365E</Text>
          <Text style={[styles.tagline, { color: colors.accent }]}>
            Learn. Compete. Grow.
          </Text>
          <View style={[styles.versionBadge, { backgroundColor: `${colors.accent}15` }]}>
            <Text style={[styles.versionText, { color: colors.accent }]}>Version 1.0.0</Text>
          </View>
        </View>

        {/* Mission */}
        <View style={[styles.missionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🎯 Our Mission</Text>
          <Text style={[styles.missionText, { color: colors.textSecondary }]}>
            GLOOWS365E is a gamified learning platform built for students from Class 4 to 12.
            We combine structured courses, AI-powered guidance, and competitive quizzes to make
            education engaging, accessible, and effective — in every Indian language.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 20 }]}>
            ✨ What's Inside
          </Text>
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View
                key={f.title}
                style={[styles.featureRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Contact / Links */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 20 }]}>
            📬 Get in Touch
          </Text>
          <View style={styles.linkList}>
            {LINKS.map((link) => (
              <TouchableOpacity
                key={link.label}
                style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => Linking.openURL(link.href)}
                activeOpacity={0.75}
              >
                <View style={[styles.linkIconBox, { backgroundColor: `${colors.accent}15` }]}>
                  <Ionicons name={link.icon} size={20} color={colors.accent} />
                </View>
                <View style={styles.linkText}>
                  <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>{link.label}</Text>
                  <Text style={[styles.linkValue, { color: colors.text }]}>{link.value}</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Legal */}
        <View style={styles.legalRow}>
          <Text style={[styles.legalText, { color: colors.textSecondary }]}>
            © 2026 GLOOWS365E. All rights reserved.
          </Text>
          <TouchableOpacity onPress={() => router.push("/privacy" as any)}>
            <Text style={[styles.legalLink, { color: colors.accent }]}>Privacy Policy</Text>
          </TouchableOpacity>
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

  hero: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoText: { fontSize: 30, fontWeight: "900", color: "#6366f1" },
  appName: { fontSize: 28, fontWeight: "900", marginBottom: 4 },
  tagline: { fontSize: 14, fontWeight: "600", marginBottom: 10 },
  versionBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  versionText: { fontSize: 12, fontWeight: "700" },

  missionCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  missionText: { fontSize: 13, lineHeight: 22, fontWeight: "500", marginTop: 8 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },

  featureList: { paddingHorizontal: 20, gap: 10 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  featureIcon: { fontSize: 22 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: "700" },
  featureDesc: { fontSize: 12, fontWeight: "500", marginTop: 2 },

  linkList: { paddingHorizontal: 20, gap: 10 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  linkIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  linkText: { flex: 1 },
  linkLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  linkValue: { fontSize: 14, fontWeight: "700" },

  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  legalText: { fontSize: 11, fontWeight: "500" },
  legalLink: { fontSize: 11, fontWeight: "700" },

  backBtn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  backBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
