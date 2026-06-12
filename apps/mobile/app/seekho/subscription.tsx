import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { PLAN_CONFIG, RAZORPAY_KEY_ID } from "@/lib/seekho/constants";
import { useSeekhoAccess } from "@/hooks/useSeekhoAccess";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Graceful Razorpay import — requires npx expo install react-native-razorpay + Dev Client
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
} catch {
  // Not installed
}

type Plan = "plus" | "pro";
type Cycle = "monthly" | "annual";

const FREE_FEATURES = [
  "First chapter of each subject",
  "First lesson of every chapter",
  "Limited practice questions",
];

export default function SeekhoSubscriptionScreen() {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const { forClass } = useLocalSearchParams<{ forClass?: string }>();
  const { subscription, isPro, isPlus, reload } = useSeekhoAccess();

  const [selectedPlan, setSelectedPlan] = useState<Plan>("plus");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [loading, setLoading] = useState(false);

  const defaultClass = forClass ? Number(forClass) : 10;
  const plan = PLAN_CONFIG[selectedPlan];
  const amount = cycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;

  const isCurrentPlan = (p: Plan) =>
    (p === "plus" && isPlus) || (p === "pro" && isPro);

  const handleSubscribe = async () => {
    if (!user) {
      Alert.alert("Login Required", "Please log in to subscribe.");
      return;
    }
    if (!RazorpayCheckout) {
      Alert.alert(
        "Payments Unavailable",
        "Please build a dev client to enable Razorpay payments.\n\nRun: npx expo install react-native-razorpay"
      );
      return;
    }
    if (!RAZORPAY_KEY_ID) {
      Alert.alert("Configuration Error", "EXPO_PUBLIC_RAZORPAY_KEY_ID not set in .env");
      return;
    }

    setLoading(true);
    try {
      const fns = getFunctions();

      // Step 1: Create Razorpay order via cloud function
      const createOrder = httpsCallable<
        { plan: Plan; selectedClass: number; billingCycle: Cycle; amountPaise: number },
        { razorpayOrderId: string }
      >(fns, "seekhoCreateSubscription");

      const orderRes = await createOrder({
        plan: selectedPlan,
        selectedClass: defaultClass,
        billingCycle: cycle,
        amountPaise: amount * 100,
      });

      // Step 2: Open Razorpay checkout
      const result = await RazorpayCheckout.open({
        key: RAZORPAY_KEY_ID,
        order_id: orderRes.data.razorpayOrderId,
        amount: amount * 100,
        currency: "INR",
        name: "GLOOWS365E",
        description: `${plan.name} · ${cycle === "monthly" ? "Monthly" : "Annual"}`,
        prefill: { email: user.email ?? "" },
        theme: { color: "#6366f1" },
      });

      // Step 3: Verify payment and write subscription
      const verify = httpsCallable<
        {
          razorpayPaymentId: string;
          razorpayOrderId: string;
          razorpaySignature: string;
          plan: Plan;
          selectedClass: number;
        },
        { success: boolean }
      >(fns, "seekhoCreateSubscription");

      await verify({
        razorpayPaymentId: result.razorpay_payment_id,
        razorpayOrderId: result.razorpay_order_id,
        razorpaySignature: result.razorpay_signature,
        plan: selectedPlan,
        selectedClass: defaultClass,
      });

      await reload();
      Alert.alert("Subscribed! 🎉", `You now have ${plan.name} access.`, [
        { text: "Start Learning", onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed.";
      if (!msg.toLowerCase().includes("cancel")) {
        Alert.alert("Payment Failed", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>Choose a Plan</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        {/* Hero */}
        <LinearGradient colors={["#1e1b4b", "#4f46e5"]} style={S.hero}>
          <Text style={S.heroEmoji}>📚</Text>
          <Text style={S.heroTitle}>Unlock Full Curriculum</Text>
          <Text style={S.heroSub}>
            Class 6–12 · CBSE / ICSE / State · All subjects
          </Text>
        </LinearGradient>

        {/* Billing toggle */}
        <View style={[S.toggle, { backgroundColor: colors.card }]}>
          {(["monthly", "annual"] as Cycle[]).map((c) => (
            <TouchableOpacity
              key={c}
              style={[S.toggleBtn, cycle === c && { backgroundColor: "#4f46e5" }]}
              onPress={() => setCycle(c)}
            >
              <Text style={[S.toggleText, { color: cycle === c ? "#fff" : colors.textSecondary }]}>
                {c === "monthly" ? "Monthly" : "Annual  · Save 40%"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Free plan */}
        <View style={[S.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={S.planHeader}>
            <Text style={S.planEmoji}>🎁</Text>
            <Text style={[S.planName, { color: colors.text }]}>Free</Text>
            <View style={S.planPriceWrap}>
              <Text style={[S.planPrice, { color: colors.text }]}>₹0</Text>
              <Text style={[S.planPriceSub, { color: colors.textSecondary }]}>/forever</Text>
            </View>
          </View>
          {FREE_FEATURES.map((f) => (
            <View key={f} style={S.featureRow}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={[S.featureText, { color: colors.textSecondary }]}>{f}</Text>
            </View>
          ))}
          {!isPro && !isPlus && (
            <View style={[S.currentBadge, { backgroundColor: colors.border }]}>
              <Text style={[S.currentBadgeText, { color: colors.textSecondary }]}>Current Plan</Text>
            </View>
          )}
        </View>

        {/* Paid plans */}
        {(["plus", "pro"] as Plan[]).map((p) => {
          const cfg = PLAN_CONFIG[p];
          const isActive = selectedPlan === p;
          const isCurrent = isCurrentPlan(p);
          const price = cycle === "monthly" ? cfg.monthlyPrice : cfg.annualMonthly;

          return (
            <TouchableOpacity
              key={p}
              onPress={() => setSelectedPlan(p)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={isActive ? cfg.gradient : ["#1e293b", "#1e293b"]}
                style={[S.planCard, isActive && S.planCardSelected]}
              >
                <View style={S.planHeader}>
                  <Text style={S.planEmoji}>{cfg.emoji}</Text>
                  <Text style={S.planNameWhite}>{cfg.name}</Text>
                  {isActive && (
                    <View style={S.selectedCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                  <View style={S.planPriceWrap}>
                    <Text style={S.planPriceWhite}>₹{price}</Text>
                    <Text style={S.planPriceSubWhite}>/mo</Text>
                  </View>
                </View>

                {cfg.features.map((f) => (
                  <View key={f} style={S.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                    <Text style={S.featureTextWhite}>{f}</Text>
                  </View>
                ))}

                {isCurrent && (
                  <View style={[S.currentBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                      ✓ Current Plan
                      {subscription?.expiresAt
                        ? ` · expires soon`
                        : ""}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        {/* Subscribe CTA */}
        {!isPro && !isPlus ? (
          <TouchableOpacity
            style={[S.subscribeBtn, loading && { opacity: 0.65 }]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            <LinearGradient
              colors={["#4f46e5", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={S.subscribeBtnInner}
            >
              <Text style={S.subscribeBtnText}>
                {loading
                  ? "Processing…"
                  : `Subscribe · ₹${amount}/${cycle === "monthly" ? "month" : "year"}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={[S.manageWrap, { backgroundColor: colors.card }]}>
            <Ionicons name="shield-checkmark" size={20} color="#10b981" />
            <Text style={[S.manageText, { color: colors.text }]}>
              {isPro ? "Seekho Pro" : "Seekho Plus"} · Active
            </Text>
          </View>
        )}

        <Text style={[S.disclaimer, { color: colors.textSecondary }]}>
          Cancel anytime · Prices in INR, inclusive of taxes · Billed in India
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  scroll: { paddingBottom: 40 },

  hero: { padding: 24, alignItems: "center", gap: 6 },
  heroEmoji: { fontSize: 40, marginBottom: 4 },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" },
  heroSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "500", textAlign: "center" },

  toggle: {
    flexDirection: "row",
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleText: { fontSize: 12, fontWeight: "700" },

  planCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  planCardSelected: { borderColor: "#6366f1" },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  planEmoji: { fontSize: 22 },
  planName: { flex: 1, fontSize: 16, fontWeight: "800" },
  planNameWhite: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "800" },
  planPriceWrap: { alignItems: "flex-end" },
  planPrice: { fontSize: 22, fontWeight: "900" },
  planPriceSub: { fontSize: 10 },
  planPriceWhite: { color: "#fff", fontSize: 22, fontWeight: "900" },
  planPriceSubWhite: { color: "rgba(255,255,255,0.65)", fontSize: 10 },
  selectedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  featureText: { fontSize: 12, fontWeight: "500" },
  featureTextWhite: { color: "#e2e8f0", fontSize: 12, fontWeight: "500" },
  currentBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  currentBadgeText: { fontSize: 11, fontWeight: "700" },

  subscribeBtn: { marginHorizontal: 16, borderRadius: 16, overflow: "hidden", marginTop: 8 },
  subscribeBtnInner: { paddingVertical: 16, alignItems: "center" },
  subscribeBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  manageWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
  },
  manageText: { fontSize: 14, fontWeight: "700" },

  disclaimer: { fontSize: 11, textAlign: "center", marginTop: 16, paddingHorizontal: 24 },
});
