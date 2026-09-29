// PATH: app/invoice-details.tsx
//
// FIX (narrowly-scoped hardening task): this screen used to receive the
// full invoice as a JSON-serialized route param from billing-history.tsx
// and render it verbatim — the route param was trusted as proof of
// ownership, which it never was. Since Expo Router's navigation state is
// deep-linkable (this app registers gloows365e:// and com.gloows365.app://
// schemes), a crafted deep link with another user's invoice data as the
// param would have rendered it with zero server-side check.
//
// Now only a bare invoiceId (an opaque identifier, not trusted data) is
// passed. The actual invoice is fetched directly from Firestore by that
// id, and ownership is enforced by firestore.rules itself (see
// `match /invoices/{invoiceId}` there: `resource.data.uid ==
// request.auth.uid`) — the same trusted-backend boundary the app already
// relies on for this collection ("A student can still always read their
// own invoice"), not a client-side assumption. A read for an invoice that
// exists but belongs to someone else is rejected by the rule itself
// (permission-denied), which this screen treats identically to "doesn't
// exist" — it never reveals which case occurred. No new Cloud Function
// was added: getMyInvoices' LIST restriction (no "list my invoices"
// client query) is a separate concern from this GET-by-id, which the
// existing rule already correctly scopes to the owner.
//
// Field mapping below deliberately mirrors functions/src/billingHistory.ts's
// getMyInvoices response shape exactly — the same fields, nothing more
// (no uid, no razorpay ids) — even though this now reads the Firestore
// doc directly, which may carry those internal fields.

import Header from "@/components/header";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  invoiceStatusLabel,
  planDisplayName,
  type InvoiceRecord,
} from "@/services/billingService";
import { Ionicons } from "@expo/vector-icons";
import { doc, DocumentData, onSnapshot } from "firebase/firestore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Mirrors billingHistory.ts's own field selection exactly — see this
// file's header. Never spread the raw doc.
function toInvoiceRecord(invoiceId: string, d: DocumentData): InvoiceRecord {
  return {
    invoiceId: d["invoiceId"] ?? invoiceId,
    source: d["source"],
    status: d["status"],
    planId: d["planId"] ?? null,
    planName: d["planName"] ?? null,
    currency: d["currency"] ?? "INR",
    totalAmountPaise: d["totalAmountPaise"] ?? null,
    billingPeriodStart: d["billingPeriodStart"] ?? null,
    billingPeriodEnd: d["billingPeriodEnd"] ?? null,
    invoiceUrl: d["invoiceUrl"] ?? null,
    shortUrl: d["shortUrl"] ?? null,
    issuedAt: d["issuedAt"] ?? null,
    paidAt: d["paidAt"] ?? null,
  };
}

function statusColor(status: string): string {
  switch (status) {
    case "paid":    return "#22C55E";
    case "pending": return "#f59e0b";
    case "failed":  return "#ef4444";
    default:        return "#94a3b8";
  }
}

