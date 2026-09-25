"use client";
// PATH: apps/web/src/app/(app)/ai-guru/credits/page.tsx
// AI Guru pay-as-you-go credits — balance, pack grid, ledger. Mirrors
// apps/mobile/app/ai-guru/credits.tsx's scope and layout style (matches
// the subscription page's visual language, not the V-Coins wallet's —
// different, unrelated currency/leaderboard concept).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAppConfig } from "@/context/AppConfigContext";
import { useTheme } from "@/context/ThemeContext";
import { RazorpayCheckout } from "@/components/RazorpayCheckout";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";
import {
  CreditTransaction,
  createCreditOrder,
  subscribeToCreditBalance,
  subscribeToCreditTransactions,
} from "@/services/aiGuruCreditsService";
import type { CreditPack } from "@/context/AppConfigContext";

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

export default function AiGuruCreditsPage() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { creditPacks, configLoading } = useAppConfig();

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubBal = subscribeToCreditBalance(uid, setBalance);
    const unsubTx  = subscribeToCreditTransactions(uid, setTransactions);
    return () => { unsubBal(); unsubTx(); };
  }, []);

  async function handleBuy(pack: CreditPack) {
    if (!auth.currentUser) {
      setMsg("Please log out and log in again.");
      return;
    }
    setBuyingPackId(pack.id);
    setMsg("");
    try {
      await auth.currentUser.getIdToken(true);
      const order = await createCreditOrder(pack.id);
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
      await fetch(`${CLOUD_FUNCTION_URL}/aiGuruCreditPaymentSuccess`, {
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
      console.error("aiGuruCreditPaymentSuccess call failed:", e?.message);
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
    <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#060612,#0d0d24,#060612)" : colors.background, paddingBottom: 40 }}>
      <style>{`.sub-btn{cursor:pointer}.sub-btn:hover{opacity:.9}.sub-btn:disabled{cursor:default;opacity:.5}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12, position: "sticky", top: 0, zIndex: 10, background: isDarkMode ? "rgba(6,6,18,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}>
        <button className="sub-btn" onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 20, fontWeight: 900 }}>‹</button>
        <span style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: 900 }}>AI Guru Credits</span>
        <button className="sub-btn" onClick={() => router.push("/ai-guru/subscription")} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(251,191,36,0.15)", border: "1px solid #fbbf24", borderRadius: 10, padding: "4px 10px" }}>
          <span style={{ fontSize: 12 }}>✨</span>
          <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 900 }}>Go Unlimited</span>
        </button>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 16px" }}>

        {/* Balance hero */}
        <div style={{ borderRadius: 20, padding: 24, marginBottom: 20, textAlign: "center", background: "linear-gradient(135deg,#1e1b4b,#312e81,#4f46e5)" }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>⚡</div>
          <div style={{ color: "#fff", fontSize: 40, fontWeight: 900 }}>{balance ?? "—"}</div>
          <div style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>AI Guru credits</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>
            Pay only for what you use — no subscription needed. 1 credit unlocks one AI Guru
            action once you&apos;ve used today&apos;s free ones.
          </div>
        </div>

        {msg && (
          <div style={{ color: "#fca5a5", fontSize: 13, padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 12, lineHeight: 1.5 }}>
            {msg}
          </div>
        )}

        {/* Pack grid */}
        <div style={{ color: colors.text, fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Buy Credits</div>
        {configLoading ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: colors.textSecondary, fontSize: 14 }}>Loading…</div>
        ) : creditPacks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: colors.textSecondary, fontSize: 13 }}>
            Credit packs aren&apos;t available right now. Check back soon!
          </div>
        ) : (
          creditPacks.map((pack) => {
            const totalCredits = pack.credits + (pack.bonusCredits ?? 0);
            const rupees = pack.pricePaise / 100;
            const [g0, g1] = pack.gradient;
            const isBuying = buyingPackId === pack.id;
            const isPending = pendingOrder && buyingPackId === pack.id;
            return (
              <div
                key={pack.id}
                style={{
                  borderRadius: 16, padding: 16, marginBottom: 10,
                  border: pack.highlight ? "2px solid #fbbf24" : "1.5px solid transparent",
                  background: `linear-gradient(135deg,${g0},${g1})`,
                }}
              >
                {pack.highlight && (
                  <div style={{ display: "inline-block", background: "#f59e0b", borderRadius: 8, padding: "3px 8px", marginBottom: 8 }}>
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>⭐ Best Value</span>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 26 }}>{pack.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 900 }}>{pack.name}</div>
                    <div style={{ color: "#e0e7ff", fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                      {totalCredits} credits{pack.bonusCredits > 0 ? ` (+${pack.bonusCredits} bonus)` : ""}
                    </div>
                    {pack.description ? <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>{pack.description}</div> : null}
                  </div>
                  {!isPending && <span style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>₹{rupees.toLocaleString("en-IN")}</span>}
                </div>
                <div style={{ marginTop: 12 }}>
                  {isPending ? (
                    <RazorpayCheckout
                      orderId={pendingOrder.orderId}
                      amount={pendingOrder.amountPaise}
                      description={`${pendingOrder.packName} — AI Guru Credits`}
                      onSuccess={handleSuccess}
                      onError={handleError}
                    >
                      {`Pay ₹${(pendingOrder.amountPaise / 100).toLocaleString("en-IN")}`}
                    </RazorpayCheckout>
                  ) : (
                    <button
                      className="sub-btn"
                      onClick={() => handleBuy(pack)}
                      disabled={!!buyingPackId}
                      style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 14, fontWeight: 800 }}
                    >
                      {isBuying ? "Preparing checkout…" : "Buy"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Ledger */}
        {transactions.length > 0 && (
          <>
            <div style={{ color: colors.text, fontSize: 15, fontWeight: 800, margin: "20px 0 12px" }}>Recent Activity</div>
            {transactions.map((tx) => (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 14, border: `1px solid ${isDarkMode ? "#334155" : colors.border}`, background: isDarkMode ? "#1e293b" : colors.card, padding: 12, marginBottom: 8 }}>
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
