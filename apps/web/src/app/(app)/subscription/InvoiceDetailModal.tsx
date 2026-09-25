"use client";

// PATH: apps/web/src/app/(app)/subscription/InvoiceDetailModal.tsx
// Read-only invoice detail view — adapted from apps/mobile/app/invoice-details.tsx
// as a centered modal instead of a separate route (same modal pattern as
// apps/web/src/app/(app)/shikshahub/InstantTutorPanel.tsx: centered, not a
// bottom sheet, Escape/backdrop close, role="dialog").
//
// Deliberately NOT a second backend fetch — functions/src/billingHistory.ts
// only exposes a paginated LIST (getMyInvoices), not a get-by-id endpoint.
// The invoice passed in here is the exact record already returned by that
// call; nothing here is trusted from a fresher source, nor does it need to
// be.

import { useEffect } from "react";
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  invoiceStatusLabel,
  planDisplayName,
  type InvoiceRecord,
} from "@/services/billingService";
import { useTheme } from "@/context/ThemeContext";

function statusColor(status: string): string {
  switch (status) {
    case "paid": return "#22c55e";
    case "pending": return "#f59e0b";
    case "failed": return "#ef4444";
    default: return "#94a3b8";
  }
}

function Row({ label, value, colors }: { label: string; value: string; colors: { text: string; textSecondary: string } }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.text, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function InvoiceDetailModal({
  invoice, onClose,
}: {
  invoice: InvoiceRecord;
  onClose: () => void;
}) {
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Only ever populated once a real Razorpay invoice document exists —
  // absent here means absent, not "loading". No fake "Download PDF"
  // button is shown when both are null (matches mobile's exact behavior).
  const documentUrl = invoice.invoiceUrl ?? invoice.shortUrl;
  const color = statusColor(invoice.status);
  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invoice details"
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(440px, calc(100vw - 32px))", maxHeight: "min(640px, calc(100vh - 64px))",
          overflowY: "auto", background: surfaceBg, border: `1px solid ${borderCol}`,
          borderRadius: 20, padding: 24, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>Invoice</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "none", cursor: "pointer", color: colors.textSecondary, fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Summary */}
        <div style={{ border: `1px solid ${borderCol}`, borderRadius: 16, padding: 18, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: colors.accent, letterSpacing: 0.5 }}>Gloows365</div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: colors.textSecondary }}>Invoice #{invoice.invoiceId}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: colors.text, marginTop: 4 }}>
            {formatInvoiceAmount(invoice.totalAmountPaise, invoice.currency)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: `${color}1a`, marginTop: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{invoiceStatusLabel(invoice.status)}</span>
          </div>
        </div>

        {/* Subscription */}
        <div style={{ border: `1px solid ${borderCol}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>Subscription</div>
          <Row label="Plan" value={planDisplayName(invoice)} colors={colors} />
          {(invoice.billingPeriodStart || invoice.billingPeriodEnd) && (
            <Row
              label="Billing period"
              value={`${formatInvoiceDate(invoice.billingPeriodStart)} – ${formatInvoiceDate(invoice.billingPeriodEnd)}`}
              colors={colors}
            />
          )}
        </div>

        {/* Payment */}
        <div style={{ border: `1px solid ${borderCol}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>Payment</div>
          <Row label="Amount" value={formatInvoiceAmount(invoice.totalAmountPaise, invoice.currency)} colors={colors} />
          <Row label="Currency" value={invoice.currency} colors={colors} />
          <Row label="Status" value={invoiceStatusLabel(invoice.status)} colors={colors} />
          {invoice.issuedAt && <Row label="Invoice date" value={formatInvoiceDate(invoice.issuedAt)} colors={colors} />}
          {invoice.paidAt && <Row label="Paid on" value={formatInvoiceDate(invoice.paidAt)} colors={colors} />}
        </div>

        {/* No tax section — this record carries no GST/tax fields; none
            are invented, and omitted rather than shown as "N/A". */}

        {documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "13px 0", borderRadius: 14, background: colors.accent, color: "#fff",
              fontSize: 14, fontWeight: 800, textDecoration: "none",
            }}
          >
            📄 View Invoice
          </a>
        ) : (
          <div style={{ display: "flex", gap: 8, border: `1px dashed ${borderCol}`, borderRadius: 14, padding: 14 }}>
            <span style={{ color: colors.textSecondary, fontSize: 14 }}>ℹ️</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: colors.textSecondary, lineHeight: 1.5 }}>
              Invoice details are shown here — no separate document is available for this payment.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
