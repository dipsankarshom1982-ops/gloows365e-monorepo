"use client";

// PATH: apps/web/src/app/(app)/subscription/page.tsx
//
// New web Subscription page — a status + billing hub, NOT a second
// checkout flow. Gloows365's actual subscription architecture (confirmed
// by audit before writing this file):
//   - ONE global subscription state per user: Firestore subscriptions/{uid}
//     (planId/cycle/status/endDate), written by functions/src/
//     aiGuruSubscription.ts's aiGuruPaymentSuccess. Not module-scoped,
//     even though plans are grouped by module for display (see
//     components/aiGuru/SubscriptionScreen.tsx's own header comment).
//   - Canonical plans/pricing: Firestore subscriptionPlans, already wired
//     into useAppConfig() — read here, never invented.
//   - A full, working Razorpay checkout flow already exists at
//     /ai-guru/subscription (and /discover/subscription for that module).
//     This page does not duplicate that UI or the payment logic — it reads
//     status/history and links out to the real checkout pages to
//     subscribe/change plan, exactly as scoped and approved before
//     implementation started.
//   - Billing history: functions/src/billingHistory.ts's getMyInvoices
//     callable already exists and is generic/reusable; this page is its
//     first web-side consumer (services/billingService.ts).
//
// Subscription states shown here are read from the real backend state,
// never inferred from a client-side action:
//   none    — no subscriptions/{uid} doc → prompt to subscribe.
//   staff   — users/{uid}.role is tester/admin → full access, not a paid plan.
//   active  — status === "active" AND endDate in the future.
//   expired — endDate has passed (even if status still says "active",
//             matching isSubscribed()'s own >Date.now() check).
//   other   — any other status value (e.g. a webhook-set "failed"/
//             "cancelled") — shown honestly with its real label; recovery
//             from an interrupted/failed checkout itself happens on the
//             checkout page, not duplicated here.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useTheme } from "@/context/ThemeContext";
import { useAppConfig } from "@/context/AppConfigContext";
import { getSubscriptionStatus, type SubscriptionStatus } from "@/services/aiGuruFirestore";
import {
  getMyInvoices,
  formatInvoiceDate,
  formatInvoiceAmount,
  invoiceStatusLabel,
  planDisplayName,
  type InvoiceRecord,
} from "@/services/billingService";
import InvoiceDetailModal from "./InvoiceDetailModal";

// Only modules with a real, working checkout page get a link here — no
// dead links, no advertising a module the web app can't yet sell.
const MODULE_CHECKOUT_ROUTES: Record<string, { route: string; label: string }> = {
  aiGuru: { route: "/ai-guru/subscription", label: "AI Guru Premium" },
  discover: { route: "/discover/subscription", label: "Discover AI Premium" },
};

type PlanState = "loading" | "staff" | "none" | "active" | "expired" | "other";

