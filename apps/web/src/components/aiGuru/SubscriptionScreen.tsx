"use client";
// PATH: apps/web/src/components/aiGuru/SubscriptionScreen.tsx
//
// Generic, Firestore-driven subscription/checkout screen shared across
// product modules (e.g. ai-guru, discover, seekho). This component never
// existed in the codebase even though /ai-guru/subscription and
// /discover/subscription both imported it — see the FIX note in
// apps/web/src/app/(app)/ai-guru/subscription/page.tsx, which rebuilt the
// AI-Guru-specific screen directly rather than depending on this missing
// component. This file generalizes that same, working implementation
// (Firestore `subscriptionPlans` collection + RazorpayCheckout + a named
// Cloud Function) behind `module` / `title` / `createFn` props so other
// pages like /discover/subscription can reuse it without duplicating the
// checkout flow.
//
// Subscription status: `isSubscribed(uid)` in services/aiGuruFirestore.ts
// checks a single global `subscriptions/{uid}` doc — it isn't module-scoped
// today (confirmed: no `module` field is written or read anywhere,
// including apps/admin/src/pages/Subscriptions.tsx). This component mirrors
// that existing, global behavior rather than inventing new architecture.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "@/lib/firebase";
import { useAppConfig } from "@/context/AppConfigContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { isSubscribed } from "@/services/aiGuruFirestore";
import { RazorpayCheckout } from "@/components/RazorpayCheckout";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";

type Cycle = "monthly" | "annual";

interface PendingOrder {
  orderId:     string;
  amountPaise: number;
  planName:    string;
  planId:      string;
  cycle:       Cycle;
}

interface SubscriptionScreenProps {
  module: string;
  title: string;
  createFn: string;
  // Server-side HTTP endpoint that verifies the Razorpay signature and
  // activates the subscription (same job as functions/src/
  // aiGuruSubscription.ts's aiGuruPaymentSuccess) — defaults to that
  // function since subscriptions/{uid} is a single global doc today
  // (confirmed: not module-scoped anywhere), so it's the correct verify
  // endpoint regardless of which module's createFn created the order.
  // Override only if a module ever gets its own dedicated verify endpoint.
  verifyFn?: string;
}

export function SubscriptionScreen({ module, title, createFn, verifyFn = "aiGuruPaymentSuccess" }: SubscriptionScreenProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const { plans, configLoading } = useAppConfig();

  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filter to this module's paid plans — driven entirely from Firestore.
  const modulePlans = plans.filter((p) => p.module === module && p.isActive !== false);

  // Auto-select the highlighted plan once plans load.
  useEffect(() => {
    if (modulePlans.length > 0 && !selectedPlanId) {
      const highlighted = modulePlans.find((p) => p.highlight);
      setSelectedPlanId(highlighted?.id ?? modulePlans[0].id);
    }
  }, [modulePlans.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check subscription status on mount.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setCheckingStatus(false); return; }
    isSubscribed(uid).then((sub) => { setSubscribed(sub); setCheckingStatus(false); });
  }, []);

  const selectedPlan = modulePlans.find((p) => p.id === selectedPlanId);
  const displayTotal = selectedPlan
    ? (cycle === "monthly" ? selectedPlan.monthlyPrice : selectedPlan.annualPrice)
    : 0;

  const savingsPct = selectedPlan && selectedPlan.monthlyPrice > 0
    ? Math.round((1 - selectedPlan.annualMonthly / selectedPlan.monthlyPrice) * 100)
    : 0;

  // Polls Firestore for up to 30s after a successful Razorpay payment.
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

  // Step 1: create the Razorpay order via the module's own Cloud Function.
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
      >(functions, createFn);

      const orderRes = await createOrder({
        planId: selectedPlanId,
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
      const msg = e?.message ?? t("paymentFailedGeneric", "Could not start checkout. Please try again.");
      if (!msg.toLowerCase().includes("cancel") && code !== "functions/cancelled") {
        setErrorMsg(`${code ? "[" + code + "] " : ""}${msg}`);
      }
    } finally {
      setCreatingOrder(false);
    }
  }

  // FIX (same confirmed bug as apps/web/src/app/(app)/ai-guru/subscription/
  // page.tsx): used to take no arguments, silently dropping the
  // (paymentId, orderId, signature) RazorpayCheckout's onSuccess actually
  // passes, so nothing ever verified the payment or activated anything.
  async function handlePaymentSuccess(paymentId: string, orderId: string, signature: string) {
    const uid = auth.currentUser?.uid;
    const planName = pendingOrder?.planName ?? selectedPlan?.name ?? "Premium";
    if (!uid || !pendingOrder) { setPendingOrder(null); return; }

    try {
      await fetch(`${CLOUD_FUNCTION_URL}/${verifyFn}`, {
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
      console.error(`${verifyFn} call failed:`, e?.message);
    }

    pollForActivation(uid, planName);
  }

  function handlePaymentError(message: string) {
    setPendingOrder(null);
    if (!message.toLowerCase().includes("cancel")) setErrorMsg(message);
  }

  const isLoading = configLoading || checkingStatus;
  const busy = creatingOrder || polling;

  return (
    <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#060612,#0d0d24,#060612)" : colors.background, paddingBottom: 40 }}>
      <style>{`.sub-btn{cursor:pointer}.sub-btn:hover{opacity:.9}.sub-btn:disabled{cursor:default;opacity:.5}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12, position: "sticky", top: 0, zIndex: 10, background: isDarkMode ? "rgba(6,6,18,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}>
        <button className="sub-btn" onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 20, fontWeight: 900 }}>‹</button>
        <span style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: 900 }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(251,191,36,0.15)", border: "1px solid #fbbf24", borderRadius: 10, padding: "4px 10px" }}>
          <span style={{ fontSize: 12 }}>✨</span>
          <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 900 }}>PRO</span>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 16px" }}>

        {/* Hero */}
        <div style={{ borderRadius: 20, padding: 24, marginBottom: 20, textAlign: "center", background: "linear-gradient(135deg,#1e1b4b,#312e81,#4f46e5)" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✨</div>
          <div style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{t("unlockPremium", `Unlock ${title}`, { title })}</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.5 }}>
            {t("premiumHeroSubGeneric", "Unlock everything this module has to offer")}
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
            <div style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>{t("enjoyUnlimitedAccess", "Enjoy unlimited access to all premium features.")}</div>
            <button className="sub-btn" onClick={() => router.back()} style={{ marginTop: 8, background: "#10b981", border: "none", color: "#fff", fontSize: 15, fontWeight: 800, padding: "14px 28px", borderRadius: 14 }}>
              {t("startLearningArrow", "Start Learning →")}
            </button>
          </div>
        )}

        {!isLoading && !subscribed && modulePlans.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px", gap: 14, textAlign: "center" }}>
            <span style={{ fontSize: 52 }}>🚀</span>
            <div style={{ color: colors.text, fontSize: 24, fontWeight: 900 }}>{t("comingSoonTitle", "Coming Soon!")}</div>
            <div style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
              {t("comingSoonPlansGeneric", "Premium plans are launching very soon.\nCheck back in a little while!")}
            </div>
          </div>
        )}

        {!isLoading && !subscribed && modulePlans.length > 0 && (
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
            {modulePlans.map((plan) => {
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
                renders once pendingOrder exists. */}
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
                description={`${pendingOrder.planName} — ${title}`}
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
