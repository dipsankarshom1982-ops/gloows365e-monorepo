// apps/tutor-mobile/app/(app)/payouts.tsx
// ShikshaHub Phase 5 — RN mirror of apps/tutor's payouts/page.tsx.

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorProfile, useTutorEarnings, usePayoutRequests, useTutorPayoutDetails } from "@gloows/shared-logic";
import { db, functions } from "@/lib/firebase";
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

export default function PayoutsScreen() {
  const { t } = useTranslation();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100, gap: spacing.lg }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary }}>{t("payoutsTitle", "Payouts")}</Text>

        <Card>
          <Text style={{ color: semantic.textMuted, fontSize: 12, fontWeight: "700" }}>{t("instantHelpEarnings", "Earnings balance")}</Text>
          <Text style={{ color: semantic.textPrimary, fontSize: 30, fontWeight: "900", marginTop: 4 }}>₹{balance ?? "—"}</Text>
        </Card>

        <Card>
          <Text style={{ color: semantic.textPrimary, fontWeight: "700", marginBottom: spacing.md }}>{t("payoutDetailsTitle", "Payout Details")}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
            {(["upi", "bank_transfer"] as PayoutMethod[]).map((m) => (
              <TouchableOpacity
                key={m} onPress={() => setMethod(m)}
                style={{ flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center", backgroundColor: method === m ? semantic.primary : semantic.surfaceElevated, borderWidth: method === m ? 0 : 1, borderColor: semantic.border }}
              >
                <Text style={{ color: method === m ? "#fff" : semantic.textSecondary, fontSize: 12, fontWeight: "700" }}>
                  {m === "upi" ? t("payoutMethodUpi", "UPI") : t("payoutMethodBank", "Bank Transfer")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input label={t("payoutAccountHolderLabel", "Account holder name")} value={accountHolderName} onChangeText={setAccountHolderName} />
          {method === "upi" ? (
            <Input label={t("payoutUpiLabel", "UPI ID")} placeholder="name@bank" value={upiId} onChangeText={setUpiId} />
          ) : (
            <>
              <Input label={t("payoutAccountNumberLabel", "Account number")} value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />
              <Input label={t("payoutIfscLabel", "IFSC code")} value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} autoCapitalize="characters" />
            </>
          )}
          {detailsError ? <Text style={{ color: semantic.danger, fontSize: 12, fontWeight: "600", marginBottom: spacing.sm }}>{detailsError}</Text> : null}
          {detailsSaved ? <Text style={{ color: semantic.success, fontSize: 12, fontWeight: "600", marginBottom: spacing.sm }}>{t("payoutDetailsSaved", "Saved.")}</Text> : null}
          <Button title={savingDetails ? t("saving", "Saving…") : t("payoutDetailsSave", "Save Payout Details")} variant="secondary" onPress={handleSaveDetails} disabled={savingDetails || detailsLoading} />
        </Card>

        <Card>
          <Text style={{ color: semantic.textPrimary, fontWeight: "700" }}>{t("payoutRequestTitle", "Request a Payout")}</Text>
          <Text style={{ color: semantic.textMuted, fontSize: 11, marginTop: 2, marginBottom: spacing.md }}>
            {t("payoutMinimumNote", "Minimum")} ₹{minimumPayout ?? "—"} · {t("payoutCommissionNote", "Platform commission")} {commissionPercent ?? "—"}%
          </Text>
          <Input
            label={t("payoutAmountLabel", "Amount to withdraw (₹)")}
            keyboardType="numeric" value={amount} onChangeText={setAmount}
            editable={!hasOpenRequest}
          />
          {requestedNum > 0 && (
            <Text style={{ color: semantic.textMuted, fontSize: 12, marginTop: -8, marginBottom: spacing.md }}>
              {t("payoutYouReceive", "You'll receive")}: <Text style={{ color: semantic.textPrimary, fontWeight: "700" }}>₹{payoutPreview}</Text> ({t("payoutCommissionDeducted", "after")} ₹{commissionPreview} {t("payoutCommission", "commission")})
            </Text>
          )}
          {hasOpenRequest ? (
            <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "600", marginBottom: spacing.md }}>
              {t("payoutOpenRequestNote", "You already have a pending or approved payout request.")}
            </Text>
          ) : null}
          {requestError ? <Text style={{ color: semantic.danger, fontSize: 12, fontWeight: "600", marginBottom: spacing.sm }}>{requestError}</Text> : null}
          <Button
            title={requesting ? t("payoutRequesting", "Submitting…") : t("payoutRequestSubmit", "Request Payout")}
            onPress={handleRequest}
            disabled={requesting || hasOpenRequest || requestedNum <= 0}
          />
        </Card>

        <View>
          <Text style={{ color: semantic.textPrimary, fontWeight: "700", marginBottom: spacing.md }}>{t("payoutHistoryTitle", "History")}</Text>
          {requestsLoading ? (
            <LoadingState />
          ) : requests.length === 0 ? (
            <Text style={{ color: semantic.textMuted, fontSize: 13 }}>{t("payoutNoHistory", "No payout requests yet.")}</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {requests.map((r) => (
                <Card key={r.id}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ color: semantic.textPrimary, fontWeight: "700" }}>₹{r.requestedAmount}</Text>
                      <Text style={{ color: semantic.textMuted, fontSize: 11, marginTop: 2 }}>
                        {t("payoutYouReceive", "You'll receive")} ₹{r.payoutAmount} ({r.commissionPercent}% {t("payoutCommission", "commission")})
                      </Text>
                    </View>
                    <Badge label={r.status} tone={STATUS_TONE[r.status] ?? "default"} />
                  </View>
                  {r.adminNote ? <Text style={{ color: semantic.textMuted, fontSize: 11, marginTop: spacing.sm, fontStyle: "italic" }}>{r.adminNote}</Text> : null}
                  {r.status === "pending" && (
                    <TouchableOpacity
                      onPress={() => handleCancel(r.id!)}
                      disabled={actingOn === r.id}
                      style={{ marginTop: spacing.sm, borderRadius: 8, backgroundColor: semantic.surfaceElevated, borderWidth: 1, borderColor: semantic.border, paddingVertical: 8, alignItems: "center", opacity: actingOn === r.id ? 0.5 : 1 }}
                    >
                      <Text style={{ color: semantic.danger, fontSize: 12, fontWeight: "700" }}>{t("cancelRequest", "Cancel Request")}</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}
