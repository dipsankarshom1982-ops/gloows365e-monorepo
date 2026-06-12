import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

let RazorpayCheckout: {
  open: (opts: Record<string, unknown>) => Promise<{
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RazorpayCheckout = require("react-native-razorpay").default;
} catch { /* not installed in Expo Go */ }

// ─── Plan config ──────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "free",
    name: "Free",
    emoji: "🎓",
    price: "₹0",
    period: "",
    gradient: ["#1e293b", "#334155"] as [string, string],
    highlight: false,
    features: [
      "3 AI searches per day",
      "Basic career information",
      "College suggestions",
      "Salary insights",
    ],
    locked: [
      "AI Mentor Advice",
      "Scholarship discovery",
      "Career roadmap",
      "Unlimited searches",
    ],
  },
  {
    id: "discover_monthly",
    name: "Premium",
    emoji: "⭐",
    price: "₹199",
    period: "/month",
    gradient: ["#312e81", "#6366f1"] as [string, string],
    highlight: true,
    badge: "Most Popular",
    features: [
      "Unlimited AI searches",
      "Full career analysis",
      "Scholarship discovery",
      "AI Mentor Advice",
      "Complete learning roadmap",
      "College & entrance exam guidance",
    ],
    locked: [],
  },
  {
    id: "discover_yearly",
    name: "Premium Yearly",
    emoji: "🏆",
    price: "₹999",
    period: "/year",
    gradient: ["#4c1d95", "#7c3aed"] as [string, string],
    highlight: false,
    savingsBadge: "Save 58%",
    features: [
      "Everything in Premium",
      "Parent progress reports",
      "Advanced AI career counselling",
      "Priority AI responses",
      "Early access to new features",
    ],
    locked: [],
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverSubscriptionScreen() {
  const { user } = useStudentProfile();
  const { colors } = useTheme();
  const [selectedPlanId, setSelectedPlanId] = useState("discover_monthly");
  const [loading, setLoading] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleSubscribe = async () => {
    if (selectedPlanId === "free") {
      router.back();
      return;
    }
    if (!user) {
      Alert.alert("Please log in first");
      return;
    }
    if (!RazorpayCheckout) {
      Alert.alert(
        "Payment",
        "Razorpay requires a development build. Contact support to upgrade.",
        [{ text: "OK" }]
      );
      return;
    }

    setLoading(true);
    try {
      const functions = getFunctions();
      const createSub = httpsCallable<
        { plan: string; cycle: string },
        { orderId: string; amount: number; currency: string; keyId: string }
      >(functions, "seekhoCreateSubscription");

      const cycle = selectedPlanId === "discover_yearly" ? "annual" : "monthly";
      const { data } = await createSub({ plan: selectedPlanId, cycle });

      const paymentData = await RazorpayCheckout.open({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Vidya Discover AI",
        description: selectedPlanId === "discover_yearly" ? "Premium Yearly Plan" : "Premium Monthly Plan",
        order_id: data.orderId,
        prefill: { email: user.user?.email ?? "" },
        theme: { color: "#6366f1" },
      });

      if (paymentData.razorpay_payment_id) {
        Alert.alert(
          "Subscription Activated! 🎉",
          "You now have unlimited AI discovery searches. Explore your future!",
          [{ text: "Start Exploring", onPress: () => router.replace("/discover") }]
        );
      }
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED") {
        Alert.alert("Payment failed", err?.message ?? "Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.container}>
      <LinearGradient colors={["#030712", "#1e1b4b", "#030712"]} style={S.bg}>
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Animated.Text style={[S.headerTitle, { transform: [{ scale: pulseAnim }] }]}>
            🧭 Unlock Discover AI
          </Animated.Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Glow subtitle */}
        <View style={S.subtitleWrap}>
          <Animated.View style={[S.glowDot, { opacity: glowAnim }]} />
          <Text style={S.subtitle}>Your personal AI career & education mentor</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
          {/* Plans */}
          {PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelectedPlanId(plan.id)}
                activeOpacity={0.85}
                style={[S.planWrap, isSelected && S.planWrapSelected]}
              >
                <LinearGradient
                  colors={plan.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[S.planCard, isSelected && S.planCardSelected]}
                >
                  {/* Badges */}
                  <View style={S.planBadgeRow}>
                    {plan.highlight && (
                      <View style={S.popularBadge}>
                        <Text style={S.popularBadgeText}>⭐ Most Popular</Text>
                      </View>
                    )}
                    {plan.savingsBadge && (
                      <View style={S.savingsBadge}>
                        <Text style={S.savingsBadgeText}>{plan.savingsBadge}</Text>
                      </View>
                    )}
                  </View>

                  {/* Plan header */}
                  <View style={S.planHeader}>
                    <Text style={S.planEmoji}>{plan.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={S.planName}>{plan.name}</Text>
                      <View style={S.priceRow}>
                        <Text style={S.planPrice}>{plan.price}</Text>
                        <Text style={S.planPeriod}>{plan.period}</Text>
                      </View>
                    </View>
                    <View style={[S.radioCircle, isSelected && S.radioCircleSelected]}>
                      {isSelected && <View style={S.radioDot} />}
                    </View>
                  </View>

                  {/* Features */}
                  <View style={S.featureList}>
                    {plan.features.map((f) => (
                      <View key={f} style={S.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                        <Text style={S.featureText}>{f}</Text>
                      </View>
                    ))}
                    {plan.locked.map((f) => (
                      <View key={f} style={S.featureRow}>
                        <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.3)" />
                        <Text style={[S.featureText, S.lockedText]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}

          {/* CTA */}
          <TouchableOpacity
            onPress={handleSubscribe}
            activeOpacity={0.85}
            disabled={loading}
            style={S.ctaWrap}
          >
            <LinearGradient
              colors={["#6366f1", "#8b5cf6", "#a855f7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={S.ctaBtn}
            >
              <Text style={S.ctaText}>
                {loading
                  ? "Processing..."
                  : selectedPlanId === "free"
                  ? "Continue with Free"
                  : "Unlock Premium Access"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Reassurance */}
          <Text style={S.reassurance}>
            Secure payment · Cancel anytime · Instant activation
          </Text>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#030712" },
  bg:               { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn:          { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle:      { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 0.3 },
  subtitleWrap:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 16 },
  glowDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6366f1" },
  subtitle:         { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "500" },

  scroll:           { paddingHorizontal: 16, paddingBottom: 40 },

  planWrap:         { marginBottom: 14, borderRadius: 20, borderWidth: 1.5, borderColor: "transparent" },
  planWrapSelected: { borderColor: "#6366f1" },
  planCard:         { borderRadius: 18, padding: 18, overflow: "hidden" },
  planCardSelected: {},

  planBadgeRow:     { flexDirection: "row", gap: 8, marginBottom: 12 },
  popularBadge:     { backgroundColor: "rgba(99,102,241,0.3)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(99,102,241,0.5)" },
  popularBadgeText: { color: "#a5b4fc", fontSize: 11, fontWeight: "700" },
  savingsBadge:     { backgroundColor: "rgba(16,185,129,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(16,185,129,0.4)" },
  savingsBadgeText: { color: "#4ade80", fontSize: 11, fontWeight: "700" },

  planHeader:       { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  planEmoji:        { fontSize: 36 },
  planName:         { color: "#fff", fontSize: 18, fontWeight: "800" },
  priceRow:         { flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 2 },
  planPrice:        { color: "#fff", fontSize: 26, fontWeight: "900" },
  planPeriod:       { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "500" },

  radioCircle:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)", justifyContent: "center", alignItems: "center" },
  radioCircleSelected: { borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.2)" },
  radioDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: "#6366f1" },

  featureList:      { gap: 10 },
  featureRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText:      { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "500", flex: 1 },
  lockedText:       { color: "rgba(255,255,255,0.3)", textDecorationLine: "line-through" },

  ctaWrap:          { marginTop: 24, marginBottom: 12, borderRadius: 16, elevation: 8, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12 },
  ctaBtn:           { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  ctaText:          { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.4 },

  reassurance:      { textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: "500", marginBottom: 8 },
});
