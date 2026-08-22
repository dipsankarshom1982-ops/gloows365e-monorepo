"use client";

// PATH: apps/web/src/app/(app)/shikshahub/bookings/page.tsx
// ShikshaHub Phase 2 — "My Bookings". Every booking the signed-in student
// has ever requested (useStudentBookings — same onSnapshot-hook shape as
// apps/tutor's useTutorBookings, just scoped by studentUid instead of
// tutorUid). Lets the student cancel a "requested"/"accepted" booking
// (cancelBookingCall) — any party can cancel per the approved Phase 2
// scope. Never writes bookings/{id} directly; the callable is the only
// path, matching firestore.rules' `allow write: if false`.

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile, type Booking } from "@gloows/shared-logic";
import { useStudentBookings } from "@gloows/shared-logic";
import { cancelBookingCall, submitBookingReviewCall } from "@/lib/shikshahub";
import { ShikshaHubStyles } from "../_shared";

const STATUS_META: Record<Booking["status"], { label: string; color: string }> = {
  requested: { label: "Requested", color: "#f59e0b" },
  accepted:  { label: "Accepted",  color: "#22c55e" },
  declined:  { label: "Declined",  color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "var(--text-muted)" },
  // Booking completion phase.
  completed: { label: "Completed", color: "#0d9488" },
};

// Booking completion phase — inline "leave a review" form for a completed
// booking with no review yet. Same star-rating shape as Phase 6's
// InstantHelpBar review prompt, just embedded per-row instead of a
// floating global widget (bookings are discovered on this list, not via
// a "just ended" live moment the way an Instant Help session is).
function BookingReviewCta({ bookingId }: { bookingId: string }) {
  const { t } = useAppTranslation();
  const [checked, setChecked] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDoc(doc(db, "tutorReviews", bookingId))
      .then((snap) => setAlreadyReviewed(snap.exists()))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [bookingId]);

  async function submit() {
    if (rating < 1) return;
    setSubmitting(true);
    setError("");
    try {
      await submitBookingReviewCall(bookingId, rating, reviewText.trim() || undefined);
      setSubmitted(true);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!checked || alreadyReviewed || submitted) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 12, border: "1px solid #0d9488", background: "rgba(13,148,136,0.08)",
          color: "#0d9488", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        {t("shikshaHubLeaveReview", "⭐ Leave a review")}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)" }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, opacity: n <= rating ? 1 : 0.3, padding: 0 }}
          >
            ⭐
          </button>
        ))}
      </div>
      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        placeholder={t("shikshaHubReviewTextPlaceholder", "Optional: share more about your experience")}
        maxLength={1000}
        rows={3}
        style={{
          marginTop: 8, width: "100%", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--bg-card)", color: "var(--text)", fontSize: 12, padding: 8, resize: "vertical",
        }}
      />
      {error && <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: "#ef4444" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => setOpen(false)}
          style={{ flex: 1, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          {t("shikshaHubReviewSkip", "Skip")}
        </button>
        <button
          onClick={submit}
          disabled={rating < 1 || submitting}
          style={{
            flex: 1, border: "none", background: "#0d9488", color: "#fff", borderRadius: 8, padding: "8px 0",
            fontSize: 12, fontWeight: 700, cursor: rating < 1 || submitting ? "not-allowed" : "pointer",
            opacity: rating < 1 || submitting ? 0.5 : 1,
          }}
        >
          {submitting ? t("shikshaHubReviewSubmitting", "Submitting…") : t("shikshaHubReviewSubmit", "Submit Review")}
        </button>
      </div>
    </div>
  );
}

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

                  {b.status === "completed" && <BookingReviewCta bookingId={b.id!} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
