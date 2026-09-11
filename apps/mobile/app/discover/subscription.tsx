import { useAppConfig } from "@/context/AppConfigContext";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/lib/firebase";
import { RAZORPAY_KEY_ID } from "@/lib/seekho/constants";
import { isSubscribed } from "@/services/aiGuruFirestore";
import { useStudentProfile } from "@gloows/shared-logic";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

type Cycle = "monthly" | "annual";

// ─── Screen ───────────────────────────────────────────────────────────────────
// FIX (bug report — "Discover Premium purchase does nothing"): this screen
// used to call seekhoCreateSubscription with a hardcoded local plan list
// (discover_monthly/discover_yearly) that don't even match that function's
// "plus"/"pro" plan taxonomy — and worse, seekhoCreateSubscription writes
// to seekho_subscriptions/{uid}, a collection Discover's own paywall check
// (functions/src/usageCheck.ts's getSubscription) never reads. Even a
// "successful" purchase through the old flow could never have unlocked
// anything, and it never called a verify step at all — checkout success
// just showed an alert with no subscriptions/{uid} write.
//
// Fixed to match app/ai-guru/subscription.tsx's real, working flow:
// aiGuruCreateSubscription/aiGuruPaymentSuccess actually write
// subscriptions/{uid} (module-agnostic — getSubscription/isSubscribed
// don't care which module a plan belongs to), driven by real
// subscriptionPlans/{id} docs with module:"discover" (already a supported
// option in apps/admin/src/pages/SubscriptionPlans.tsx — just never had a
// working purchase screen pointed at it).
export default function DiscoverSubscriptionScreen() {
  const { user } = useStudentProfile();
  const { colors } = useTheme();
  const { plans, configLoading } = useAppConfig();

  const [cycle, setCycle]             = useState<Cycle>("monthly");
  const [selectedPlanId, setSelected] = useState<string>("free");
  const [loading, setLoading]         = useState(false);
  const [subscribed, setSubscribed]   = useState(false);
  const [checkingStatus, setChecking] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0.6)).current;

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

  // Discover-specific plans only — driven entirely from Firestore, same
  // pattern app/ai-guru/subscription.tsx uses for module:"aiGuru".
  const discoverPlans = plans.filter((p) => p.module === "discover" && p.id !== "discover_free");

  useEffect(() => {
    if (discoverPlans.length > 0 && selectedPlanId === "free") {
      const highlighted = discoverPlans.find((p) => p.highlight);
      setSelected(highlighted?.id ?? discoverPlans[0].id);
    }
  }, [discoverPlans.length]);

  useFocusEffect(
    useCallback(() => {
      const uid = auth.currentUser?.uid;
      if (!uid) { setChecking(false); return; }
      isSubscribed(uid).then((sub) => {
        setSubscribed(sub);
        setChecking(false);
      });
    }, [])
  );

  const selectedPlan = discoverPlans.find((p) => p.id === selectedPlanId);
  const isFreeSelected = selectedPlanId === "free" || !selectedPlan;
  const displayTotal = selectedPlan
    ? cycle === "monthly" ? selectedPlan.monthlyPrice : selectedPlan.annualPrice
    : 0;
  const savingsPct = selectedPlan && selectedPlan.monthlyPrice > 0
    ? Math.round((1 - selectedPlan.annualMonthly / selectedPlan.monthlyPrice) * 100)
    : 0;

  const handleSubscribe = async () => {
    if (isFreeSelected) {
      router.back();
      return;
    }
    if (!auth.currentUser) {
      Alert.alert("Login Required", "Please log out and log in again.");
      return;
    }
    if (!RazorpayCheckout) {
      Alert.alert(
        "Payment",
        "Payment requires a development build.\n\nRun: npx expo run:android",
        [{ text: "OK" }]
      );
      return;
    }
    if (!RAZORPAY_KEY_ID) {
      Alert.alert("Configuration Error", "Razorpay key not configured. Add EXPO_PUBLIC_RAZORPAY_KEY_ID to .env");
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      await currentUser.getIdToken(true); // force refresh so context.auth is populated

      const functions = getFunctions();
      const createOrder = httpsCallable<
        { planId: string; cycle: Cycle },
        { razorpayOrderId: string }
      >(functions, "aiGuruCreateSubscription");

      const orderRes = await createOrder({ planId: selectedPlanId, cycle });
      const orderId  = orderRes.data.razorpayOrderId;

      const paymentData = await RazorpayCheckout.open({
        key: RAZORPAY_KEY_ID,
        order_id: orderId,
        currency: "INR",
        name: "GLOOWS365E",
        description: `${selectedPlan?.name ?? "Discover"} · ${cycle === "monthly" ? "Monthly" : "Annual"}`,
        prefill: { email: currentUser.email ?? "" },
        theme: { color: "#6366f1" },
      });

      // Verify + activate — the step the old flow never had.
      const cfBase = process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL
        ?? "https://us-central1-gloows-03b6sz.cloudfunctions.net";
      await fetch(`${cfBase}/aiGuruPaymentSuccess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_order_id:   paymentData.razorpay_order_id,
          razorpay_signature:  paymentData.razorpay_signature,
        }),
      });

      setSubscribed(true);
      Alert.alert(
        "Subscription Activated! 🎉",
        "You now have unlimited AI discovery searches. Explore your future!",
        [{ text: "Start Exploring", onPress: () => router.replace("/discover") }]
      );
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED" && !String(err?.message ?? "").toLowerCase().includes("cancel")) {
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

        {checkingStatus || configLoading ? (
          <View style={S.loadingWrap}><ActivityIndicator color="#a5b4fc" /></View>
        ) : subscribed ? (
          <View style={S.loadingWrap}>
            <Ionicons name="checkmark-circle" size={48} color="#4ade80" />
            <Text style={S.alreadySubText}>You already have Premium access.</Text>
            <TouchableOpacity onPress={() => router.back()} style={S.ctaWrap}>
              <LinearGradient colors={["#6366f1", "#8b5cf6", "#a855f7"]} style={S.ctaBtn}>
                <Text style={S.ctaText}>Back to Discover</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
          {/* Cycle toggle — only matters once a paid plan is selected */}
          {discoverPlans.length > 0 && (
            <View style={S.cycleToggle}>
              {(["monthly", "annual"] as Cycle[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCycle(c)}
                  style={[S.cyclePill, cycle === c && S.cyclePillActive]}
                >
                  <Text style={[S.cyclePillText, cycle === c && S.cyclePillTextActive]}>
                    {c === "monthly" ? "Monthly" : "Annual"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Free */}
          <TouchableOpacity
            onPress={() => setSelected("free")}
            activeOpacity={0.85}
            style={[S.planWrap, selectedPlanId === "free" && S.planWrapSelected]}
          >
            <LinearGradient colors={["#1e293b", "#334155"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.planCard}>
              <View style={S.planHeader}>
                <Text style={S.planEmoji}>🎓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.planName}>Free</Text>
                  <View style={S.priceRow}>
                    <Text style={S.planPrice}>₹0</Text>
                  </View>
                </View>
                <View style={[S.radioCircle, selectedPlanId === "free" && S.radioCircleSelected]}>
                  {selectedPlanId === "free" && <View style={S.radioDot} />}
                </View>
              </View>
              <View style={S.featureList}>
                {["3 AI searches per day", "Basic career information", "College suggestions", "Salary insights"].map((f) => (
                  <View key={f} style={S.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                    <Text style={S.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Real, Firestore-driven paid plans */}
          {discoverPlans.length === 0 ? (
            <Text style={S.reassurance}>Premium plans aren't configured yet — check back soon.</Text>
          ) : discoverPlans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            const price = cycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
            const monthlyEquiv = cycle === "annual" ? plan.annualMonthly : plan.monthlyPrice;
            const planSavings = plan.monthlyPrice > 0
              ? Math.round((1 - plan.annualMonthly / plan.monthlyPrice) * 100)
              : 0;
            return (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelected(plan.id)}
                activeOpacity={0.85}
                style={[S.planWrap, isSelected && S.planWrapSelected]}
              >
                <LinearGradient
                  colors={plan.gradient ?? ["#312e81", "#6366f1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={S.planCard}
                >
                  <View style={S.planBadgeRow}>
                    {plan.highlight && (
                      <View style={S.popularBadge}><Text style={S.popularBadgeText}>⭐ Most Popular</Text></View>
                    )}
                    {cycle === "annual" && planSavings > 0 && (
                      <View style={S.savingsBadge}><Text style={S.savingsBadgeText}>Save {planSavings}%</Text></View>
                    )}
                  </View>
                  <View style={S.planHeader}>
                    <Text style={S.planEmoji}>{plan.emoji ?? "⭐"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={S.planName}>{plan.name}</Text>
                      <View style={S.priceRow}>
                        <Text style={S.planPrice}>₹{price}</Text>
                        <Text style={S.planPeriod}>/{cycle === "monthly" ? "month" : "year"}</Text>
                      </View>
                      {cycle === "annual" && (
                        <Text style={S.planSubPrice}>≈ ₹{monthlyEquiv}/month</Text>
                      )}
                    </View>
                    <View style={[S.radioCircle, isSelected && S.radioCircleSelected]}>
                      {isSelected && <View style={S.radioDot} />}
                    </View>
                  </View>
                  <View style={S.featureList}>
                    {(plan.features ?? []).map((f) => (
                      <View key={f} style={S.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                        <Text style={S.featureText}>{f}</Text>
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
                  : isFreeSelected
                  ? "Continue with Free"
                  : "Unlock Premium Access"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={S.reassurance}>
            Secure payment · Cancel anytime · Instant activation
          </Text>
        </ScrollView>
        )}
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

  loadingWrap:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  alreadySubText:   { color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center" },

  scroll:           { paddingHorizontal: 16, paddingBottom: 40 },

  cycleToggle:      { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 4, marginBottom: 16 },
  cyclePill:        { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  cyclePillActive:  { backgroundColor: "#6366f1" },
  cyclePillText:    { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "700" },
  cyclePillTextActive: { color: "#fff" },

  planWrap:         { marginBottom: 14, borderRadius: 20, borderWidth: 1.5, borderColor: "transparent" },
  planWrapSelected: { borderColor: "#6366f1" },
  planCard:         { borderRadius: 18, padding: 18, overflow: "hidden" },

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
  planSubPrice:     { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "500", marginTop: 2 },

  radioCircle:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)", justifyContent: "center", alignItems: "center" },
  radioCircleSelected: { borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.2)" },
  radioDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: "#6366f1" },

  featureList:      { gap: 10 },
  featureRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText:      { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "500", flex: 1 },

  ctaWrap:          { marginTop: 24, marginBottom: 12, borderRadius: 16, elevation: 8, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12 },
  ctaBtn:           { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  ctaText:          { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.4 },

  reassurance:      { textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: "500", marginBottom: 8, marginTop: 8 },
});
