// PATH: app/invoice-details.tsx
//
// Read-only invoice detail view. Receives the invoice the student already
// tapped on billing-history.tsx via a route param (JSON-serialized) —
// deliberately NOT a second backend fetch, since functions/src/billingHistory.ts
// only exposes a paginated LIST (getMyInvoices), not a get-by-id endpoint,
// and creating one just for this screen would be a second invoice API this
// phase was explicitly told not to build. The data was already
// server-verified and owner-scoped by getMyInvoices; nothing here is
// trusted from a fresher source, nor does it need to be — it's the exact
// same record, just rendered full-screen.

import Header from "@/components/header";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  invoiceStatusLabel,
  planDisplayName,
  type InvoiceRecord,
} from "@/services/billingService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const params = useLocalSearchParams<{ invoice?: string }>();

  const invoice = useMemo<InvoiceRecord | null>(() => {
    if (!params.invoice) return null;
    try {
      return JSON.parse(params.invoice) as InvoiceRecord;
    } catch {
      return null;
    }
  }, [params.invoice]);

  const pageBg    = isDarkMode ? "#0a0a1a" : colors.background;
  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;

  // Malformed/missing param — a deep-link or a stale navigation state, not
  // a real invoice. Honest error, not a crash.
  if (!invoice) {
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