function invoiceStatusColor(status: string): string {
  switch (status) {
    case "paid": return "#22c55e";
    case "pending": return "#f59e0b";
    case "failed": return "#ef4444";
    default: return "#94a3b8";
  }
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { plans, configLoading } = useAppConfig();

  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setCheckingStatus(false); return; }
    getSubscriptionStatus(uid)
      .then(setSub)
      .finally(() => setCheckingStatus(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInvoicesLoading(true);
    setInvoicesError("");
    getMyInvoices({ pageSize: 10 })
      .then((res) => {
        if (cancelled) return;
        setInvoices(res.invoices);
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
      })
      .catch((e: any) => {
        if (!cancelled) setInvoicesError(e?.message || "Could not load billing history.");
      })
      .finally(() => { if (!cancelled) setInvoicesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function loadMoreInvoices() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getMyInvoices({ pageSize: 10, startAfterInvoiceId: nextCursor });
      setInvoices((prev) => [...prev, ...res.invoices]);
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
    } catch (e: any) {
      setInvoicesError(e?.message || "Could not load more invoices.");
    } finally {
      setLoadingMore(false);
    }
  }

  const now = Date.now();
  let planState: PlanState = "loading";
  if (!checkingStatus) {
    if (!sub) planState = "none";
    else if (sub.isTesterOrAdmin && !sub.planId) planState = "staff";
    else if (sub.status === "active" && sub.endDateMs != null && sub.endDateMs > now) planState = "active";
    else if (sub.endDateMs != null && sub.endDateMs <= now) planState = "expired";
    else planState = "other";
  }

  const currentPlan = sub?.planId ? plans.find((p) => p.id === sub.planId) : undefined;
  const currentPlanName = currentPlan?.name ?? sub?.planId ?? "Premium";
  const currentPlanModuleRoute = currentPlan?.module ? MODULE_CHECKOUT_ROUTES[currentPlan.module] : undefined;

  // Group active, purchasable plans by module — one summary card per
  // module that actually has a checkout page, never the whole plan-picker
  // UI duplicated here.
  const moduleSummaries = Object.entries(MODULE_CHECKOUT_ROUTES).map(([moduleId, meta]) => {
    const modulePlans = plans.filter((p) => p.module === moduleId && p.monthlyPrice > 0);
    if (modulePlans.length === 0) return null;
    const cheapest = Math.min(...modulePlans.map((p) => p.monthlyPrice));
    return { moduleId, ...meta, cheapest, count: modulePlans.length };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;
  const pageBg = isDarkMode ? "linear-gradient(180deg,#060612,#0d0d24,#060612)" : colors.background;

  return (
    <div style={{ minHeight: "100dvh", background: pageBg, paddingBottom: 60 }}>
      <style>{`.sub-btn{cursor:pointer}.sub-btn:hover{opacity:.9}.sub-btn:disabled{cursor:default;opacity:.5}`}</style>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", padding: "14px 16px", gap: 12,
        position: "sticky", top: 0, zIndex: 10,
        background: isDarkMode ? "rgba(6,6,18,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
      }}>
        <button
          className="sub-btn"
          onClick={() => router.back()}
          aria-label="Go back"
          style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 20, fontWeight: 900 }}
        >
          ‹
        </button>
        <h1 style={{ flex: 1, margin: 0, color: colors.text, fontSize: 18, fontWeight: 900 }}>Subscription</h1>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 0" }}>

        {/* ── Current Plan / Status ─────────────────────────────────── */}
        <section aria-labelledby="current-plan-heading" style={{ marginBottom: 24 }}>
          <h2 id="current-plan-heading" style={{ fontSize: 13, fontWeight: 800, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Current Plan
          </h2>

          {planState === "loading" && (
            <div style={{ border: `1px solid ${borderCol}`, borderRadius: 18, background: surfaceBg, padding: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <span style={{ color: colors.textSecondary, fontSize: 14 }}>Checking your subscription…</span>
            </div>
          )}

          {planState === "staff" && (
            <div style={{ border: "1px solid #6366f1", borderRadius: 18, background: surfaceBg, padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 30 }}>🛡️</span>
              <div>
                <div style={{ color: colors.text, fontSize: 16, fontWeight: 900 }}>Full Access Granted</div>
                <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Your account has staff/tester access to all premium features.</div>
              </div>
            </div>
          )}

          {planState === "none" && (
            <div style={{ border: `1px solid ${borderCol}`, borderRadius: 18, background: surfaceBg, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: colors.text, fontSize: 16, fontWeight: 900 }}>You're on the Free plan</div>
                <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Subscribe to unlock premium features.</div>
              </div>
              {moduleSummaries.length > 0 && (
                <a href="#available-plans" className="sub-btn" style={{ background: "#4f46e5", color: "#fff", fontSize: 13.5, fontWeight: 800, padding: "10px 18px", borderRadius: 12, textDecoration: "none" }}>
                  View Plans
                </a>
              )}
            </div>
          )}

          {planState === "active" && (
            <div style={{ border: "1px solid #10b981", borderRadius: 18, background: surfaceBg, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: colors.text, fontSize: 16, fontWeight: 900 }}>{currentPlanName}</span>
                  <span style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20 }}>Active</span>
                  {sub?.cycle && (
                    <span style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{sub.cycle}</span>
                  )}
                </div>
                {sub?.endDateMs != null && (
                  <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Renews on {new Date(sub.endDateMs).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                )}
              </div>
              {currentPlanModuleRoute && (
                <button className="sub-btn" onClick={() => router.push(currentPlanModuleRoute.route)} style={{ background: surfaceBg, border: `1px solid ${borderCol}`, color: colors.text, fontSize: 13.5, fontWeight: 800, padding: "10px 18px", borderRadius: 12 }}>
                  Manage
                </button>
              )}
            </div>
          )}

          {planState === "expired" && (
            <div style={{ border: "1px solid #ef4444", borderRadius: 18, background: surfaceBg, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: colors.text, fontSize: 16, fontWeight: 900 }}>{currentPlanName}</span>
                  <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20 }}>Expired</span>
                </div>
                {sub?.endDateMs != null && (
                  <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Expired on {new Date(sub.endDateMs).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                )}
              </div>
              {(currentPlanModuleRoute ?? moduleSummaries[0]) && (
                <button
                  className="sub-btn"
                  onClick={() => router.push(currentPlanModuleRoute?.route ?? moduleSummaries[0].route)}
                  style={{ background: "#4f46e5", border: "none", color: "#fff", fontSize: 13.5, fontWeight: 800, padding: "10px 18px", borderRadius: 12 }}
                >
                  Resubscribe
                </button>
              )}
            </div>
          )}

          {planState === "other" && (
            <div style={{ border: `1px solid #f59e0b`, borderRadius: 18, background: surfaceBg, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: colors.text, fontSize: 16, fontWeight: 900 }}>{currentPlanName}</span>
                  <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20, textTransform: "capitalize" }}>
                    {sub?.status || "Unknown"}
                  </span>
                </div>
                <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  If you were completing a payment, check the billing history below or try again from the plan page.
                </div>
              </div>
              {currentPlanModuleRoute && (
                <button className="sub-btn" onClick={() => router.push(currentPlanModuleRoute.route)} style={{ background: surfaceBg, border: `1px solid ${borderCol}`, color: colors.text, fontSize: 13.5, fontWeight: 800, padding: "10px 18px", borderRadius: 12 }}>
                  View Plan
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── Available Plans ───────────────────────────────────────── */}
        {!configLoading && moduleSummaries.length > 0 && (
          <section id="available-plans" aria-labelledby="available-plans-heading" style={{ marginBottom: 24 }}>
            <h2 id="available-plans-heading" style={{ fontSize: 13, fontWeight: 800, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Available Plans
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {moduleSummaries.map((m) => (
                <div key={m.moduleId} style={{ border: `1px solid ${borderCol}`, borderRadius: 16, background: surfaceBg, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ color: colors.text, fontSize: 15, fontWeight: 900 }}>{m.label}</div>
                  <div style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {m.count} plan{m.count > 1 ? "s" : ""} · from ₹{m.cheapest}/mo
                  </div>
                  <button
                    className="sub-btn"
                    onClick={() => router.push(m.route)}
                    style={{ marginTop: 4, background: "#4f46e5", border: "none", color: "#fff", fontSize: 13.5, fontWeight: 800, padding: "10px 0", borderRadius: 12 }}
                  >
                    View Plans
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Billing History ────────────────────────────────────────── */}
        <section aria-labelledby="billing-history-heading" style={{ marginBottom: 24 }}>
          <h2 id="billing-history-heading" style={{ fontSize: 13, fontWeight: 800, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Billing History
          </h2>

          {invoicesLoading && (
            <div style={{ border: `1px solid ${borderCol}`, borderRadius: 16, background: surfaceBg, padding: 24, textAlign: "center", color: colors.textSecondary, fontSize: 13.5 }}>
              Loading billing history…
            </div>
          )}

          {!invoicesLoading && invoicesError && (
            <div style={{ border: "1px solid #ef4444", borderRadius: 16, background: surfaceBg, padding: 18, color: "#ef4444", fontSize: 13.5 }}>
              {invoicesError}
            </div>
          )}

          {!invoicesLoading && !invoicesError && invoices.length === 0 && (
            <div style={{ border: `1px solid ${borderCol}`, borderRadius: 16, background: surfaceBg, padding: 24, textAlign: "center", color: colors.textSecondary, fontSize: 13.5 }}>
              No invoices yet.
            </div>
          )}

          {!invoicesLoading && !invoicesError && invoices.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {invoices.map((inv) => {
                const color = invoiceStatusColor(inv.status);
                return (
                  <button
                    key={inv.invoiceId}
                    onClick={() => setSelectedInvoice(inv)}
                    aria-label={`Invoice ${inv.invoiceId}, ${planDisplayName(inv)}, ${invoiceStatusLabel(inv.status)}, ${formatInvoiceAmount(inv.totalAmountPaise, inv.currency)}`}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      border: `1px solid ${borderCol}`, borderRadius: 14, background: surfaceBg,
                      padding: "12px 16px", cursor: "pointer", textAlign: "left", width: "100%",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: colors.text, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {planDisplayName(inv)}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {formatInvoiceDate(inv.issuedAt)} · #{inv.invoiceId}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{ background: `${color}1a`, color, fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20 }}>
                        {invoiceStatusLabel(inv.status)}
                      </span>
                      <span style={{ color: colors.text, fontSize: 14, fontWeight: 800 }}>
                        {formatInvoiceAmount(inv.totalAmountPaise, inv.currency)}
                      </span>
                    </div>
                  </button>
                );
              })}

              {hasMore && (
                <button
                  className="sub-btn"
                  onClick={loadMoreInvoices}
                  disabled={loadingMore}
                  style={{ marginTop: 4, background: "transparent", border: `1px solid ${borderCol}`, color: colors.text, fontSize: 13, fontWeight: 700, padding: "10px 0", borderRadius: 12 }}
                >
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              )}
            </div>
          )}
        </section>

        <div style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: 4, lineHeight: 1.5 }}>
          Cancel anytime. Prices in INR, inclusive of taxes.
        </div>

        <div style={{ height: 32 }} />
      </div>

      {selectedInvoice && (
        <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
