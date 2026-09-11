"use client";
// apps/tutor/src/app/(app)/payouts/page.tsx
// ShikshaHub Phase 5 — tutor earnings payout. Mirrors services/page.tsx's
// structure (useTutorProfile for uid, inline httpsCallable per this app's
// convention). Three sections: earnings balance + payout-details form,
// request-a-payout form (with a live commission preview read from
// payoutConfig/settings), and request history.

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useTutorProfile, useTutorEarnings, usePayoutRequests, useTutorPayoutDetails } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Badge, Button, Card, Input, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

type PayoutMethod = "bank_transfer" | "upi";

const saveTutorPayoutDetailsCall = httpsCallable<
  { method: PayoutMethod; accountHolderName: string; accountNumber?: string; ifsc?: string; upiId?: string },
  { saved: boolean }
>(functions, "saveTutorPayoutDetails");

const requestPayoutCall = httpsCallable<
  { requestedAmount: number },
  { requestId: string; status: string; commissionAmount: number; payoutAmount: number }
>(functions, "requestPayout");

const cancelPayoutRequestCall = httpsCallable<{ requestId: string }, { status: string }>(functions, "cancelPayoutRequest");

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  pending: "warning", approved: "default", paid: "success", rejected: "danger", cancelled: "default",
};

export default function PayoutsPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { balance } = useTutorEarnings();
  const { requests, loading: requestsLoading } = usePayoutRequests(user?.uid);
  const { details, loading: detailsLoading } = useTutorPayoutDetails(user?.uid);

  const [method, setMethod] = useState<PayoutMethod>("upi");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upiId, setUpiId] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [commissionPercent, setCommissionPercent] = useState<number | null>(null);
  const [minimumPayout, setMinimumPayout] = useState<number | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    if (details) {
      setMethod(details.method ?? "upi");
      setAccountHolderName(details.accountHolderName ?? "");
      setAccountNumber(details.accountNumber ?? "");
      setIfsc(details.ifsc ?? "");
      setUpiId(details.upiId ?? "");
    }
  }, [details]);

  useEffect(() => {
    getDoc(doc(db, "payoutConfig", "settings")).then((snap) => {
      const data = snap.data();
      setCommissionPercent(typeof data?.commissionPercent === "number" ? data.commissionPercent : 10);
      setMinimumPayout(typeof data?.minimumPayoutAmount === "number" ? data.minimumPayoutAmount : 100);
    }).catch(() => { setCommissionPercent(10); setMinimumPayout(100); });
  }, []);

  const hasOpenRequest = requests.some((r) => r.status === "pending" || r.status === "approved");
  const requestedNum = Number(amount) || 0;
  const commissionPreview = commissionPercent != null ? Math.round(requestedNum * commissionPercent / 100) : 0;
  const payoutPreview = requestedNum - commissionPreview;

  async function handleSaveDetails() {
    setSavingDetails(true);
    setDetailsError("");
    setDetailsSaved(false);
    try {
      await saveTutorPayoutDetailsCall({
        method,
        accountHolderName,
        ...(method === "bank_transfer" ? { accountNumber, ifsc } : { upiId }),
      });
      setDetailsSaved(true);
    } catch (e: any) {
      setDetailsError(e?.message ?? "Could not save payout details.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleRequest() {
    setRequesting(true);
    setRequestError("");
    try {
      await requestPayoutCall({ requestedAmount: requestedNum });
      setAmount("");
    } catch (e: any) {
      setRequestError(e?.message ?? "Could not submit payout request.");
    } finally {
      setRequesting(false);
    }
  }

  async function handleCancel(requestId: string) {
    setActingOn(requestId);
    try {
      await cancelPayoutRequestCall({ requestId });
    } catch (e: any) {
      setRequestError(e?.message ?? "Could not cancel request.");
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto flex flex-col gap-6">
        <h1 className="text-xl font-black text-slate-100">{t("payoutsTitle", "Payouts")}</h1>

        <Card>
          <p className="text-slate-400 text-xs font-semibold">{t("instantHelpEarnings", "Earnings balance")}</p>
          <p className="text-3xl font-black text-slate-100 mt-1">₹{balance ?? "—"}</p>
        </Card>

        <Card>
          <p className="font-bold text-slate-100 mb-3">{t("payoutDetailsTitle", "Payout Details")}</p>
          <div className="flex gap-2 mb-4">
            {(["upi", "bank_transfer"] as PayoutMethod[]).map((m) => (
              <button
                key={m} type="button" onClick={() => setMethod(m)}
                className={`flex-1 rounded-lg py-2 text-xs font-bold ${method === m ? "bg-brand-600 text-white" : "bg-surface2 text-slate-300 border border-slate-600"}`}
              >
                {m === "upi" ? t("payoutMethodUpi", "UPI") : t("payoutMethodBank", "Bank Transfer")}
              </button>
            ))}
          </div>
          <Input label={t("payoutAccountHolderLabel", "Account holder name")} value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
          {method === "upi" ? (
            <Input label={t("payoutUpiLabel", "UPI ID")} placeholder="name@bank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
          ) : (
            <>
              <Input label={t("payoutAccountNumberLabel", "Account number")} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              <Input label={t("payoutIfscLabel", "IFSC code")} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} />
            </>
          )}
          {detailsError && <p className="text-danger text-xs font-semibold mb-2">{detailsError}</p>}
          {detailsSaved && <p className="text-success text-xs font-semibold mb-2">{t("payoutDetailsSaved", "Saved.")}</p>}
          <Button variant="secondary" onClick={handleSaveDetails} disabled={savingDetails || detailsLoading}>
            {savingDetails ? t("saving", "Saving…") : t("payoutDetailsSave", "Save Payout Details")}
          </Button>
        </Card>

        <Card>
          <p className="font-bold text-slate-100 mb-1">{t("payoutRequestTitle", "Request a Payout")}</p>
          <p className="text-slate-500 text-xs mb-3">
            {t("payoutMinimumNote", "Minimum")} ₹{minimumPayout ?? "—"} · {t("payoutCommissionNote", "Platform commission")} {commissionPercent ?? "—"}%
          </p>
          <Input
            label={t("payoutAmountLabel", "Amount to withdraw (₹)")}
            type="number" min={1} value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={hasOpenRequest}
          />
          {requestedNum > 0 && (
            <div className="text-xs text-slate-400 mb-3 -mt-2">
              {t("payoutYouReceive", "You'll receive")}: <span className="text-slate-100 font-bold">₹{payoutPreview}</span> ({t("payoutCommissionDeducted", "after")} ₹{commissionPreview} {t("payoutCommission", "commission")})
            </div>
          )}
          {hasOpenRequest && (
            <p className="text-warning text-xs font-semibold mb-3">
              {t("payoutOpenRequestNote", "You already have a pending or approved payout request.")}
            </p>
          )}
          {requestError && <p className="text-danger text-xs font-semibold mb-2">{requestError}</p>}
          <Button
            onClick={handleRequest}
            disabled={requesting || hasOpenRequest || requestedNum <= 0}
          >
            {requesting ? t("payoutRequesting", "Submitting…") : t("payoutRequestSubmit", "Request Payout")}
          </Button>
        </Card>

        <div>
          <p className="font-bold text-slate-100 mb-3">{t("payoutHistoryTitle", "History")}</p>
          {requestsLoading ? (
            <LoadingState />
          ) : requests.length === 0 ? (
            <p className="text-slate-500 text-sm">{t("payoutNoHistory", "No payout requests yet.")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-100 font-bold">₹{r.requestedAmount}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {t("payoutYouReceive", "You'll receive")} ₹{r.payoutAmount} ({r.commissionPercent}% {t("payoutCommission", "commission")})
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[r.status] ?? "default"}>{r.status}</Badge>
                  </div>
                  {r.adminNote && <p className="text-slate-500 text-xs mt-2 italic">{r.adminNote}</p>}
                  {r.status === "pending" && (
                    <button
                      onClick={() => handleCancel(r.id!)}
                      disabled={actingOn === r.id}
                      className="mt-3 w-full rounded-lg bg-surface2 border border-slate-600 text-danger text-xs font-bold py-2 disabled:opacity-50"
                    >
                      {t("cancelRequest", "Cancel Request")}
                    </button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
