import { useTheme } from "@/context/ThemeContext";
import { RAZORPAY_KEY_ID } from "@/lib/seekho/constants";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { useAppConfig } from "@/context/AppConfigContext";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

// Graceful fallback if react-native-razorpay not installed
// To install: npx expo install react-native-razorpay (requires Expo Dev Client)
let RazorpayCheckout: {
  open: (options: Record<string, unknown>) => Promise<{
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RazorpayCheckout = require("react-native-razorpay").default;
} catch {
  // Not installed — payment UI will show dev note
}

interface Props {
  visible: boolean;
  onClose: () => void;
  defaultClass?: number;
  onSubscribed?: () => void;
}

type Cycle = "monthly" | "annual";

export default function SubscriptionBottomSheet({
  visible,
  onClose,
  defaultClass = 10,
  onSubscribed,
}: Props) {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const { plans } = useAppConfig();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("plus");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [loading, setLoading] = useState(false);

  // Use plans from Firestore; exclude free tier from the paywall sheet
  const paidPlans = plans.filter((p) => p.id !== "free");
  const plan = paidPlans.find((p) => p.id === selectedPlanId) ?? paidPlans[0];
  const amount = plan ? (cycle === "monthly" ? plan.monthlyPrice : plan.annualPrice) : 0;

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
      Alert.alert("Configuration Error", "Razorpay key not configured.");
      return;
    }

    if (!plan) return;
    setLoading(true);
    try {
      const fns = getFunctions();
      const createSubscription = httpsCallable<
        { plan: string; selectedClass: number; billingCycle: Cycle; amountPaise: number },
        { razorpayOrderId: string; amount: number }
      >(fns, "seekhoCreateSubscription");

      // Create order via Cloud Function (returns orderId)
      const orderResult = await createSubscription({
        plan: selectedPlanId,
        selectedClass: defaultClass,
        billingCycle: cycle,
        amountPaise: amount * 100,
      });

      const { razorpayOrderId } = orderResult.data;

      const result = await RazorpayCheckout.open({
        key: RAZORPAY_KEY_ID,
        order_id: razorpayOrderId,
        amount: amount * 100,
        currency: "INR",
        name: "GLOOWS365E",
        description: `${plan.name} — ${cycle === "monthly" ? "Monthly" : "Annual"}`,
        prefill: { email: user.email ?? "" },
        theme: { color: "#6366f1" },
      });

      // Verify payment via Cloud Function
      const verifyFn = httpsCallable<
        {
          razorpayPaymentId: string;
          razorpayOrderId: string;
          razorpaySignature: string;
          plan: string;
          selectedClass: number;
        },
        { success: boolean }
      >(fns, "seekhoCreateSubscription");

      await verifyFn({
        razorpayPaymentId: result.razorpay_payment_id,
        razorpayOrderId: result.razorpay_order_id,
        razorpaySignature: result.razorpay_signature,
        plan: selectedPlanId,
        selectedClass: defaultClass,
      });

      Alert.alert("Subscribed!", `Welcome to ${plan.name}! 🎉`);
      onSubscribed?.();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed. Please try again.";
      if (!msg.includes("cancel")) {
        Alert.alert("Payment Failed", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={S.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={[S.sheet, { backgroundColor: colors.card }]}>
        {/* Handle */}
        <View style={[S.handle, { backgroundColor: colors.border }]} />

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[S.heading, { color: colors.text }]}>Unlock Full Access</Text>

          {/* Billing toggle */}
          <View style={[S.toggle, { backgroundColor: colors.background }]}>
            {(["monthly", "annual"] as Cycle[]).map((c) => (
              <TouchableOpacity
                key={c}
                style={[S.toggleBtn, cycle === c && S.toggleActive]}
                onPress={() => setCycle(c)}
              >
                <Text style={[S.toggleText, { color: cycle === c ? "#fff" : colors.textSecondary }]}>
                  {c === "monthly" ? "Monthly" : "Annual · Save 40%"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Plan cards */}
          {paidPlans.map((cfg) => {
            const isSelected = selectedPlanId === cfg.id;
            const price = cycle === "monthly" ? cfg.monthlyPrice : cfg.annualMonthly;
            return (
              <TouchableOpacity
                key={cfg.id}
                onPress={() => setSelectedPlanId(cfg.id)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isSelected ? cfg.gradient : ["#1e293b", "#1e293b"]}
                  style={[S.planCard, isSelected && S.planCardSelected]}
                >
                  <View style={S.planHeader}>
                    <Text style={S.planEmoji}>{cfg.emoji}</Text>
                    <Text style={S.planName}>{cfg.name}</Text>
                    {isSelected && (
                      <View style={S.checkBadge}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                    {cfg.highlight && !isSelected && (
                      <View style={S.popularBadge}>
                        <Text style={S.popularBadgeText}>Popular</Text>
                      </View>
                    )}
                    <View style={S.planPriceWrap}>
                      <Text style={S.planPrice}>₹{price}</Text>
                      <Text style={S.planPriceSub}>/mo</Text>
                    </View>
                  </View>
                  {cfg.features.map((f) => (
                    <View key={f} style={S.featureRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                      <Text style={S.featureText}>{f}</Text>
                    </View>
                  ))}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}

          {/* Subscribe button */}
          <TouchableOpacity
            style={[S.subscribeBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            <LinearGradient
              colors={["#4f46e5", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={S.subscribeBtnGradient}
            >
              <Text style={S.subscribeBtnText}>
                {loading
                  ? "Processing…"
                  : `Subscribe · ₹${amount}/${cycle === "monthly" ? "mo" : "yr"}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[S.disclaimer, { color: colors.textSecondary }]}>
            Cancel anytime. Prices in INR, inclusive of taxes.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  heading: { fontSize: 20, fontWeight: "900", textAlign: "center", marginBottom: 16 },
  toggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleActive: { backgroundColor: "#4f46e5" },
  toggleText: { fontSize: 12, fontWeight: "700" },
  planCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  planCardSelected: { borderColor: "#6366f1" },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  planEmoji: { fontSize: 20 },
  planName: { color: "#fff", fontSize: 15, fontWeight: "800", flex: 1 },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  popularBadge: {
    backgroundColor: "#f59e0b",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popularBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  planPriceWrap: { alignItems: "flex-end" },
  planPrice: { color: "#fff", fontSize: 20, fontWeight: "900" },
  planPriceSub: { color: "rgba(255,255,255,0.6)", fontSize: 10 },
  featureRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  featureText: { color: "#e2e8f0", fontSize: 12, fontWeight: "500" },
  subscribeBtn: { marginTop: 8, marginBottom: 12, borderRadius: 16, overflow: "hidden" },
  subscribeBtnGradient: { paddingVertical: 16, alignItems: "center" },
  subscribeBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  disclaimer: { fontSize: 11, textAlign: "center", marginBottom: 8 },
});
