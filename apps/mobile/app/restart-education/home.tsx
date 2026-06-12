// PATH: app/restart-education/home.tsx

import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  name?:            string;
  preferredLanguage?: string;
  lastClassPassed?: string;
  age?:             number;
}

interface Module {
  id:       string;
  emoji:    string;
  title:    string;
  subtitle: string;
  gradient: [string, string];
  route:    string | null;
  disabled?: boolean;
}

// ─── Module cards ─────────────────────────────────────────────────────────────

const MODULES: Module[] = [
  {
    id:       "pathways",
    emoji:    "🎓",
    title:    "Continue Your Education",
    subtitle: "Open schooling, distance learning & more",
    gradient: ["#1e3a5f", "#1d4ed8"],
    route:    "/restart-education/pathways",
  },
  {
    id:       "ai-advisor",
    emoji:    "🤖",
    title:    "AI Education Advisor",
    subtitle: "Get personalised guidance instantly",
    gradient: ["#1a1040", "#7c3aed"],
    route:    "/restart-education/ai-advisor",
  },
  {
    id:       "success-stories",
    emoji:    "🌟",
    title:    "Success Stories",
    subtitle: "Real people who restarted their journey",
    gradient: ["#2d1a0a", "#b45309"],
    route:    "/restart-education/success-stories",
  },
  {
    id:       "opportunities",
    emoji:    "🎯",
    title:    "Education Opportunities",
    subtitle: "Scholarships, schemes & free courses",
    gradient: ["#0d2311", "#15803d"],
    route:    "/restart-education/opportunities",
  },
  {
    id:       "guidance",
    emoji:    "🤝",
    title:    "My Guidance Requests",
    subtitle: "Track your personal education support",
    gradient: ["#1e1b4b", "#4338ca"],
    route:    "/restart-education/guidance",
  },
  {
    id:       "coming-soon",
    emoji:    "🚀",
    title:    "Coming Soon",
    subtitle: "More features on the way",
    gradient: ["#1a1a1a", "#374151"],
    route:    null,
    disabled: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RestartHome() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) setProfile(snap.data() as UserProfile);
      },
      () => { /* ignore errors */ }
    );
    return () => unsub();
  }, []);

  const firstName = profile.name?.split(" ")[0] || "there";

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login" as any);
    } catch { /* ignore */ }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#0a0a1a", "#0d1a0d"]} style={S.container}>
        <StatusBar barStyle="light-content" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.scroll}
        >
          {/* Top bar */}
          <View style={S.topBar}>
            <View>
              <Text style={S.greeting}>Welcome back,</Text>
              <Text style={S.name}>{firstName} 👋</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={S.logoutBtn}>
              <Ionicons name="log-out-outline" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Hero banner */}
          <LinearGradient
            colors={["#14532d", "#166534", "#15803d"]}
            style={S.heroBanner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={S.heroEmoji}>🎓</Text>
            <Text style={S.heroTitle}>Restart My Education</Text>
            <Text style={S.heroQuote}>
              "No dream should stop because of circumstances."
            </Text>
            {profile.lastClassPassed && (
              <View style={S.lastClassBadge}>
                <Text style={S.lastClassText}>
                  Last studied: {profile.lastClassPassed}
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* Section title */}
          <Text style={S.sectionTitle}>Where would you like to start?</Text>

          {/* Module cards */}
          <View style={S.grid}>
            {MODULES.map((mod) => (
              <TouchableOpacity
                key={mod.id}
                style={[S.card, mod.disabled && S.cardDisabled]}
                onPress={() => {
                  if (!mod.disabled && mod.route) {
                    router.push(mod.route as any);
                  }
                }}
                activeOpacity={mod.disabled ? 1 : 0.85}
              >
                <LinearGradient
                  colors={mod.gradient}
                  style={S.cardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={S.cardEmoji}>{mod.emoji}</Text>
                  <Text style={S.cardTitle}>{mod.title}</Text>
                  <Text style={S.cardSubtitle}>{mod.subtitle}</Text>
                  {!mod.disabled && (
                    <View style={S.cardArrow}>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color="rgba(255,255,255,0.7)"
                      />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Daily motivation */}
          <View style={S.motivationCard}>
            <Text style={S.motivationEmoji}>💪</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.motivationTitle}>Remember</Text>
              <Text style={S.motivationText}>
                Every day you take a step towards your education is a victory.
                Thousands of people have restarted — and so can you.
              </Text>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  topBar:   {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 20,
  },
  greeting:  { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  name:      { color: "#fff", fontSize: 22, fontWeight: "800" },
  logoutBtn: { padding: 8 },

  heroBanner: {
    borderRadius: 20, padding: 24, marginBottom: 24,
    alignItems: "flex-start",
  },
  heroEmoji:  { fontSize: 40, marginBottom: 8 },
  heroTitle:  { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 6 },
  heroQuote: {
    color: "rgba(255,255,255,0.75)", fontSize: 13,
    lineHeight: 20, fontStyle: "italic", marginBottom: 12,
  },
  lastClassBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  lastClassText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  sectionTitle: {
    color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700",
    letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12,
  },

  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  card:         { width: "47%", borderRadius: 18, overflow: "hidden" },
  cardDisabled: { opacity: 0.45 },
  cardGradient: { padding: 18, minHeight: 140, justifyContent: "flex-end" },
  cardEmoji:    { fontSize: 30, marginBottom: 8 },
  cardTitle: {
    color: "#fff", fontSize: 14, fontWeight: "800",
    marginBottom: 4, lineHeight: 18,
  },
  cardSubtitle: { color: "rgba(255,255,255,0.65)", fontSize: 11, lineHeight: 16 },
  cardArrow: {
    position: "absolute", top: 14, right: 14,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },

  motivationCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  motivationEmoji: { fontSize: 28 },
  motivationTitle: { color: "#4ade80", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  motivationText: {
    color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 18,
  },
});
