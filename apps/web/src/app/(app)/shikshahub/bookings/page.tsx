"use client";

// PATH: apps/web/src/app/(app)/shikshahub/bookings/page.tsx
// ShikshaHub Phase 2 — "My Bookings". Every booking the signed-in student
// has ever requested (useStudentBookings — same onSnapshot-hook shape as
// apps/tutor's useTutorBookings, just scoped by studentUid instead of
// tutorUid). Lets the student cancel a "requested"/"accepted" booking
// (cancelBookingCall) — any party can cancel per the approved Phase 2
// scope. Never writes bookings/{id} directly; the callable is the only
// path, matching firestore.rules' `allow write: if false`.

import { useState } from "react";
import Link from "next/link";
import { useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile, type Booking } from "@gloows/shared-logic";
import { useStudentBookings } from "@gloows/shared-logic";
import { cancelBookingCall } from "@/lib/shikshahub";
import { ShikshaHubStyles } from "../_shared";

const STATUS_META: Record<Booking["status"], { label: string; color: string }> = {
  requested: { label: "Requested", color: "#f59e0b" },
  accepted:  { label: "Accepted",  color: "#22c55e" },
  declined:  { label: "Declined",  color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "var(--text-muted)" },
};

export default function ShikshaHubMyBookingsPage() {
  const { t } = useAppTranslation();
  const { user } = useStudentProfile();
  const { bookings, loading } = useStudentBookings(user?.uid);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [rowError, setRowError]     = useState<Record<string, string>>({});

  async function handleCancel(bookingId: string) {
    setCancelling(bookingId);
    setRowError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      await cancelBookingCall(bookingId);
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [bookingId]: e?.message ?? "Could not cancel this booking." }));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 60 }}>
      <ShikshaHubStyles />
      <div className="shikshahub-container" style={{ padding: "20px 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
            {t("shikshaHubMyBookingsTitle", "My Bookings")}
          </span>
          <Link
            href="/shikshahub"
            style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
          >
            {t("browseShikshaHub", "Browse ShikshaHub")}
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40 }}>🎓</div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
              {t("shikshaHubNoMyBookings", "You haven't booked a tutor yet.")}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bookings.map((b) => {
              const meta = STATUS_META[b.status];
              const cancellable = b.status === "requested" || b.status === "accepted";
              return (
                <div
                  key={b.id}
                  style={{
                    border: "1px solid var(--border)", borderRadius: 16,
                    background: "var(--bg-card)", padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
                        {b.tutorName || "Tutor"}
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", marginTop: 2 }}>
                        {b.subject} · {b.sessionType === "trial" ? t("shikshaHubTrial", "Trial") : t("shikshaHubRegular", "Regular")}
                      </div>
                    </div>
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                        fontSize: 11, fontWeight: 700, color: meta.color,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }} />
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    <span>{b.requestedDate}</span>
                    <span>{b.requestedStartTime} – {b.requestedEndTime}</span>
                    <span>₹{b.sessionFee}</span>
                  </div>

                  {cancellable && (
                    <button
                      onClick={() => handleCancel(b.id!)}
                      disabled={cancelling === b.id}
                      style={{
                        marginTop: 12, border: "1px solid var(--border)", background: "var(--bg)",
                        color: "var(--text)", borderRadius: 10, padding: "8px 14px",
                        fontSize: 12, fontWeight: 700, cursor: cancelling === b.id ? "not-allowed" : "pointer",
                        opacity: cancelling === b.id ? 0.6 : 1,
                      }}
                    >
                      {cancelling === b.id ? t("shikshaHubCancelling", "Cancelling…") : t("shikshaHubCancelBooking", "Cancel booking")}
                    </button>
                  )}

                  {rowError[b.id!] && (
                    <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "#ef4444" }}>
                      {rowError[b.id!]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
