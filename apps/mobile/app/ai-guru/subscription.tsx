import { functions } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
// Graceful: expo-web-browser — requires prebuild, falls back gracefully
let WebBrowser: {
  openBrowserAsync: (url: string) => Promise<any>;
  openAuthSessionAsync?: (url: string, redirect: string) => Promise<{ type: string; url?: string }>;
} | null = null;
try { WebBrowser = require("expo-web-browser"); } catch {}

import { useAppConfig } from "@/context/AppConfigContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/lib/firebase";
import { RAZORPAY_KEY_ID } from "@/lib/seekho/constants";
import { isSubscribed } from "@/services/aiGuruFirestore";

type Cycle = "monthly" | "annual";

export default function AiGuruSubscriptionScreen() {
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();
  const { plans, configLoading } = useAppConfig();
  const { user } = useStudentProfile();

  const [cycle, setCycle]               = useState<Cycle>("monthly");
  const [selectedPlanId, setSelected]   = useState<string>("");
  const [loading, setLoading]           = useState(false);
  const [subscribed, setSubscribed]     = useState(false);
  const [checkingStatus, setChecking]   = useState(true);

  // Theme shortcuts
  const pageBg    = isDarkMode ? "#060612" : colors.background;
  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;
  const textMain  = isDarkMode ? "#f1f5f9" : colors.text;
  const textSec   = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const backBtnBg = isDarkMode ? "rgba(255,255,255,0.08)" : colors.card;

  // Filter to AI Guru paid plans — driven entirely from Firestore
  const aiGuruPlans = plans.filter(
    (p) => p.module === "aiGuru" && p.id !== "aiGuru_free"
  );

  // Auto-select the highlighted plan when plans load
  useEffect(() => {
    if (aiGuruPlans.length > 0 && !selectedPlanId) {
      const highlighted = aiGuruPlans.find((p) => p.highlight);
      setSelected(highlighted?.id ?? aiGuruPlans[0].id);
    }
  }, [aiGuruPlans.length]);

  // Re-check subscription status every time screen comes into focus
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

  const selectedPlan = aiGuruPlans.find((p) => p.id === selectedPlanId);
  const displayTotal = selectedPlan
    ? cycle === "monthly" ? selectedPlan.monthlyPrice : selectedPlan.annualPrice
    : 0;
  const displayMonthly = selectedPlan
    ? cycle === "monthly" ? selectedPlan.monthlyPrice : selectedPlan.annualMonthly
    : 0;

  // Savings percentage (annual vs monthly)
  const savingsPct = selectedPlan && selectedPlan.monthlyPrice > 0
    ? Math.round((1 - selectedPlan.annualMonthly / selectedPlan.monthlyPrice) * 100)
    : 0;

  const handleSubscribe = async () => {
    // Check auth.currentUser directly — more reliable than profile object
    if (!auth.currentUser) {
      Alert.alert("Login Required", "Please log out and log in again.");
      return;
    }
    if (!RAZORPAY_KEY_ID) {
      Alert.alert("Configuration Error", "Razorpay key not configured. Add EXPO_PUBLIC_RAZORPAY_KEY_ID to .env");
      return;
    }
    if (!selectedPlan) return;

    setLoading(true);
    try {
      // Force fresh token so Cloud Function context.auth is populated
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Session expired", "Please log out and log in again.");
        setLoading(false);
        return;
      }
      await currentUser.getIdToken(true); // force refresh

      // Phase 1 — Create Razorpay order via Cloud Function
      const createOrder = httpsCallable<
        { planId: string; cycle: Cycle; amountPaise: number },
        { razorpayOrderId: string }
      >(functions, "aiGuruCreateSubscription");

      const orderRes = await createOrder({
        planId:      selectedPlanId,
        cycle,
        amountPaise: displayTotal * 100,
      });

      const orderId = orderRes.data.razorpayOrderId;
      const uid     = auth.currentUser?.uid ?? "";
      const email   = auth.currentUser?.email ?? "";

      // Phase 2 — Build Razorpay hosted checkout URL
      // Phase 2 — Open Razorpay checkout via Cloud Function hosted page
      // Chrome blocks data: URIs — so we call a CF endpoint that serves the HTML
      const cfBase = process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL
        ?? "https://us-central1-gloows-03b6sz.cloudfunctions.net";

      const checkoutUrl = `${cfBase}/aiGuruCheckoutPage`
        + `?key=${encodeURIComponent(RAZORPAY_KEY_ID)}`
        + `&order_id=${encodeURIComponent(orderId)}`
        + `&amount=${displayTotal * 100}`
        + `&plan=${encodeURIComponent(selectedPlan.name)}`
        + `&email=${encodeURIComponent(email)}`
        + `&uid=${encodeURIComponent(uid)}`
        + `&planId=${encodeURIComponent(selectedPlanId)}`
        + `&cycle=${encodeURIComponent(cycle)}`;

      if (!WebBrowser) {
        Alert.alert("Not available", "Payment requires a development build.\n\nRun: npx expo run:android");
        return;
      }

      // Open browser — user pays, success handler calls aiGuruPaymentSuccess CF
      await WebBrowser.openBrowserAsync(checkoutUrl);

      // Phase 3 — Poll Firestore for up to 30 seconds
      setLoading(true);
      let activated = false;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const subscribed = await isSubscribed(uid);
        if (subscribed) { activated = true; break; }
      }

      if (activated) {
        setSubscribed(true);
        Alert.alert(
          "Subscribed! 🎉",
          `Welcome to ${selectedPlan.name}! Unlimited AI learning starts now.`,
          [{ text: "Start Learning", onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          "Payment Status",
          "If you completed payment, your subscription will activate within a minute.",
          [
            { text: "Check Now", onPress: async () => {
              const s = await isSubscribed(uid);
              if (s) { setSubscribed(true); Alert.alert("Activated! 🎉", "Your Premium subscription is now active."); }
              else   { Alert.alert("Not yet active", "Still processing. Please wait a moment and re-open this screen."); }
            }},
            { text: "OK" }
          ]
        );
      }
    } catch (e: unknown) {
      const err = e as any;
      const code = err?.code ?? "";
      const msg  = err?.message ?? "Payment failed. Please try again.";
      // Don't show error if user simply cancelled
      if (!msg.toLowerCase().includes("cancel") && code !== "functions/cancelled") {
        Alert.alert("Payment Failed", `${code ? "[" + code + "] " : ""}${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isLoading = configLoading || checkingStatus;

  return (
    <SafeAreaView style={[S.container, { backgroundColor: pageBg }]}>
      {isDarkMode && (
        <LinearGradient
          colors={["#060612", "#0d0d24", "#060612"]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(350)} style={S.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[S.backBtn, { backgroundColor: backBtnBg }]}
        >
          <Ionicons name="chevron-back" size={22} color={textSec} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: textMain }]}>AI Guru Premium</Text>
        <View style={S.headerRight}>
          <View style={S.aiBadge}>
            <Ionicons name="sparkles" size={12} color="#fbbf24" />
            <Text style={S.aiBadgeText}>PRO</Text>
          </View>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>

        {/* ── Hero ── */}
        <Animated.View entering={FadeInDown.duration(450).delay(80)}>
          <LinearGradient
            colors={["#1e1b4b", "#312e81", "#4f46e5"]}
            style={S.hero}
          >
            <Text style={S.heroEmoji}>✨</Text>
            <Text style={S.heroTitle}>Unlock AI Guru Premium</Text>
            <Text style={S.heroSub}>
              Unlimited lessons · All styles · All 22 Indian languages
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Loading state ── */}
        {isLoading && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={[S.loadingText, { color: textSec }]}>{t("loading")}</Text>
          </Animated.View>
        )}

        {/* ── Already subscribed ── */}
        {!isLoading && subscribed && (
          <Animated.View entering={FadeInDown.duration(400)} style={[S.subscribedCard, { backgroundColor: surfaceBg, borderColor: "#10b981" }]}>
            <Ionicons name="shield-checkmark" size={40} color="#10b981" />
            <Text style={[S.subscribedTitle, { color: textMain }]}>You're Premium! 🎉</Text>
            <Text style={[S.subscribedSub, { color: textSec }]}>
              Enjoy unlimited AI lessons and all premium features.
            </Text>
            <TouchableOpacity
              style={S.doneBtn}
              onPress={() => router.back()}
            >
              <Text style={S.doneBtnText}>Start Learning →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Coming Soon (admin has deactivated all plans) ── */}
        {!isLoading && !subscribed && aiGuruPlans.length === 0 && (
          <Animated.View entering={FadeInDown.duration(400)} style={S.centerBlock}>
            <Text style={{ fontSize: 52 }}>🚀</Text>
            <Text style={[S.comingSoonTitle, { color: textMain }]}>Coming Soon!</Text>
            <Text style={[S.comingSoonSub, { color: textSec }]}>
              AI Guru Premium plans are launching very soon.{"\n"}
              Check back in a little while!
            </Text>
          </Animated.View>
        )}

        {/* ── Normal: billing toggle + plan cards + subscribe CTA ── */}
        {!isLoading && !subscribed && aiGuruPlans.length > 0 && (
          <>
            {/* Billing cycle toggle */}
            <Animated.View entering={FadeInDown.duration(400).delay(160)} style={[S.toggleWrap, { backgroundColor: isDarkMode ? "#0f172a" : colors.background }]}>
              {(["monthly", "annual"] as Cycle[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[S.toggleBtn, cycle === c && S.toggleBtnActive]}
                  onPress={() => setCycle(c)}
                >
                  <Text style={[S.toggleText, { color: cycle === c ? "#fff" : textSec }]}>
                    {c === "monthly" ? "Monthly" : `Annual · Save ${savingsPct}%`}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>

            {/* Plan cards — built dynamically from Firestore */}
            {aiGuruPlans.map((plan, idx) => {
              const isSelected = selectedPlanId === plan.id;
              const cardMonthly = cycle === "monthly" ? plan.monthlyPrice : plan.annualMonthly;
              return (
                <Animated.View
                  key={plan.id}
                  entering={FadeInDown.duration(380).delay(220 + idx * 70)}
                >
                  <TouchableOpacity
                    onPress={() => setSelected(plan.id)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={isSelected ? plan.gradient : (isDarkMode ? ["#1e293b", "#1e293b"] : ["#f8fafc", "#f1f5f9"]) as any}
                      style={[S.planCard, isSelected && S.planCardSelected, { borderColor: isSelected ? "#6366f1" : borderCol }]}
                    >
                      {/* Popular badge */}
                      {plan.highlight && (
                        <View style={S.popularBadge}>
                          <Text style={S.popularBadgeText}>⭐ Most Popular</Text>
                        </View>
                      )}

                      {/* Plan header */}
                      <View style={S.planHeader}>
                        <Text style={S.planEmoji}>{plan.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[S.planName, !isSelected && { color: textMain }]}>{plan.name}</Text>
                          <View style={S.priceRow}>
                            <Text style={[S.planPrice, !isSelected && { color: colors.accent }]}>
                              ₹{cardMonthly}
                            </Text>
                            <Text style={[S.planPricePer, !isSelected && { color: textSec }]}>/mo</Text>
                            {cycle === "annual" && (
                              <Text style={[S.planPriceAnnual, !isSelected && { color: textSec }]}>
                                {" "}· ₹{plan.annualPrice}/yr
                              </Text>
                            )}
                          </View>
                        </View>
                        {isSelected
                          ? <Ionicons name="checkmark-circle" size={24} color="#a5b4fc" />
                          : <Ionicons name="ellipse-outline"  size={24} color={borderCol} />
                        }
                      </View>

                      {/* Feature list — from Firestore */}
                      {plan.features.map((feature) => (
                        <View key={feature} style={S.featureRow}>
                          <Ionicons name="checkmark-circle" size={14} color={isSelected ? "#10b981" : "#6366f1"} />
                          <Text style={[S.featureText, !isSelected && { color: textSec }]}>
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}

            {/* Subscribe CTA */}
            <Animated.View entering={FadeInDown.duration(380).delay(380)}>
              <TouchableOpacity
                style={[S.subscribeWrap, loading && { opacity: 0.7 }]}
                onPress={handleSubscribe}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#4f46e5", "#7c3aed"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={S.subscribeGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={S.subscribeText}>
                      {cycle === "monthly"
                        ? `Subscribe · ₹${displayTotal}/mo`
                        : `Subscribe · ₹${displayTotal}/year`}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Disclaimer */}
            <Animated.View entering={FadeInDown.duration(380).delay(450)}>
              <Text style={[S.disclaimer, { color: textSec }]}>
                Cancel anytime. Prices in INR, inclusive of taxes.
              </Text>
            </Animated.View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn:        { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerTitle:    { flex: 1, fontSize: 18, fontWeight: "900" },
  headerRight:    { alignItems: "flex-end" },
  aiBadge:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#fbbf24" },
  aiBadgeText:    { color: "#fbbf24", fontSize: 10, fontWeight: "900" },

  scroll:         { paddingHorizontal: 16, paddingBottom: 24 },

  hero:           { borderRadius: 20, padding: 24, alignItems: "center", gap: 8, marginBottom: 20 },
  heroEmoji:      { fontSize: 44 },
  heroTitle:      { color: "#f1f5f9", fontSize: 22, fontWeight: "900", textAlign: "center" },
  heroSub:        { color: "rgba(255,255,255,0.65)", fontSize: 13, textAlign: "center", lineHeight: 20 },

  centerBlock:    { alignItems: "center", paddingVertical: 48, gap: 14 },
  loadingText:    { fontSize: 14, marginTop: 8 },

  subscribedCard: { borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center", gap: 12, marginBottom: 20 },
  subscribedTitle:{ fontSize: 20, fontWeight: "900", textAlign: "center" },
  subscribedSub:  { fontSize: 14, textAlign: "center", lineHeight: 22 },
  doneBtn:        { marginTop: 8, backgroundColor: "#10b981", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  doneBtnText:    { color: "#fff", fontSize: 15, fontWeight: "800" },

  comingSoonTitle:{ fontSize: 24, fontWeight: "900", textAlign: "center" },
  comingSoonSub:  { fontSize: 14, textAlign: "center", lineHeight: 22, maxWidth: 280 },

  toggleWrap:     { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 16 },
  toggleBtn:      { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  toggleBtnActive:{ backgroundColor: "#4f46e5" },
  toggleText:     { fontSize: 13, fontWeight: "700" },

  planCard:       { borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1.5, gap: 10 },
  planCardSelected:{ borderColor: "#6366f1" },
  popularBadge:   { backgroundColor: "#f59e0b", alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
  popularBadgeText:{ color: "#fff", fontSize: 11, fontWeight: "800" },
  planHeader:     { flexDirection: "row", alignItems: "center", gap: 12 },
  planEmoji:      { fontSize: 28 },
  planName:       { color: "#f1f5f9", fontSize: 16, fontWeight: "900" },
  priceRow:       { flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 2 },
  planPrice:      { color: "#a5b4fc", fontSize: 22, fontWeight: "900" },
  planPricePer:   { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  planPriceAnnual:{ color: "rgba(255,255,255,0.45)", fontSize: 11 },
  featureRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText:    { color: "#e2e8f0", fontSize: 13, fontWeight: "500", flex: 1 },

  subscribeWrap:  { borderRadius: 18, overflow: "hidden", marginTop: 8, marginBottom: 12 },
  subscribeGradient:{ paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  subscribeText:  { color: "#fff", fontSize: 16, fontWeight: "900" },

  disclaimer:     { fontSize: 12, textAlign: "center", marginBottom: 8, lineHeight: 18 },
});