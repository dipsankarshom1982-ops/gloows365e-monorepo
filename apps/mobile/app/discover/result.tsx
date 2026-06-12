import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { useDiscoverStore } from "@/store/discoverStore";
import { searchDiscover } from "@/services/discoverApi";
import type { DiscoverResult, SalaryBar, Skill, LearningStep, CollegeSuggestion, ScholarshipSuggestion } from "@/lib/discover/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonPulse({ width, height, borderRadius = 8, style }: {
  width: number | string; height: number; borderRadius?: number; style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: "rgba(99,102,241,0.25)" }, { opacity }, style]}
    />
  );
}

function SalaryBarsChart({ bars }: { bars: SalaryBar[] }) {
  const MAX_LPA = 80;
  return (
    <View style={SC.barsContainer}>
      {bars.map((bar) => (
        <View key={bar.role} style={SC.barRow}>
          <Text style={SC.barRole} numberOfLines={1}>{bar.role}</Text>
          <View style={SC.barTrack}>
            <View
              style={[
                SC.barFill,
                {
                  width: `${Math.min((bar.maxLPA / MAX_LPA) * 100, 100)}%`,
                  backgroundColor: bar.color,
                },
              ]}
            />
          </View>
          <Text style={SC.barValue}>₹{bar.minLPA}–{bar.maxLPA}L</Text>
        </View>
      ))}
    </View>
  );
}

