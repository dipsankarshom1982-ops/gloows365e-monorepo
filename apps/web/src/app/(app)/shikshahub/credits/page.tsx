"use client";
// PATH: apps/web/src/app/(app)/shikshahub/credits/page.tsx
// ShikshaHub Phase 4 — tutor credits (funds Instant Help per-minute
// billing). Simplified mirror of apps/web/src/app/(app)/ai-guru/credits/
// page.tsx's balance/pack-grid/ledger layout, pointed at the separate
// tutorCredits currency (see functions/src/tutorCredits.ts's header
// comment for why it's genuinely separate from aiGuruCredits).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { RazorpayCheckout } from "@/components/RazorpayCheckout";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";
import { fetchTutorCreditPacks, createTutorCreditOrderCall } from "@/lib/shikshahub";
import { useTutorCreditsBalance, type TutorCreditPack } from "@gloows/shared-logic";

interface PendingOrder {
  orderId:     string;
  amountPaise: number;
  packName:    string;
}

function formatTxDate(ts: any): string {
  const d: Date | null = ts?.toDate ? ts.toDate() : null;
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function TutorCreditsPage() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();
  const { balance, transactions } = useTutorCreditsBalance();

  const [packs, setPacks] = useState<TutorCreditPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchTutorCreditPacks().then(setPacks).finally(() => setPacksLoading(false));
  }, []);

  async function handleBuy(pack: TutorCreditPack) {
    if (!auth.currentUser) {
      setMsg("Please log out and log in again.");
      return;
    }
    setBuyingPackId(pack.id!);
    setMsg("");
    try {
      await auth.currentUser.getIdToken(true);
      const order = await createTutorCreditOrderCall(pack.id!);
      setPendingOrder({ orderId: order.razorpayOrderId, amountPaise: order.amountPaise, packName: order.packName });
    } catch (e: any) {
      const code = e?.code ?? "";
      const errMsg = e?.message ?? "Could not start checkout. Please try again.";
      if (!errMsg.toLowerCase().includes("cancel") && code !== "functions/cancelled") {
        setMsg(`${code ? "[" + code + "] " : ""}${errMsg}`);
      }
      setBuyingPackId(null);
    }
  }

  async function handleSuccess(paymentId: string, orderId: string, signature: string) {
    try {
      await fetch(`${CLOUD_FUNCTION_URL}/tutorCreditPaymentSuccess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: paymentId,
          razorpay_order_id:   orderId,
          razorpay_signature:  signature,
        }),
      });
      setMsg("Credits added! ⚡");
    } catch (e: any) {
      console.error("tutorCreditPaymentSuccess call failed:", e?.message);
      setMsg("If you completed payment, your credits will show up within a minute.");
    } finally {
      setPendingOrder(null);
      setBuyingPackId(null);
    }
  }

  function handleError(message: string) {
    setPendingOrder(null);
    setBuyingPackId(null);
    if (!message.toLowerCase().includes("cancel")) setMsg(message);
  }

  return (
    <div style={{ minHeight: "100dvh", background: colors.background, paddingBottom: 96 }}>
      <style>{`.ih-btn{cursor:pointer}.ih-btn:hover{opacity:.9}.ih-btn:disabled{cursor:default;opacity:.5}`}</style>

      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12, position: "sticky", top: 0, zIndex: 10, background: isDarkMode ? "rgba(6,6,18,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}>
        <button className="ih-btn" onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 20, fontWeight: 900 }}>‹</button>
        <span style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: 900 }}>{t("instantHelpCreditsTitle", "Instant Help Credits")}</span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 16px" }}>

        <div style={{ borderRadius: 20, padding: 24, marginBottom: 20, textAlign: "center", background: "linear-gradient(135deg,#0f766e,#0d9488,#14b8a6)" }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>⚡</div>
          <div style={{ color: "#fff", fontSize: 40, fontWeight: 900 }}>{balance ?? "—"}</div>
          <div style={{ color: "#99f6e4", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t("instantHelpCreditsBalance", "Tutor credits")}</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>
            {t("instantHelpCreditsExplain", "Credits fund Instant Help — billed per minute while a session is active.")}
          </div>
        </div>

        {msg && (
          <div style={{ color: "#fca5a5", fontSize: 13, padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 12, lineHeight: 1.5 }}>
            {msg}
          </div>
        )}

        <div style={{ color: colors.text, fontSize: 15, fontWeight: 800, marginBottom: 12 }}>{t("instantHelpBuyCredits", "Buy Credits")}</div>
        {packsLoading ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: colors.textSecondary, fontSize: 14 }}>Loading…</div>
        ) : packs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: colors.textSecondary, fontSize: 13 }}>
            {t("instantHelpNoPacks", "Credit packs aren't available right now. Check back soon!")}
          </div>
        ) : (
          packs.map((pack) => {
            const totalCredits = pack.credits + (pack.bonusCredits ?? 0);
            const rupees = pack.pricePaise / 100;
            const isBuying = buyingPackId === pack.id;
            const isPending = pendingOrder && buyingPackId === pack.id;
            return (
              <div
                key={pack.id}
                style={{
                  borderRadius: 16, padding: 16, marginBottom: 10,
                  border: pack.highlight ? "2px solid #14b8a6" : `1.5px solid ${colors.border}`,
                  background: colors.card,
                }}
              >
                {pack.highlight && (
                  <div style={{ display: "inline-block", background: "#0d9488", borderRadius: 8, padding: "3px 8px", marginBottom: 8 }}>
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>⭐ {t("bestValue", "Best Value")}</span>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 26 }}>{pack.emoji ?? "⚡"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: colors.text, fontSize: 15, fontWeight: 900 }}>{pack.name}</div>
                    <div style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                      {totalCredits} credits{(pack.bonusCredits ?? 0) > 0 ? ` (+${pack.bonusCredits} bonus)` : ""}
                    </div>
                  </div>
                  {!isPending && <span style={{ color: colors.text, fontSize: 18, fontWeight: 900 }}>₹{rupees.toLocaleString("en-IN")}</span>}
                </div>
                <div style={{ marginTop: 12 }}>
                  {isPending ? (
                    <RazorpayCheckout
                      orderId={pendingOrder.orderId}
                      amount={pendingOrder.amountPaise}
                      description={`${pendingOrder.packName} — Instant Help Credits`}
                      onSuccess={handleSuccess}
                      onError={handleError}
                    >
                      {`Pay ₹${(pendingOrder.amountPaise / 100).toLocaleString("en-IN")}`}
                    </RazorpayCheckout>
                  ) : (
                    <button
                      className="ih-btn"
                      onClick={() => handleBuy(pack)}
                      disabled={!!buyingPackId}
                      style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#0f766e,#14b8a6)", color: "#fff", fontSize: 14, fontWeight: 800 }}
                    >
                      {isBuying ? "Preparing checkout…" : t("buy", "Buy")}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {transactions.length > 0 && (
          <>
            <div style={{ color: colors.text, fontSize: 15, fontWeight: 800, margin: "20px 0 12px" }}>{t("recentActivity", "Recent Activity")}</div>
            {transactions.map((tx) => (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.card, padding: 12, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: tx.type === "CREDIT" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)" }}>
                  <span style={{ fontSize: 14 }}>{tx.type === "CREDIT" ? "+" : "⚡"}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: colors.text, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.title}</div>
                  <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                    {formatTxDate(tx.createdAt)}{tx.status === "REVERSED" ? " · refunded" : ""}
                  </div>
                </div>
                <div style={{ color: tx.type === "CREDIT" ? "#10b981" : colors.text, fontSize: 14, fontWeight: 800 }}>
                  {tx.type === "CREDIT" ? "+" : "−"}{tx.amount}
                </div>
              </div>
            ))}
          </>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}
