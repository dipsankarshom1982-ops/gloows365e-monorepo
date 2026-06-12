import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import type { TrendingTerm } from "@/lib/discover/types";
import { getTrending } from "@/services/discoverApi";
import { useDiscoverStore } from "@/store/discoverStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Discovery sections config ────────────────────────────────────────────────

const DISCOVERY_SECTIONS = [
  {
    sectionId: "trending_careers",
    title: "Trending Careers",
    emoji: "🔥",
    cards: [
      { id: "1", emoji: "🤖", title: "AI Engineer", subtitle: "₹12–40 LPA", gradient: ["#1e3a5f", "#2563eb"] as [string,string], query: "AI engineer career India" },
      { id: "2", emoji: "📱", title: "App Developer", subtitle: "₹8–30 LPA", gradient: ["#312e81", "#4f46e5"] as [string,string], query: "app developer career India" },
      { id: "3", emoji: "🎮", title: "Game Developer", subtitle: "₹6–20 LPA", gradient: ["#4c1d95", "#7c3aed"] as [string,string], query: "game developer career India" },
      { id: "4", emoji: "🧬", title: "Bioinformatics", subtitle: "₹8–25 LPA", gradient: ["#064e3b", "#059669"] as [string,string], query: "bioinformatics career India" },
    ],
  },
  {
    sectionId: "future_tech",
    title: "Future Tech Skills",
    emoji: "⚡",
    cards: [
      { id: "1", emoji: "⚛️", title: "Quantum Computing", subtitle: "High Demand", gradient: ["#1e1b4b", "#4338ca"] as [string,string], query: "quantum computing career India" },
      { id: "2", emoji: "🔗", title: "Blockchain", subtitle: "₹10–35 LPA", gradient: ["#1a3a1a", "#15803d"] as [string,string], query: "blockchain developer career India" },
      { id: "3", emoji: "🥽", title: "AR/VR Developer", subtitle: "₹8–22 LPA", gradient: ["#4c1d95", "#9333ea"] as [string,string], query: "AR VR developer career India" },
      { id: "4", emoji: "🤖", title: "Robotics", subtitle: "₹10–30 LPA", gradient: ["#1e3a5f", "#0369a1"] as [string,string], query: "robotics engineer career India" },
    ],
  },
  {
    sectionId: "competitive_exams",
    title: "Competitive Exams",
    emoji: "📝",
    cards: [
      { id: "1", emoji: "🏛️", title: "UPSC IAS", subtitle: "Civil Services", gradient: ["#450a0a", "#b91c1c"] as [string,string], query: "UPSC IAS preparation guide" },
      { id: "2", emoji: "🔬", title: "IIT JEE", subtitle: "Engineering", gradient: ["#1e3a5f", "#1d4ed8"] as [string,string], query: "IIT JEE preparation strategy" },
      { id: "3", emoji: "💊", title: "NEET Medical", subtitle: "Medical Entry", gradient: ["#064e3b", "#047857"] as [string,string], query: "NEET medical entrance preparation" },
      { id: "4", emoji: "💼", title: "SSC CGL", subtitle: "Govt Jobs", gradient: ["#451a03", "#b45309"] as [string,string], query: "SSC CGL government job preparation" },
    ],
  },
  {
    sectionId: "scholarships",
    title: "Scholarships",
    emoji: "🎓",
    cards: [
      { id: "1", emoji: "🇮🇳", title: "NSP Scholarship", subtitle: "Up to ₹36,000", gradient: ["#1e3a5f", "#1d4ed8"] as [string,string], query: "NSP National Scholarship Portal India" },
      { id: "2", emoji: "🌟", title: "INSPIRE Scheme", subtitle: "₹80,000/year", gradient: ["#064e3b", "#065f46"] as [string,string], query: "INSPIRE scholarship for science students" },
      { id: "3", emoji: "🎖️", title: "PM Scholarship", subtitle: "Defense families", gradient: ["#450a0a", "#991b1b"] as [string,string], query: "PM scholarship scheme India" },
      { id: "4", emoji: "🏆", title: "Merit Scholarships", subtitle: "State level", gradient: ["#451a03", "#92400e"] as [string,string], query: "merit based scholarships India students 2025" },
    ],
  },
  {
    sectionId: "high_salary",
    title: "High Salary Careers",
    emoji: "💰",
    cards: [
      { id: "1", emoji: "📊", title: "Investment Banker", subtitle: "₹20–80 LPA", gradient: ["#451a03", "#c2410c"] as [string,string], query: "investment banking career India" },
      { id: "2", emoji: "🧑‍⚕️", title: "Surgeon", subtitle: "₹25–100 LPA", gradient: ["#064e3b", "#059669"] as [string,string], query: "surgeon career India medical" },
      { id: "3", emoji: "📈", title: "Data Scientist", subtitle: "₹15–60 LPA", gradient: ["#1e1b4b", "#4338ca"] as [string,string], query: "data scientist career India" },
      { id: "4", emoji: "✈️", title: "Airline Pilot", subtitle: "₹15–50 LPA", gradient: ["#1e3a5f", "#075985"] as [string,string], query: "airline pilot career India" },
    ],
  },
  {
    sectionId: "govt_jobs",
    title: "Government Jobs",
    emoji: "🏛️",
    cards: [
      { id: "1", emoji: "🏛️", title: "IAS Officer", subtitle: "Grade A Service", gradient: ["#450a0a", "#b91c1c"] as [string,string], query: "IAS officer government job India" },
      { id: "2", emoji: "🏦", title: "Bank PO (IBPS)", subtitle: "₹6–14 LPA", gradient: ["#1e3a5f", "#1d4ed8"] as [string,string], query: "bank PO IBPS SBI career" },
      { id: "3", emoji: "🚂", title: "RRB Railway", subtitle: "₹4–12 LPA", gradient: ["#1a3a1a", "#15803d"] as [string,string], query: "railway RRB government job India" },
      { id: "4", emoji: "👮", title: "Police/Defence", subtitle: "₹5–15 LPA", gradient: ["#451a03", "#92400e"] as [string,string], query: "police defence government job India" },
    ],
  },
  {
    sectionId: "coding_ai",
    title: "Coding & AI",
    emoji: "💻",
    cards: [
      { id: "1", emoji: "🐍", title: "Python Dev", subtitle: "₹6–25 LPA", gradient: ["#1a3a1a", "#166534"] as [string,string], query: "Python developer career India" },
      { id: "2", emoji: "🌐", title: "Full Stack Web", subtitle: "₹8–30 LPA", gradient: ["#1e3a5f", "#1d4ed8"] as [string,string], query: "full stack web developer career India" },
      { id: "3", emoji: "🔐", title: "Cybersecurity", subtitle: "₹10–40 LPA", gradient: ["#450a0a", "#991b1b"] as [string,string], query: "cybersecurity career India" },
      { id: "4", emoji: "☁️", title: "Cloud Engineer", subtitle: "₹12–45 LPA", gradient: ["#1e1b4b", "#312e81"] as [string,string], query: "cloud computing engineer career India" },
    ],
  },
  {
    sectionId: "college_discovery",
    title: "College Discovery",
    emoji: "🏫",
    cards: [
      { id: "1", emoji: "🔭", title: "Top IITs", subtitle: "Engineering", gradient: ["#1e3a5f", "#1d4ed8"] as [string,string], query: "IIT admission process eligibility fees" },
      { id: "2", emoji: "🏥", title: "AIIMS Medical", subtitle: "Medicine", gradient: ["#064e3b", "#065f46"] as [string,string], query: "AIIMS medical college admission" },
      { id: "3", emoji: "⚖️", title: "Top NLUs", subtitle: "Law", gradient: ["#451a03", "#92400e"] as [string,string], query: "NLU national law university admission CLAT" },
      { id: "4", emoji: "📊", title: "IIM MBA", subtitle: "Management", gradient: ["#1e1b4b", "#4338ca"] as [string,string], query: "IIM MBA admission CAT exam" },
    ],
  },
  {
    sectionId: "ai_recommended",
    title: "AI Recommended",
    emoji: "🤖",
    cards: [
      { id: "1", emoji: "🎨", title: "UI/UX Design", subtitle: "Creative Tech", gradient: ["#831843", "#be185d"] as [string,string], query: "UI UX design career India" },
      { id: "2", emoji: "📹", title: "Content Creator", subtitle: "Digital Media", gradient: ["#450a0a", "#c2410c"] as [string,string], query: "content creator YouTuber career India" },
      { id: "3", emoji: "🏗️", title: "Civil Engineer", subtitle: "₹5–18 LPA", gradient: ["#451a03", "#b45309"] as [string,string], query: "civil engineering career India" },
      { id: "4", emoji: "🧪", title: "Research Scientist", subtitle: "₹8–30 LPA", gradient: ["#1a3a1a", "#166534"] as [string,string], query: "research scientist career India" },
    ],
  },
  {
    sectionId: "study_motivation",
    title: "Study Strategies",
    emoji: "✨",
    cards: [
      { id: "1", emoji: "🧠", title: "Focus Techniques", subtitle: "Study Better", gradient: ["#1e1b4b", "#4338ca"] as [string,string], query: "focus techniques study better students" },
      { id: "2", emoji: "⏰", title: "Time Management", subtitle: "Productivity", gradient: ["#064e3b", "#047857"] as [string,string], query: "time management tips students exams" },
      { id: "3", emoji: "😌", title: "Exam Stress Relief", subtitle: "Mental Health", gradient: ["#4c1d95", "#7c3aed"] as [string,string], query: "exam stress management students" },
      { id: "4", emoji: "📋", title: "Revision Hacks", subtitle: "Memorise Fast", gradient: ["#1e3a5f", "#1d4ed8"] as [string,string], query: "revision strategies memorise faster students" },
    ],
  },
];