function DemandMeter({ score, anim }: { score: number; anim: Animated.Value }) {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "High Future Demand" : score >= 40 ? "Moderate Demand" : "Stable Demand";
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={SC.meterWrap}>
      <View style={SC.meterTrack}>
        <Animated.View style={[SC.meterFill, { width, backgroundColor: color }]} />
      </View>
      <View style={SC.meterLabelRow}>
        <Text style={[SC.meterLabel, { color }]}>{label}</Text>
        <Text style={[SC.meterScore, { color }]}>{score}/100</Text>
      </View>
    </View>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <SkeletonPulse width="100%" height={120} borderRadius={16} />
      <SkeletonPulse width="100%" height={100} borderRadius={16} />
      <SkeletonPulse width="100%" height={160} borderRadius={16} />
      <SkeletonPulse width="100%" height={80} borderRadius={16} />
      <SkeletonPulse width="100%" height={200} borderRadius={16} />
      <SkeletonPulse width="100%" height={140} borderRadius={16} />
    </ScrollView>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <View style={SC.section}>
      <View style={SC.sectionHeader}>
        <Text style={SC.sectionEmoji}>{emoji}</Text>
        <Text style={SC.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DiscoverResultScreen() {
  const { query } = useLocalSearchParams<{ query: string }>();
  const { studentProfile } = useStudentProfile();
  const { colors } = useTheme();
  const { addSearch, addResult, saveCareer, unsaveCareer, isCareerSaved, getCachedResult, setRemaining } =
    useDiscoverStore();

  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const demandAnim = useRef(new Animated.Value(0)).current;

  const animateDemand = (score: number) => {
    Animated.timing(demandAnim, {
      toValue: score / 100,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    if (!query) return;

    // Check Zustand session cache first
    const queryHash = simpleHash(query);
    const cached = getCachedResult(queryHash);
    if (cached) {
      setResult(cached);
      setLoading(false);
      setSaved(isCareerSaved(queryHash));
      animateDemand(cached.futureDemandScore);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const { result: r, remainingSearches } = await searchDiscover({
          query,
          language: studentProfile?.preferredLanguage ?? "English",
          studentName: studentProfile?.name ?? "Student",
          classLevel: studentProfile?.class ?? "10",
          interests: studentProfile?.interests ?? [],
        });
        setResult(r);
        setSaved(isCareerSaved(r.queryHash));
        addResult(r);
        addSearch(query, r.queryHash);
        setRemaining(remainingSearches);
        animateDemand(r.futureDemandScore);
      } catch (err: any) {
        setError({ message: err?.message ?? "Search failed", code: err?.code });
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [query]);

  const toggleSave = () => {
    if (!result) return;
    if (saved) {
      unsaveCareer(result.queryHash);
      setSaved(false);
    } else {
      saveCareer({
        careerId: result.queryHash,
        query: result.query,
        title: result.careerScope?.title ?? result.query,
        emoji: result.careerScope?.emoji ?? "🧭",
        savedAt: Date.now(),
      });
      setSaved(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[RS.container, { backgroundColor: "#030712" }]}>
        <View style={RS.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={RS.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={RS.topQuery} numberOfLines={1}>{query}</Text>
          <View style={{ width: 40 }} />
        </View>
        <LoadingSkeleton />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[RS.container, { backgroundColor: "#030712" }]}>
        <View style={RS.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={RS.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={RS.topQuery} numberOfLines={1}>{query}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={RS.errorWrap}>
          {error.code === "FREE_LIMIT_REACHED" ? (
            <LinearGradient colors={["#1e1b4b", "#312e81"]} style={RS.paywallCard}>
              <Text style={RS.paywallEmoji}>🔒</Text>
              <Text style={RS.paywallTitle}>Daily Limit Reached</Text>
              <Text style={RS.paywallSub}>{error.message}</Text>
              <TouchableOpacity
                onPress={() => router.push("/discover/subscription")}
                style={RS.paywallBtn}
              >
                <LinearGradient colors={["#6366f1", "#8b5cf6"]} style={RS.paywallBtnInner}>
                  <Text style={RS.paywallBtnText}>Unlock Premium — ₹199/month</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>← Go back</Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            <View style={RS.errorCard}>
              <Text style={RS.errorEmoji}>😕</Text>
              <Text style={RS.errorTitle}>Search failed</Text>
              <Text style={RS.errorSub}>{error.message}</Text>
              <TouchableOpacity
                onPress={() => router.back()}
                style={RS.retryBtn}
              >
                <Text style={RS.retryText}>← Try again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!result) return null;

  const demandColor =
    result.futureDemandScore >= 70
      ? "#10b981"
      : result.futureDemandScore >= 40
      ? "#f59e0b"
      : "#ef4444";

  return (
    <SafeAreaView style={[RS.container, { backgroundColor: "#030712" }]}>
      {/* Top bar */}
      <View style={RS.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={RS.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={RS.topQuery} numberOfLines={1}>{result.query}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={RS.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. AI Summary ─────────────────────────────────────── */}
        <LinearGradient colors={["#0f172a", "#1e1b4b"]} style={SC.summaryCard}>
          <View style={SC.summaryBadge}>
            <Text style={SC.summaryBadgeText}>✨ AI Discovery</Text>
          </View>
          <Text style={SC.summaryText}>{result.aiSummary}</Text>
        </LinearGradient>

        {/* ── 2. Career Scope ───────────────────────────────────── */}
        {result.careerScope && (
          <Section title="Career Scope" emoji="🎯">
            <LinearGradient colors={["#1e293b", "#0f172a"]} style={SC.careerCard}>
              <View style={SC.careerHeaderRow}>
                <Text style={SC.careerEmoji}>{result.careerScope.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={SC.careerTitle}>{result.careerScope.title}</Text>
                  <View style={SC.domainBadge}>
                    <Text style={SC.domainBadgeText}>{result.careerScope.domain}</Text>
                  </View>
                </View>
                <View style={[SC.demandBadge, { backgroundColor: demandColor + "25", borderColor: demandColor + "66" }]}>
                  <Text style={[SC.demandBadgeText, { color: demandColor }]}>
                    {result.careerScope.demandLevel?.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={SC.careerDesc}>{result.careerScope.description}</Text>
            </LinearGradient>
          </Section>
        )}

        {/* ── 3. Salary Insights ────────────────────────────────── */}
        {result.salaryBars?.length > 0 && (
          <Section title="Salary Insights" emoji="💰">
            <LinearGradient colors={["#1e293b", "#0f172a"]} style={SC.card}>
              <SalaryBarsChart bars={result.salaryBars} />
            </LinearGradient>
          </Section>
        )}

        {/* ── 4. Required Skills ────────────────────────────────── */}
        {result.requiredSkills?.length > 0 && (
          <Section title="Required Skills" emoji="⚡">
            <LinearGradient colors={["#1e293b", "#0f172a"]} style={SC.card}>
              {(["technical", "soft", "domain"] as const).map((cat) => {
                const skills = result.requiredSkills.filter((s) => s.category === cat);
                if (!skills.length) return null;
                return (
                  <View key={cat} style={SC.skillCatBlock}>
                    <Text style={SC.skillCatLabel}>
                      {cat === "technical" ? "🔧 Technical" : cat === "soft" ? "🤝 Soft Skills" : "📚 Domain"}
                    </Text>
                    <View style={SC.skillChips}>
                      {skills.map((sk) => (
                        <View
                          key={sk.name}
                          style={[
                            SC.skillChip,
                            sk.importance === "must_have"
                              ? SC.skillChipMust
                              : SC.skillChipGood,
                          ]}
                        >
                          <Text
                            style={[
                              SC.skillChipText,
                              sk.importance === "must_have"
                                ? SC.skillChipTextMust
                                : SC.skillChipTextGood,
                            ]}
                          >
                            {sk.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </LinearGradient>
          </Section>
        )}

        {/* ── 5. Learning Path ──────────────────────────────────── */}
        {result.learningPath?.length > 0 && (
          <Section title="Learning Path" emoji="🗺️">
            <View style={SC.stepperWrap}>
              {result.learningPath.map((step, idx) => (
                <View key={step.step} style={SC.stepRow}>
                  <View style={SC.stepLeft}>
                    <LinearGradient
                      colors={["#6366f1", "#8b5cf6"]}
                      style={SC.stepCircle}
                    >
                      <Text style={SC.stepNum}>{step.step}</Text>
                    </LinearGradient>
                    {idx < result.learningPath.length - 1 && <View style={SC.stepLine} />}
                  </View>
                  <LinearGradient colors={["#1e293b", "#0f172a"]} style={SC.stepContent}>
                    <Text style={SC.stepTitle}>{step.title}</Text>
                    <Text style={SC.stepDesc}>{step.description}</Text>
                    <View style={SC.stepFooter}>
                      <View style={SC.stepDuration}>
                        <Ionicons name="time-outline" size={12} color="#6366f1" />
                        <Text style={SC.stepDurationText}>{step.durationMonths} months</Text>
                      </View>
                      {step.resources?.slice(0, 2).map((r) => (
                        <View key={r} style={SC.stepResource}>
                          <Text style={SC.stepResourceText} numberOfLines={1}>{r}</Text>
                        </View>
                      ))}
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* ── 6. College Suggestions ────────────────────────────── */}
        {result.collegeSuggestions?.length > 0 && (
          <Section title="College Suggestions" emoji="🏫">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={SC.hScroll}>
              {result.collegeSuggestions.map((c, i) => (
                <LinearGradient
                  key={i}
                  colors={["#1e293b", "#0f172a"]}
                  style={SC.collegeCard}
                >
                  <View style={[SC.typeBadge, { backgroundColor: collegeBadgeColor(c.type) }]}>
                    <Text style={SC.typeBadgeText}>{c.type}</Text>
                  </View>
                  <Text style={SC.collegeName} numberOfLines={2}>{c.name}</Text>
                  <Text style={SC.collegeLocation}>📍 {c.location}</Text>
                  <Text style={SC.collegeCourse} numberOfLines={1}>{c.course}</Text>
                  <View style={SC.collegeFooter}>
                    <Text style={SC.collegeExam}>{c.entranceExam}</Text>
                    <Text style={SC.collegeFee}>{c.approxFeePerYear}</Text>
                  </View>
                </LinearGradient>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* ── 7. Scholarship Suggestions ───────────────────────── */}
        {result.scholarshipSuggestions?.length > 0 && (
          <Section title="Scholarships" emoji="🎓">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={SC.hScroll}>
              {result.scholarshipSuggestions.map((s, i) => (
                <LinearGradient
                  key={i}
                  colors={["#1e293b", "#0f172a"]}
                  style={SC.scholarshipCard}
                >
                  <Text style={SC.scholarshipAmount}>{s.amount}</Text>
                  <Text style={SC.scholarshipName} numberOfLines={2}>{s.name}</Text>
                  <Text style={SC.scholarshipElig} numberOfLines={2}>{s.eligibility}</Text>
                  {s.lastDate && (
                    <Text style={SC.scholarshipDate}>📅 {s.lastDate}</Text>
                  )}
                  {s.applyUrl ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(s.applyUrl!).catch(() => {})}
                      style={SC.applyBtn}
                    >
                      <Text style={SC.applyBtnText}>Apply →</Text>
                    </TouchableOpacity>
                  ) : null}
                </LinearGradient>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* ── 8. AI Mentor Advice ──────────────────────────────── */}
        {result.mentorAdvice && (
          <Section title="AI Mentor Advice" emoji="🧑‍🏫">
            <LinearGradient colors={["#1a0a2e", "#4a1259"]} style={SC.mentorCard}>
              <Text style={SC.quoteDecor}>"</Text>
              <Text style={SC.mentorText}>{result.mentorAdvice}</Text>
              <Text style={SC.quoteDecorClose}>"</Text>
            </LinearGradient>
          </Section>
        )}

        {/* ── 9. Future Demand Meter ────────────────────────────── */}
        <Section title="Future Demand" emoji="📈">
          <LinearGradient colors={["#1e293b", "#0f172a"]} style={SC.card}>
            <DemandMeter score={result.futureDemandScore} anim={demandAnim} />
          </LinearGradient>
        </Section>

        {/* ── 10. Next Action Steps ────────────────────────────── */}
        {result.nextActionSteps?.length > 0 && (
          <Section title="Next Action Steps" emoji="🚀">
            <View style={SC.stepsWrap}>
              {result.nextActionSteps.map((step, i) => (
                <LinearGradient
                  key={i}
                  colors={["rgba(99,102,241,0.12)", "rgba(139,92,246,0.08)"]}
                  style={SC.actionStep}
                >
                  <LinearGradient colors={["#6366f1", "#8b5cf6"]} style={SC.actionStepNum}>
                    <Text style={SC.actionStepNumText}>{i + 1}</Text>
                  </LinearGradient>
                  <Text style={SC.actionStepText}>{step}</Text>
                </LinearGradient>
              ))}
            </View>
          </Section>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating save button */}
      <TouchableOpacity onPress={toggleSave} style={RS.saveBtn} activeOpacity={0.85}>
        <LinearGradient
          colors={saved ? ["#10b981", "#059669"] : ["#6366f1", "#8b5cf6"]}
          style={RS.saveBtnInner}
        >
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).slice(0, 16).padStart(16, "0");
}

function collegeBadgeColor(type: string): string {
  const map: Record<string, string> = {
    IIT: "#854d0e", NIT: "#1e3a5f", Central: "#1a4731",
    State: "#064e3b", Private: "#4c1d95", Deemed: "#1e293b",
  };
  return map[type] ?? "#1e293b";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RS = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#030712" },
  topBar:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  backBtn:      { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topQuery:     { flex: 1, color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" },
  scroll:       { paddingHorizontal: 16, paddingTop: 4 },

  errorWrap:    { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  paywallCard:  { borderRadius: 20, padding: 28, alignItems: "center", width: "100%" },
  paywallEmoji: { fontSize: 52, marginBottom: 12 },
  paywallTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 8 },
  paywallSub:   { color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", marginBottom: 20 },
  paywallBtn:   { width: "100%", borderRadius: 14, overflow: "hidden" },
  paywallBtnInner: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  paywallBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  errorCard:    { alignItems: "center", padding: 24 },
  errorEmoji:   { fontSize: 48, marginBottom: 12 },
  errorTitle:   { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  errorSub:     { color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", marginBottom: 20 },
  retryBtn:     { paddingVertical: 12, paddingHorizontal: 28, backgroundColor: "rgba(99,102,241,0.25)", borderRadius: 12 },
  retryText:    { color: "#a5b4fc", fontSize: 14, fontWeight: "700" },

  saveBtn:      { position: "absolute", bottom: 28, right: 20, borderRadius: 30, elevation: 10, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
  saveBtnInner: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
});

const SC = StyleSheet.create({
  // Summary
  summaryCard:    { borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)" },
  summaryBadge:   { backgroundColor: "rgba(99,102,241,0.25)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)" },
  summaryBadgeText: { color: "#a5b4fc", fontSize: 11, fontWeight: "700" },
  summaryText:    { color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 24, fontWeight: "500" },

  // Section wrapper
  section:        { marginBottom: 20 },
  sectionHeader:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionEmoji:   { fontSize: 18 },
  sectionTitle:   { color: "#fff", fontSize: 17, fontWeight: "800" },

  // Generic card
  card:           { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.15)" },

  // Career scope
  careerCard:     { borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)" },
  careerHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  careerEmoji:    { fontSize: 40 },
  careerTitle:    { color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 6 },
  domainBadge:    { backgroundColor: "rgba(99,102,241,0.2)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  domainBadgeText: { color: "#a5b4fc", fontSize: 11, fontWeight: "700" },
  demandBadge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  demandBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  careerDesc:     { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 22 },

  // Salary bars
  barsContainer:  { gap: 12 },
  barRow:         { gap: 6 },
  barRole:        { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  barTrack:       { height: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" },
  barFill:        { height: 10, borderRadius: 5 },
  barValue:       { color: "#a5b4fc", fontSize: 11, fontWeight: "700", marginTop: 2 },

  // Skills
  skillCatBlock:  { marginBottom: 14 },
  skillCatLabel:  { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" },
  skillChips:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  skillChipMust:  { backgroundColor: "rgba(99,102,241,0.25)", borderColor: "rgba(99,102,241,0.5)" },
  skillChipGood:  { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.2)" },
  skillChipText:  { fontSize: 12, fontWeight: "700" },
  skillChipTextMust: { color: "#a5b4fc" },
  skillChipTextGood: { color: "rgba(255,255,255,0.55)" },

  // Learning path stepper
  stepperWrap:    { gap: 0 },
  stepRow:        { flexDirection: "row", gap: 12, marginBottom: 0 },
  stepLeft:       { alignItems: "center", width: 36 },
  stepCircle:     { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", zIndex: 1 },
  stepNum:        { color: "#fff", fontSize: 14, fontWeight: "900" },
  stepLine:       { width: 2, flex: 1, backgroundColor: "rgba(99,102,241,0.3)", minHeight: 16, marginVertical: 4 },
  stepContent:    { flex: 1, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "rgba(99,102,241,0.15)" },
  stepTitle:      { color: "#fff", fontSize: 14, fontWeight: "800", marginBottom: 6 },
  stepDesc:       { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 20, marginBottom: 10 },
  stepFooter:     { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stepDuration:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(99,102,241,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  stepDurationText: { color: "#6366f1", fontSize: 11, fontWeight: "700" },
  stepResource:   { backgroundColor: "rgba(255,255,255,0.07)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  stepResourceText: { color: "rgba(255,255,255,0.55)", fontSize: 11 },

  // Horizontal scroll
  hScroll:        { paddingLeft: 0, paddingRight: 16, gap: 12 },

  // College cards
  collegeCard:    { width: 180, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.15)" },
  typeBadge:      { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  typeBadgeText:  { color: "#fff", fontSize: 10, fontWeight: "800" },
  collegeName:    { color: "#fff", fontSize: 13, fontWeight: "800", marginBottom: 4 },
  collegeLocation: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 },
  collegeCourse:  { color: "#a5b4fc", fontSize: 11, fontWeight: "600", marginBottom: 8 },
  collegeFooter:  { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 },
  collegeExam:    { color: "rgba(255,255,255,0.5)", fontSize: 10 },
  collegeFee:     { color: "#4ade80", fontSize: 10, fontWeight: "700" },

  // Scholarship cards
  scholarshipCard: { width: 200, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.15)" },
  scholarshipAmount: { color: "#4ade80", fontSize: 18, fontWeight: "900", marginBottom: 6 },
  scholarshipName: { color: "#fff", fontSize: 13, fontWeight: "800", marginBottom: 6 },
  scholarshipElig: { color: "rgba(255,255,255,0.55)", fontSize: 11, lineHeight: 16, marginBottom: 6 },
  scholarshipDate: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 8 },
  applyBtn:       { backgroundColor: "rgba(99,102,241,0.25)", paddingVertical: 7, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(99,102,241,0.4)" },
  applyBtnText:   { color: "#a5b4fc", fontSize: 12, fontWeight: "800" },

  // Mentor advice
  mentorCard:     { borderRadius: 16, padding: 22, borderWidth: 1, borderColor: "rgba(139,92,246,0.3)", position: "relative" },
  quoteDecor:     { color: "rgba(168,85,247,0.4)", fontSize: 72, lineHeight: 60, fontWeight: "900", marginBottom: -20 },
  quoteDecorClose: { color: "rgba(168,85,247,0.4)", fontSize: 72, lineHeight: 40, fontWeight: "900", textAlign: "right", marginTop: -20 },
  mentorText:     { color: "rgba(255,255,255,0.88)", fontSize: 15, lineHeight: 26, fontStyle: "italic", fontWeight: "500", zIndex: 1 },

  // Demand meter
  meterWrap:      { gap: 10 },
  meterTrack:     { height: 14, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 7, overflow: "hidden" },
  meterFill:      { height: 14, borderRadius: 7 },
  meterLabelRow:  { flexDirection: "row", justifyContent: "space-between" },
  meterLabel:     { fontSize: 13, fontWeight: "700" },
  meterScore:     { fontSize: 13, fontWeight: "900" },

  // Action steps
  stepsWrap:      { gap: 10 },
  actionStep:     { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)" },
  actionStepNum:  { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  actionStepNumText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  actionStepText: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 22, flex: 1, fontWeight: "500" },
});