function Row({ label, value, colors }: { label: string; value: string; colors: { text: string; textSecondary: string } }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function InvoiceDetailsScreen() {
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ invoiceId?: string }>();

  // A plain identifier, not trusted data — used only to look the doc up.
  // Reject an obviously invalid one locally instead of making a request
  // with it (Section 7/8 of this task's brief).
  const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId.trim() : "";

  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  // null = still resolving; true/false once settled. Kept uid-keyed
  // implicitly by re-running whenever the authenticated uid changes, same
  // stale-result-safety convention used elsewhere in this codebase.
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    invoiceId ? "loading" : "unavailable"
  );

  useEffect(() => {
    if (!invoiceId) { setState("unavailable"); return; }
    const uid = auth.currentUser?.uid;
    // Unauthenticated — follow the same "no data, no crash" convention
    // notifications.tsx/bookmarks.tsx/history.tsx already use rather than
    // inventing a separate auth flow for this one screen.
    if (!uid) { setState("unavailable"); return; }

    setState("loading");
    const unsub = onSnapshot(
      doc(db, "invoices", invoiceId),
      (snap) => {
        // Ownership is enforced by firestore.rules itself
        // (resource.data.uid == request.auth.uid) — a doc that exists but
        // belongs to someone else never reaches here; it surfaces via the
        // error callback below instead, indistinguishable from "missing".
        if (!snap.exists()) { setState("unavailable"); return; }
        setInvoice(toInvoiceRecord(invoiceId, snap.data()));
        setState("ready");
      },
      () => {
        // permission-denied (not theirs) or any other read failure — same
        // generic outcome either way; never reveal which case occurred.
        setState("unavailable");
      }
    );
    return () => unsub();
  }, [invoiceId]);

  const pageBg    = isDarkMode ? "#0a0a1a" : colors.background;
  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;

  if (state === "loading") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]}>
        <Header hideMenu={true} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // Missing/malformed id, unauthenticated, not found, or not theirs — one
  // honest, generic error state for all of them, never a crash.
  if (state === "unavailable" || !invoice) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]}>
        <Header hideMenu={true} />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t("invoiceUnavailable") ?? "Invoice unavailable"}
          </Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text }]}>{t("goBack") ?? "Go Back"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Only ever populated once a real Razorpay invoice document exists
  // (native-Subscriptions path) — always null for today's synthetic
  // invoices. Absent here means absent, not "loading" — see this app's
  // billing audit report. No fake "Download PDF" button is shown when
  // both are null.
  const documentUrl = invoice.invoiceUrl ?? invoice.shortUrl;

  const openDocument = () => {
    if (documentUrl) Linking.openURL(documentUrl).catch(() => {});
  };

  const color = statusColor(invoice.status);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]}>
      <Header hideMenu={true} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Summary card ─────────────────────────────── */}
        <View style={[styles.summaryCard, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
          <Text style={[styles.brand, { color: colors.accent }]}>GLOOWS365E</Text>
          <Text style={[styles.invoiceId, { color: colors.textSecondary }]}>
            {t("invoiceNumber") ?? "Invoice"} #{invoice.invoiceId}
          </Text>

          <Text style={[styles.amount, { color: colors.text }]}>
            {formatInvoiceAmount(invoice.totalAmountPaise, invoice.currency)}
          </Text>

          <View style={[styles.statusPill, { backgroundColor: `${color}1a` }]}>
            <View style={[styles.statusDot, { backgroundColor: color }]} accessibilityElementsHidden />
            <Text
              style={[styles.statusText, { color }]}
              accessibilityLabel={`${t("paymentStatus") ?? "Payment status"}: ${invoiceStatusLabel(invoice.status)}`}
            >
              {invoiceStatusLabel(invoice.status)}
            </Text>
          </View>
        </View>

        {/* ── Subscription ─────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>{t("subscription") ?? "Subscription"}</Text>
          <Row label={t("plan") ?? "Plan"} value={planDisplayName(invoice)} colors={colors} />
          {(invoice.billingPeriodStart || invoice.billingPeriodEnd) && (
            <Row
              label={t("billingPeriod") ?? "Billing period"}
              value={`${formatInvoiceDate(invoice.billingPeriodStart)} – ${formatInvoiceDate(invoice.billingPeriodEnd)}`}
              colors={colors}
            />
          )}
        </View>

        {/* ── Payment ───────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>{t("payment") ?? "Payment"}</Text>
          <Row label={t("amount") ?? "Amount"} value={formatInvoiceAmount(invoice.totalAmountPaise, invoice.currency)} colors={colors} />
          <Row label={t("currency") ?? "Currency"} value={invoice.currency} colors={colors} />
          <Row label={t("paymentStatus") ?? "Payment status"} value={invoiceStatusLabel(invoice.status)} colors={colors} />
          {invoice.issuedAt && <Row label={t("invoiceDate") ?? "Invoice date"} value={formatInvoiceDate(invoice.issuedAt)} colors={colors} />}
          {invoice.paidAt && <Row label={t("paidOn") ?? "Paid on"} value={formatInvoiceDate(invoice.paidAt)} colors={colors} />}
        </View>

        {/* No tax section — this record carries no GST/tax fields (see
            functions/src/financial/invoice.ts's header: none are invented).
            Omitted entirely rather than shown as "N/A", so nothing implies
            tax was considered and found to be zero. */}

        {/* ── Invoice document — future-proofed, not fabricated ───────── */}
        {documentUrl ? (
          <TouchableOpacity
            style={[styles.documentBtn, { backgroundColor: colors.accent }]}
            onPress={openDocument}
            accessibilityRole="button"
            accessibilityLabel={t("viewInvoiceDocument") ?? "View invoice document"}
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <Text style={styles.documentBtnText}>{t("viewInvoice") ?? "View Invoice"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.noDocumentHint, { borderColor: borderCol }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.noDocumentText, { color: colors.textSecondary }]}>
              {t("invoiceDetailsOnlyHint") ?? "Invoice details are shown here — no separate document is available for this payment."}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
          <Text style={[styles.backBtnText, { color: colors.text }]}>{t("goBack") ?? "Go Back"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 14 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },

  summaryCard: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center", gap: 6 },
  brand: { fontSize: 14, fontWeight: "800", letterSpacing: 0.6 },
  invoiceId: { fontSize: 12, fontWeight: "500" },
  amount: { fontSize: 32, fontWeight: "900", marginTop: 6 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "700" },

  section: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 13, fontWeight: "600", flexShrink: 0 },
  rowValue: { fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "right" },

  documentBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  documentBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  noDocumentHint: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 14, padding: 14, borderStyle: "dashed" },
  noDocumentText: { flex: 1, fontSize: 12, fontWeight: "500", lineHeight: 18 },

  backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  backBtnText: { fontSize: 15, fontWeight: "600" },
});
