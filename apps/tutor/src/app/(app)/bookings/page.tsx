"use client";
// apps/tutor/src/app/(app)/bookings/page.tsx
// ShikshaHub Phase 1 — Booking Requests. Focused screen only (per the
// approved Phase 1 scope: no full dashboard redesign) showing incoming
// bookings/{id} docs addressed to this tutor (useTutorBookings — same
// onSnapshot-hook shape as useTutorStudents/useTutorBatches, but this
// collection is deliberately NOT tutorStudents/tutorBatches/tutorClasses;
// see the Phase 1 architecture audit for why marketplace bookings and the
// private CRM stay separate).
//
// Accept/Decline call respondToBooking (Admin-SDK callable) — this page
// never writes bookings/{id} directly, matching firestore.rules'
// `allow write: if false` on that collection. No payout/earnings math
// here yet — that's later-phase scope.

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useTutorBookings, useTutorProfile, type Booking } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Badge, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const STATUS_TONE: Record<Booking["status"], "default" | "success" | "warning" | "danger"> = {
  requested: "warning",
  accepted:  "success",
  declined:  "danger",
  cancelled: "default",
};

const respondToBookingCall = httpsCallable<
  { bookingId: string; action: "accepted" | "declined" },
  { status: Booking["status"] }
>(functions, "respondToBooking");

export default function BookingsPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { bookings, loading } = useTutorBookings(user?.uid);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function respond(bookingId: string, action: "accepted" | "declined") {
    setActingOn(bookingId);
    setRowError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      await respondToBookingCall({ bookingId, action });
      // No local status mutation needed — useTutorBookings' onSnapshot
      // listener picks up the callable's Admin-SDK write automatically.
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [bookingId]: e?.message ?? "Could not update this booking." }));
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">
          {t("shikshaHubBookingRequestsTitle", "Booking Requests")}
        </h1>

        {loading ? (
          <LoadingState />
        ) : bookings.length === 0 ? (
          <EmptyState
            title={t("shikshaHubNoBookingsTitle", "No booking requests yet")}
            subtitle={t("shikshaHubNoBookingsSubtitle", "Students who request a session on ShikshaHub will show up here.")}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {bookings.map((b) => (
              <Card key={b.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-100">{b.studentName || "Student"}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {b.subject} · {b.sessionType === "trial" ? t("shikshaHubTrial", "Trial") : t("shikshaHubRegular", "Regular")}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                </div>

                <div className="mt-3 flex flex-col gap-1 text-xs text-slate-400">
                  <span>📅 {b.requestedDate}</span>
                  <span>🕐 {b.requestedStartTime} – {b.requestedEndTime}</span>
                  <span>₹{b.sessionFee}</span>
                </div>

                {b.status === "requested" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => respond(b.id!, "accepted")}
                      disabled={actingOn === b.id}
                      className="flex-1 rounded-lg bg-success/90 hover:bg-success text-white text-xs font-bold py-2 disabled:opacity-50"
                    >
                      {t("shikshaHubAccept", "Accept")}
                    </button>
                    <button
                      onClick={() => respond(b.id!, "declined")}
                      disabled={actingOn === b.id}
                      className="flex-1 rounded-lg bg-surface2 hover:bg-slate-600 border border-slate-600 text-slate-100 text-xs font-bold py-2 disabled:opacity-50"
                    >
                      {t("shikshaHubDecline", "Decline")}
                    </button>
                  </div>
                )}

                {rowError[b.id!] && (
                  <p className="text-danger text-xs font-semibold mt-2">{rowError[b.id!]}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
