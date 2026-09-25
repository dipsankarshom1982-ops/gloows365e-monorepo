"use client";
// PATH: apps/web/src/app/(app)/ai-guru/subscription/page.tsx
//
// FIX: this page used to be a 10-line wrapper around
// `@/components/aiGuru/SubscriptionScreen` — a component that doesn't
// exist anywhere in this codebase. The screen has been completely broken
// (a render-time import error) since whatever commit added that import.
//
// Rebuilt from mobile's real implementation (app/ai-guru/subscription.tsx,
// AiGuruSubscriptionScreen) — note that despite the old web comment
// describing "a shared SubscriptionScreen," mobile's version isn't a
// generic shared component either; it's a self-contained, AI-Guru-specific
// screen (Razorpay checkout, aiGuruCreateSubscription Cloud Function). This
// rebuild keeps that same scope, not a generic multi-module component.
//
// Payment flow adapted for web, not ported as-is:
//   - Mobile opens a Cloud-Function-hosted checkout page in the system
//     browser (expo-web-browser), because React Native has no native
//     payment popup. After payment, a server-side Razorpay webhook calls
//     aiGuruPaymentSuccess to activate the subscription — the mobile
//     client itself never calls that function, it only polls Firestore
//     afterward (see isSubscribed polling below, kept identical).
//   - Web doesn't need the browser-redirect hack: it already has
//     components/RazorpayCheckout.tsx, an official-SDK in-page checkout
//     modal. Same Cloud Function (aiGuruCreateSubscription) creates the
//     order; same server-side webhook activates the subscription; same
//     Firestore poll afterward confirms activation. Only the checkout UI
//     mechanism differs, not the backend contract.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "@/lib/firebase";
import { useAppConfig } from "@/context/AppConfigContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { isSubscribed } from "@/services/aiGuruFirestore";
import { RazorpayCheckout } from "@/components/RazorpayCheckout";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";
import { createCreditOrder, subscribeToCreditBalance } from "@/services/aiGuruCreditsService";
import type { CreditPack } from "@/context/AppConfigContext";

type Cycle = "monthly" | "annual";
// "Unlimited" = the existing flat-fee subscription (untouched); "Credits"
// = pay-as-you-go packs — coexist, not a replacement. Mirrors mobile's
// app/ai-guru/subscription.tsx MainTab exactly.
type MainTab = "unlimited" | "credits";

interface PendingCreditOrder {
  orderId:     string;
  amountPaise: number;
  packName:    string;
  credits:     number;
}

interface PendingOrder {
  orderId:     string;
  amountPaise: number;
  planName:    string;
  planId:      string;
  cycle:       Cycle;
}