const MOTIVATIONAL_LINES = [
  "Every search brings you closer to your dream 🌟",
  "Your future career is one discovery away ✨",
  "AI is your personal career counsellor today 🤖",
  "Explore. Discover. Achieve. 🚀",
  "Great careers start with great curiosity 💡",
];

// ─── SectionRow sub-component ─────────────────────────────────────────────────

function SectionRow({ section, onCardPress }: {
  section: typeof DISCOVERY_SECTIONS[number];
  onCardPress: (query: string) => void;
}) {
  return (
    <View style={D.sectionBlock}>
      <View style={D.sectionHeader}>
        <Text style={D.sectionTitle}>{section.emoji} {section.title}</Text>
        <Text style={D.sectionViewAll}>See All →</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={D.sectionScroll}
      >
        {section.cards.map((card) => (
          <TouchableOpacity
            key={card.id}
            onPress={() => onCardPress(card.query)}
            activeOpacity={0.82}
            style={D.cardWrap}
          >
            <LinearGradient
              colors={card.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={D.card}
            >
              <Text style={D.cardEmoji}>{card.emoji}</Text>
              <Text style={D.cardTitle}>{card.title}</Text>
              <Text style={D.cardSubtitle}>{card.subtitle}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DiscoverHomeScreen() {
  const { studentProfile } = useStudentProfile();
  const { colors } = useTheme();
  const { searchHistory, remainingSearches } = useDiscoverStore();

  const [query, setQuery] = useState("");
  const [trendingTerms, setTrendingTerms] = useState<TrendingTerm[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [motiveLine] = useState(
    () => MOTIVATIONAL_LINES[Math.floor(Math.random() * MOTIVATIONAL_LINES.length)]
  );

  const borderAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    // Fetch trending
    getTrending()
      .then((r) => setTrendingTerms(r.terms.slice(0, 8)))
      .catch(() => {});
  }, []);

  const handleFocus = () => {
    setSearchFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 250, useNativeDriver: false }).start();
  };

  const handleBlur = () => {
    setSearchFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 250, useNativeDriver: false }).start();
  };

  const handleSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push({ pathname: "/discover/result", params: { query: trimmed } });
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(99,102,241,0.3)", "rgba(99,102,241,0.9)"],
  });

  const firstName = studentProfile?.name?.split(" ")[0] ?? "Student";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const freeSearchesLeft = remainingSearches !== null ? remainingSearches : 3;

  return (
    <SafeAreaView style={D.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={D.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={D.backBtn}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* ── Header ──────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#0f0c29", "#1e1b4b", "#2d1f6e"]}
          style={D.headerCard}
        >
          {/* Glow orb */}
          <Animated.View style={[D.glowOrb, { opacity: glowAnim }]} />

          <View style={D.headerTop}>
            <View style={D.aiBadge}>
              <Text style={D.aiBadgeText}>🧭 Discover AI</Text>
            </View>
            {remainingSearches !== null && (
              <View style={D.searchCountBadge}>
                <Text style={D.searchCountText}>{freeSearchesLeft} free left today</Text>
              </View>
            )}
          </View>

          <Text style={D.greeting}>{greeting}, {firstName} 👋</Text>
          <Text style={D.motiveLine}>{motiveLine}</Text>

          {/* Stats row */}
          <View style={D.statsRow}>
            <View style={D.statChip}>
              <Text style={D.statEmoji}>🔥</Text>
              <Text style={D.statValue}>{studentProfile?.LearnFunXP ?? 0}</Text>
              <Text style={D.statLabel}>XP</Text>
            </View>
            <View style={D.statChip}>
              <Text style={D.statEmoji}>🪙</Text>
              <Text style={D.statValue}>{studentProfile?.LearnFunCoins ?? 0}</Text>
              <Text style={D.statLabel}>V-Coins</Text>
            </View>
            <View style={D.statChip}>
              <Text style={D.statEmoji}>📚</Text>
              <Text style={D.statValue}>{searchHistory.length}</Text>
              <Text style={D.statLabel}>Searches</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── AI Search Bar ─────────────────────────────────────── */}
        <View style={D.searchSection}>
          <Animated.View style={[D.searchBar, { borderColor }]}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" style={{ marginLeft: 14 }} />
            <TextInput
              style={D.searchInput}
              placeholder="What do you want to learn, explore, or become today?"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={query}
              onChangeText={setQuery}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onSubmitEditing={() => handleSearch(query)}
              returnKeyType="search"
              multiline={false}
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => handleSearch(query)}
                style={D.searchSubmitBtn}
              >
                <LinearGradient colors={["#6366f1", "#8b5cf6"]} style={D.searchSubmitGrad}>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => Alert.alert("Voice Search", "Coming soon! Use text search for now.", [{ text: "OK" }])}
                style={D.micBtn}
              >
                <Ionicons name="mic-outline" size={20} color="rgba(99,102,241,0.8)" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        {/* ── Trending chips ────────────────────────────────────── */}
        {trendingTerms.length > 0 && (
          <View style={D.trendingSection}>
            <Text style={D.trendingLabel}>🔥 Trending searches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={D.trendingScroll}>
              {trendingTerms.map((t) => (
                <TouchableOpacity
                  key={t.term}
                  onPress={() => handleSearch(t.term)}
                  style={D.trendingChip}
                  activeOpacity={0.8}
                >
                  <Text style={D.trendingChipText}>{t.term}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent searches */}
        {searchHistory.length > 0 && (
          <View style={D.recentSection}>
            <Text style={D.trendingLabel}>🕐 Recent</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={D.trendingScroll}>
              {searchHistory.slice(0, 5).map((h) => (
                <TouchableOpacity
                  key={h.queryHash}
                  onPress={() => handleSearch(h.query)}
                  style={D.recentChip}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={D.recentChipText}>{h.query}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── 10 Discovery Sections ─────────────────────────────── */}
        {DISCOVERY_SECTIONS.map((section) => (
          <SectionRow
            key={section.sectionId}
            section={section}
            onCardPress={handleSearch}
          />
        ))}

        {/* Upgrade nudge for free users */}
        {remainingSearches !== null && remainingSearches <= 1 && (
          <TouchableOpacity
            onPress={() => router.push("/discover/subscription")}
            style={D.upgradeNudge}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#312e81", "#6366f1"]} style={D.upgradeGrad}>
              <Text style={D.upgradeText}>
                🔓 Upgrade to Premium for unlimited AI searches
              </Text>
              <Text style={D.upgradeSubText}>₹199/month · Cancel anytime →</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const D = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#030712" },
  scroll:           { paddingBottom: 20 },

  backBtn:          { marginLeft: 16, marginTop: 8, marginBottom: 4, width: 40, height: 40, justifyContent: "center" },

  // Header card
  headerCard:       { marginHorizontal: 16, marginBottom: 16, borderRadius: 24, padding: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(99,102,241,0.25)" },
  glowOrb:          { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(99,102,241,0.18)", top: -60, right: -60 },
  headerTop:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  aiBadge:          { backgroundColor: "rgba(99,102,241,0.25)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(139,92,246,0.4)" },
  aiBadgeText:      { color: "#a5b4fc", fontSize: 12, fontWeight: "800" },
  searchCountBadge: { backgroundColor: "rgba(16,185,129,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" },
  searchCountText:  { color: "#4ade80", fontSize: 11, fontWeight: "700" },
  greeting:         { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 4 },
  motiveLine:       { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "500", marginBottom: 16 },
  statsRow:         { flexDirection: "row", gap: 10 },
  statChip:         { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.07)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  statEmoji:        { fontSize: 14 },
  statValue:        { color: "#fff", fontSize: 14, fontWeight: "800" },
  statLabel:        { color: "rgba(255,255,255,0.45)", fontSize: 11 },

  // Search
  searchSection:    { paddingHorizontal: 16, marginBottom: 16 },
  searchBar:        { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(30,27,75,0.9)", borderRadius: 16, borderWidth: 1.5, gap: 8, minHeight: 54, elevation: 6, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  searchInput:      { flex: 1, color: "#fff", fontSize: 14, fontWeight: "500", paddingVertical: 14, paddingRight: 8 },
  searchSubmitBtn:  { marginRight: 8 },
  searchSubmitGrad: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  micBtn:           { width: 44, height: 44, justifyContent: "center", alignItems: "center", marginRight: 4 },

  // Trending
  trendingSection:  { marginBottom: 8 },
  recentSection:    { marginBottom: 16 },
  trendingLabel:    { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 8 },
  trendingScroll:   { paddingHorizontal: 16, gap: 8 },
  trendingChip:     { backgroundColor: "rgba(99,102,241,0.18)", borderWidth: 1, borderColor: "rgba(99,102,241,0.35)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  trendingChipText: { color: "#a5b4fc", fontSize: 12, fontWeight: "600" },
  recentChip:       { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  recentChipText:   { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "500", maxWidth: 140 },

  // Discovery sections
  sectionBlock:     { marginBottom: 24 },
  sectionHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle:     { color: "#fff", fontSize: 17, fontWeight: "800" },
  sectionViewAll:   { color: "#6366f1", fontSize: 13, fontWeight: "700" },
  sectionScroll:    { paddingLeft: 16, paddingRight: 4 },
  cardWrap:         { marginRight: 12 },
  card:             { width: 140, height: 140, borderRadius: 20, padding: 14, justifyContent: "flex-end", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  cardEmoji:        { fontSize: 30, marginBottom: 6 },
  cardTitle:        { color: "#fff", fontSize: 13, fontWeight: "800", lineHeight: 18 },
  cardSubtitle:     { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600", marginTop: 2 },

  // Upgrade nudge
  upgradeNudge:     { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: "hidden" },
  upgradeGrad:      { padding: 18 },
  upgradeText:      { color: "#fff", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  upgradeSubText:   { color: "rgba(255,255,255,0.6)", fontSize: 13 },
});