export default function AiGuruSubscriptionPage() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const { plans, creditPacks, configLoading } = useAppConfig();
  const { studentProfile } = useStudentProfile();

  const [cycle,          setCycle]          = useState<Cycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [creatingOrder,  setCreatingOrder]  = useState(false);
  const [polling,        setPolling]        = useState(false);
  const [pendingOrder,   setPendingOrder]   = useState<PendingOrder | null>(null);

  const [mainTab, setMainTab] = useState<MainTab>("unlimited");
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [pendingCreditOrder, setPendingCreditOrder] = useState<PendingCreditOrder | null>(null);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [creditsMsg, setCreditsMsg] = useState("");
  const [subscribed,     setSubscribed]     = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [errorMsg,       setErrorMsg]       = useState("");

  // Filter to AI Guru paid plans — driven entirely from Firestore, same
  // as mobile (subscriptionPlans collection, module=="aiGuru").
  const aiGuruPlans = plans.filter((p) => p.module === "aiGuru" && p.id !== "aiGuru_free");

  // Auto-select the highlighted plan once plans load.
  useEffect(() => {
    if (aiGuruPlans.length > 0 && !selectedPlanId) {
      const highlighted = aiGuruPlans.find((p) => p.highlight);
      setSelectedPlanId(highlighted?.id ?? aiGuruPlans[0].id);
    }
  }, [aiGuruPlans.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check subscription status on mount (mirrors mobile's useFocusEffect
  // re-check — web has no focus-event equivalent for a single static
  // page, so an on-mount check is the closest match for "did this just
  // become true while I was away").
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setCheckingStatus(false); return; }
    isSubscribed(uid).then((sub) => { setSubscribed(sub); setCheckingStatus(false); });
  }, []);

  // Credit balance — shown in the Credits tab and used to decide whether
  // that tab is worth surfacing at all for a never-purchased user.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return subscribeToCreditBalance(uid, setCreditBalance);
  }, []);

  const selectedPlan = aiGuruPlans.find((p) => p.id === selectedPlanId);
  const displayTotal = selectedPlan
    ? (cycle === "monthly" ? selectedPlan.monthlyPrice : selectedPlan.annualPrice)
    : 0;

  const savingsPct = selectedPlan && selectedPlan.monthlyPrice > 0
    ? Math.round((1 - selectedPlan.annualMonthly / selectedPlan.monthlyPrice) * 100)
    : 0;

  // Polls Firestore for up to 30s after a successful Razorpay payment —
  // identical window/interval to mobile's post-WebBrowser poll. The
  // backend activation path (server-side webhook) is the same regardless
  // of which client checkout UI triggered the payment.
  const pollForActivation = useCallback(async (uid: string, planName: string) => {
    setPolling(true);
    let activated = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const sub = await isSubscribed(uid);
      if (sub) { activated = true; break; }
    }
    setPolling(false);
    setPendingOrder(null);

    if (activated) {
      setSubscribed(true);
    } else {
      setErrorMsg(
        t(
          "paymentProcessingMessage",
          `If you completed payment for ${planName}, your subscription will activate within a minute. Refresh this page shortly.`,
          { plan: planName }
        )
      );
    }
  }, [t]);

  // Step 1: create the Razorpay order via the same Cloud Function mobile
  // calls. Only once this resolves do we render <RazorpayCheckout> with a
  // real orderId — there's nothing to check out against before that.
  async function handleStartCheckout() {
    if (!auth.currentUser) {
      setErrorMsg(t("loginRequiredMessage", "Please log out and log in again."));
      return;
    }
    if (!selectedPlan) return;

    setCreatingOrder(true);
    setErrorMsg("");
    try {
      await auth.currentUser.getIdToken(true); // force-refresh so the CF's context.auth is fresh

      const createOrder = httpsCallable<
        { planId: string; cycle: Cycle; amountPaise: number },
        { razorpayOrderId: string }
      >(functions, "aiGuruCreateSubscription");

      const orderRes = await createOrder({
        planId:      selectedPlanId,
        cycle,
        amountPaise: displayTotal * 100,
      });

      setPendingOrder({
        orderId:     orderRes.data.razorpayOrderId,
        amountPaise: displayTotal * 100,
        planName:    selectedPlan.name,
        planId:      selectedPlanId,
        cycle,
      });
    } catch (e: any) {
      const code = e?.code ?? "";
      const msg  = e?.message ?? t("paymentFailedGeneric", "Could not start checkout. Please try again.");
      if (!msg.toLowerCase().includes("cancel") && code !== "functions/cancelled") {
        setErrorMsg(`${code ? "[" + code + "] " : ""}${msg}`);
      }
    } finally {
      setCreatingOrder(false);
    }
  }

  // FIX (confirmed live bug): this used to take no arguments at all —
  // RazorpayCheckout's onSuccess passes (paymentId, orderId, signature),
  // all three silently dropped, and this just polled Firestore for a
  // subscriptions/{uid} doc that nothing had ever written. Web
  // subscriptions took real money and activated nothing. There is no
  // Razorpay webhook anywhere in this codebase — aiGuruPaymentSuccess
  // only ever gets called by the mobile checkout page's embedded fetch
  // (functions/src/aiGuruSubscription.ts), which the web flow never
  // loads. This now calls it directly with the three Razorpay fields
  // (mobile's server-verified activation path), same signature
  // verification and Firestore write as the mobile flow, before polling.
  async function handlePaymentSuccess(paymentId: string, orderId: string, signature: string) {
    const uid = auth.currentUser?.uid;
    const planName = pendingOrder?.planName ?? selectedPlan?.name ?? "Premium";
    if (!uid || !pendingOrder) { setPendingOrder(null); return; }

    try {
      await fetch(`${CLOUD_FUNCTION_URL}/aiGuruPaymentSuccess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          planId: pendingOrder.planId,
          cycle:  pendingOrder.cycle,
          razorpay_payment_id: paymentId,
          razorpay_order_id:   orderId,
          razorpay_signature:  signature,
        }),
      });
    } catch (e: any) {
      console.error("aiGuruPaymentSuccess call failed:", e?.message);
      // Fall through to polling anyway — a network hiccup here doesn't
      // necessarily mean the request didn't land server-side.
    }

    pollForActivation(uid, planName);
  }

  function handlePaymentError(message: string) {
    setPendingOrder(null);
    if (!message.toLowerCase().includes("cancel")) setErrorMsg(message);
  }

  // ── Credits tab: same two-step order-create + RazorpayCheckout pattern
  // as the subscription flow above, pointed at aiGuruCreateCreditOrder /
  // aiGuruCreditPaymentSuccess instead.
  async function handleStartCreditCheckout(pack: CreditPack) {
    if (!auth.currentUser) {
      setCreditsMsg(t("loginRequiredMessage", "Please log out and log in again."));
      return;
    }
    setBuyingPackId(pack.id);
    setCreditsMsg("");
    try {
      await auth.currentUser.getIdToken(true);
      const order = await createCreditOrder(pack.id);
      setPendingCreditOrder({
        orderId:     order.razorpayOrderId,
        amountPaise: order.amountPaise,
        packName:    order.packName,
        credits:     order.credits,
      });
    } catch (e: any) {
      const code = e?.code ?? "";
      const msg  = e?.message ?? t("paymentFailedGeneric", "Could not start checkout. Please try again.");
      if (!msg.toLowerCase().includes("cancel") && code !== "functions/cancelled") {
        setCreditsMsg(`${code ? "[" + code + "] " : ""}${msg}`);
      }
      setBuyingPackId(null);
    }
  }

  async function handleCreditPaymentSuccess(paymentId: string, orderId: string, signature: string) {
    try {
      await fetch(`${CLOUD_FUNCTION_URL}/aiGuruCreditPaymentSuccess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No uid/packId/credits here — aiGuruCreditPaymentSuccess resolves
        // all of that server-side from the aiGuruCreditOrders/{orderId}
        // doc written at order-create time (see functions/src/
        // aiGuruCredits.ts), never from client input.
        body: JSON.stringify({
          razorpay_payment_id: paymentId,
          razorpay_order_id:   orderId,
          razorpay_signature:  signature,
        }),
      });
      setCreditsMsg(`Credits added! You now have more AI Guru credits to use.`);
    } catch (e: any) {
      console.error("aiGuruCreditPaymentSuccess call failed:", e?.message);
      setCreditsMsg("If you completed payment, your credits will show up within a minute.");
    } finally {
      setPendingCreditOrder(null);
      setBuyingPackId(null);
    }
  }

  function handleCreditPaymentError(message: string) {
    setPendingCreditOrder(null);
    setBuyingPackId(null);
    if (!message.toLowerCase().includes("cancel")) setCreditsMsg(message);
  }

  const isLoading = configLoading || checkingStatus;
  const busy = creatingOrder || polling;

  return (
    <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#060612,#0d0d24,#060612)" : colors.background, paddingBottom: 40 }}>
      <style>{`.sub-btn{cursor:pointer}.sub-btn:hover{opacity:.9}.sub-btn:disabled{cursor:default;opacity:.5}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12, position: "sticky", top: 0, zIndex: 10, background: isDarkMode ? "rgba(6,6,18,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}>
        <button className="sub-btn" onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 20, fontWeight: 900 }}>‹</button>
        <span style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: 900 }}>{t("aiGuruPremiumTitle", "AI Guru Premium")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(251,191,36,0.15)", border: "1px solid #fbbf24", borderRadius: 10, padding: "4px 10px" }}>
          <span style={{ fontSize: 12 }}>✨</span>
          <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 900 }}>PRO</span>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 16px" }}>

        {/* Hero */}
        <div style={{ borderRadius: 20, padding: 24, marginBottom: 20, textAlign: "center", background: "linear-gradient(135deg,#1e1b4b,#312e81,#4f46e5)" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✨</div>
          <div style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{t("unlockAiGuruPremium", "Unlock AI Guru Premium")}</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.5 }}>
            {t("premiumHeroSub", "Unlimited lessons · All styles · All 23 Indian languages")}
          </div>
        </div>

        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 14 }}>
            <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <span style={{ color: colors.textSecondary, fontSize: 14 }}>{t("loading", "Loading…")}</span>
          </div>
        )}

        {!isLoading && subscribed && (
          <div style={{ borderRadius: 20, border: "1px solid #10b981", background: isDarkMode ? "#1e293b" : colors.card, padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 40 }}>🛡️</span>
            <div style={{ color: colors.text, fontSize: 20, fontWeight: 900 }}>{t("youreAlreadyPremium", "You're Premium! 🎉")}</div>
            <div style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>{t("enjoyUnlimitedLessons", "Enjoy unlimited AI lessons and all premium features.")}</div>
            <button className="sub-btn" onClick={() => router.back()} style={{ marginTop: 8, background: "#10b981", border: "none", color: "#fff", fontSize: 15, fontWeight: 800, padding: "14px 28px", borderRadius: 14 }}>
              {t("startLearningArrow", "Start Learning →")}
            </button>
          </div>
        )}

        {/* Unlimited vs Credits tabs — only shown to non-subscribers, same
            as mobile's app/ai-guru/subscription.tsx. A subscriber already
            has everything the Credits tab would sell them. */}
        {!isLoading && !subscribed && (
          <div style={{ display: "flex", borderRadius: 14, padding: 4, marginBottom: 16, background: isDarkMode ? "#0f172a" : colors.card }}>
            <button className="sub-btn" onClick={() => setMainTab("unlimited")} style={{
              flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
              background: mainTab === "unlimited" ? "#4f46e5" : "transparent",
              color: mainTab === "unlimited" ? "#fff" : colors.textSecondary, fontSize: 13, fontWeight: 700,
            }}>
              ✨ Unlimited
            </button>
            <button className="sub-btn" onClick={() => setMainTab("credits")} style={{
              flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
              background: mainTab === "credits" ? "#4f46e5" : "transparent",
              color: mainTab === "credits" ? "#fff" : colors.textSecondary, fontSize: 13, fontWeight: 700,
            }}>
              ⚡ Pay As You Go{creditBalance ? ` · ${creditBalance}` : ""}
            </button>
          </div>
        )}

        {/* ── Credits tab: buy a prepaid pack, no subscription needed ── */}
        {!isLoading && !subscribed && mainTab === "credits" && (
          <>
            {creditsMsg && (
              <div style={{ color: "#fca5a5", fontSize: 13, padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 12, lineHeight: 1.5 }}>
                {creditsMsg}
              </div>
            )}
            {creditPacks.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px", gap: 14, textAlign: "center" }}>
                <span style={{ fontSize: 44 }}>🎫</span>
                <div style={{ color: colors.text, fontSize: 24, fontWeight: 900 }}>{t("comingSoonTitle", "Coming Soon!")}</div>
                <div style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
                  Credit packs are launching very soon.<br />Check back in a little while!
                </div>
              </div>
            ) : (
              creditPacks.map((pack) => {
                const totalCredits = pack.credits + (pack.bonusCredits ?? 0);
                const rupees = pack.pricePaise / 100;
                const [g0, g1] = pack.gradient;
                const isBuying = buyingPackId === pack.id;
                const isPending = pendingCreditOrder && buyingPackId === pack.id;
                return (
                  <div
                    key={pack.id}
                    style={{
                      borderRadius: 18, padding: 18, marginBottom: 12,
                      border: pack.highlight ? "2px solid #fbbf24" : "1.5px solid transparent",
                      background: `linear-gradient(135deg,${g0},${g1})`,
                    }}
                  >
                    {pack.highlight && (
                      <div style={{ display: "inline-block", background: "#f59e0b", borderRadius: 8, padding: "4px 10px", marginBottom: 8 }}>
                        <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>⭐ Best Value</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 28 }}>{pack.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 900 }}>{pack.name}</div>
                        <div style={{ color: "#e0e7ff", fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                          {totalCredits} credits{pack.bonusCredits > 0 ? ` (+${pack.bonusCredits} bonus)` : ""}
                        </div>
                      </div>
                      {!isPending && (
                        <span style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>₹{rupees.toLocaleString("en-IN")}</span>
                      )}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {isPending ? (
                        <RazorpayCheckout
                          orderId={pendingCreditOrder.orderId}
                          amount={pendingCreditOrder.amountPaise}
                          description={`${pendingCreditOrder.packName} — AI Guru Credits`}
                          onSuccess={handleCreditPaymentSuccess}
                          onError={handleCreditPaymentError}
                        >
                          {`Pay ₹${(pendingCreditOrder.amountPaise / 100).toLocaleString("en-IN")}`}
                        </RazorpayCheckout>
                      ) : (
                        <button
                          className="sub-btn"
                          onClick={() => handleStartCreditCheckout(pack)}
                          disabled={!!buyingPackId}
                          style={{
                            width: "100%", padding: "12px 0", borderRadius: 14, border: "none",
                            background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 14, fontWeight: 800,
                          }}
                        >
                          {isBuying ? "Preparing checkout…" : "Buy"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
              Credits never expire. Use them on any AI Guru feature once you've used today's free actions.
            </div>
          </>
        )}

        {!isLoading && !subscribed && mainTab === "unlimited" && aiGuruPlans.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px", gap: 14, textAlign: "center" }}>
            <span style={{ fontSize: 52 }}>🚀</span>
            <div style={{ color: colors.text, fontSize: 24, fontWeight: 900 }}>{t("comingSoonTitle", "Coming Soon!")}</div>
            <div style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
              {t("comingSoonAiGuruPlans", "AI Guru Premium plans are launching very soon.\nCheck back in a little while!")}
            </div>
          </div>
        )}

        {!isLoading && !subscribed && mainTab === "unlimited" && aiGuruPlans.length > 0 && (
          <>
            {/* Billing cycle toggle */}
            <div style={{ display: "flex", borderRadius: 14, padding: 4, marginBottom: 16, background: isDarkMode ? "#0f172a" : colors.card }}>
              {(["monthly", "annual"] as Cycle[]).map((c) => (
                <button key={c} className="sub-btn" onClick={() => setCycle(c)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
                  background: cycle === c ? "#4f46e5" : "transparent",
                  color: cycle === c ? "#fff" : colors.textSecondary, fontSize: 13, fontWeight: 700,
                }}>
                  {c === "monthly" ? t("monthlyLabel", "Monthly") : t("annualSaveLabel", `Annual · Save ${savingsPct}%`, { pct: savingsPct })}
                </button>
              ))}
            </div>

            {/* Plan cards */}
            {aiGuruPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const cardMonthly = cycle === "monthly" ? plan.monthlyPrice : plan.annualMonthly;
              const [g0, g1] = plan.gradient;
              return (
                <button
                  key={plan.id}
                  className="sub-btn"
                  onClick={() => setSelectedPlanId(plan.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", border: `1.5px solid ${isSelected ? "#6366f1" : (isDarkMode ? "#334155" : colors.border)}`,
                    borderRadius: 18, padding: 18, marginBottom: 12,
                    background: isSelected ? `linear-gradient(135deg,${g0},${g1})` : (isDarkMode ? "#1e293b" : colors.card),
                  }}
                >
                  {plan.highlight && (
                    <div style={{ display: "inline-block", background: "#f59e0b", borderRadius: 8, padding: "4px 10px", marginBottom: 8 }}>
                      <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>⭐ {t("mostPopularLabel", "Most Popular")}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{plan.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: isSelected ? "#f1f5f9" : colors.text, fontSize: 16, fontWeight: 900 }}>{plan.name}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginTop: 2 }}>
                        <span style={{ color: isSelected ? "#a5b4fc" : colors.accent, fontSize: 22, fontWeight: 900 }}>₹{cardMonthly}</span>
                        <span style={{ color: isSelected ? "rgba(255,255,255,0.5)" : colors.textSecondary, fontSize: 12 }}>/mo</span>
                        {cycle === "annual" && (
                          <span style={{ color: isSelected ? "rgba(255,255,255,0.45)" : colors.textSecondary, fontSize: 11 }}>&nbsp;· ₹{plan.annualPrice}/{t("yearSuffix", "yr")}</span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 22, color: isSelected ? "#a5b4fc" : colors.textSecondary }}>{isSelected ? "●" : "○"}</span>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {plan.features.map((feature) => (
                      <div key={feature} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: isSelected ? "#10b981" : "#6366f1", fontSize: 13 }}>✓</span>
                        <span style={{ color: isSelected ? "#e2e8f0" : colors.text, fontSize: 13 }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}

            {errorMsg && (
              <div style={{ color: "#fca5a5", fontSize: 13, padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 12, lineHeight: 1.5 }}>
                {errorMsg}
              </div>
            )}

            {/* Step 1: create order. Step 2 (RazorpayCheckout) only
                renders once pendingOrder exists — there's no order to pay
                against before this resolves. */}
            {!pendingOrder ? (
              <button className="sub-btn" onClick={handleStartCheckout} disabled={busy} style={{
                width: "100%", padding: "18px 0", borderRadius: 18, border: "none",
                background: "linear-gradient(90deg,#4f46e5,#7c3aed)", color: "#fff", fontSize: 16, fontWeight: 900,
              }}>
                {creatingOrder
                  ? t("preparingCheckout", "Preparing checkout…")
                  : cycle === "monthly"
                    ? t("subscribeMonthly", `Subscribe · ₹${displayTotal}/mo`, { amount: displayTotal })
                    : t("subscribeAnnual", `Subscribe · ₹${displayTotal}/year`, { amount: displayTotal })}
              </button>
            ) : (
              <RazorpayCheckout
                orderId={pendingOrder.orderId}
                amount={pendingOrder.amountPaise}
                description={`${pendingOrder.planName} — AI Guru Premium`}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              >
                {polling
                  ? t("confirmingPayment", "Confirming payment…")
                  : t("completePayment", `Pay ₹${pendingOrder.amountPaise / 100}`, { amount: pendingOrder.amountPaise / 100 })}
              </RazorpayCheckout>
            )}

            <div style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
              {t("subscriptionDisclaimer", "Cancel anytime. Prices in INR, inclusive of taxes.")}
            </div>
          </>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}
