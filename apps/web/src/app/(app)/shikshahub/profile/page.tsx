"use client";

// PATH: apps/web/src/app/(app)/shikshahub/profile/page.tsx
// Specific-tutor landing page: /shikshahub/profile?id={uid}. Reads a query
// string, not a [uid] dynamic path segment, for the same reason
// glostore/product/page.tsx does — next.config.ts's output:"export" needs
// generateStaticParams() to enumerate every path at build time, impossible
// for an always-growing set of verified tutors. Mirrors
// apps/mobile/app/shikshahub/[uid].tsx (mobile has a real native router).
// No contact/enquiry action here — explicitly deferred, see the approved
// plan's Context section.
//
// UI-only redesign pass (data layer / fetchTutorById untouched): the old
// version used a 220px full-bleed "background image behind everything"
// hero with the back button absolutely-positioned on top of it, which read
// as the tutor photo running into AppHeader above it. Replaced with a
// bounded profile-card avatar (TutorAvatar) that sits in normal document
// flow below the header — it structurally cannot overlap it. Also switches
// to a 2-column layout on desktop (profile+about left, action card right,
// sticky) and stacks on mobile, per the approved redesign brief.
//
// ShikshaHub Phase 1 (minimum viable booking): the action card's
// "Book a Trial"/"Book Tutor" placeholders are now a real BookingPanel —
// subject/session-type/date/slot → requestBooking() → live status via
// listenToBooking(). "Contact Tutor" stays a disabled placeholder;
// messaging is still out of Phase 1's scope, unlike booking. No payment
// anywhere in this file — see requestBooking's own header comment for why.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  fetchTutorById,
  fetchTutorServices,
  requestBookingCall,
  cancelBookingCall,
  requestInstantHelpCall,
  listenToBooking,
  slotOptionsForDate,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import type { Booking, BookingSessionType, TutorService } from "@gloows/shared-logic";
import { useTutorReviews } from "@gloows/shared-logic";
import { ShikshaHubStyles, SubjectChips, TutorAvatar, VerifiedBadge } from "../_shared";

const SERVICE_TYPE_LABEL: Record<TutorService["serviceType"], string> = {
  one_time: "One-time",
  short_term: "Short-term",
  long_term: "Long-term",
  instant_help: "Instant Help",
};

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ShikshaHubProfileContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("id") ?? "";
  const router = useRouter();
  const { t } = useAppTranslation();
  const [tutor, setTutor]     = useState<MarketplaceTutor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) return;
    fetchTutorById(uid)
      .then((tu) => { if (tu) setTutor(tu); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Loading…</div>;
  }

  if (notFound || !tutor) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40 }}>🤔</div>
        <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 14, fontWeight: 600 }}>
          {t("shikshaHubNotFound", "This tutor profile isn't available anymore.")}
        </div>
        <button
          onClick={() => router.replace("/shikshahub")}
          style={{ marginTop: 12, background: "#14b8a6", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
        >
          {t("browseShikshaHub", "Browse ShikshaHub")}
        </button>
      </div>
    );
  }

  const hasMeta = !!tutor.qualification || tutor.teachingExperienceYears != null || !!tutor.preferredLanguage;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 60 }}>
      <ShikshaHubStyles />

      <div className="shikshahub-container" style={{ padding: "16px 16px 40px" }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "8px 14px", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          <span aria-hidden>‹</span> {t("back", "Back")}
        </button>

        <div className="shikshahub-detail-grid">
          {/* ── LEFT: profile + about ───────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              border: "1px solid var(--border)", borderRadius: 20, background: "var(--bg-card)",
              padding: 20, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start",
            }}>
              <TutorAvatar tutor={tutor} size={92} ring />

              <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 21, fontWeight: 900, color: "var(--text)" }}>
                    {tutor.name || "Tutor"}
                  </span>
                  <VerifiedBadge />
                  {tutor.ratingAverage != null && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
                      ⭐ {tutor.ratingAverage.toFixed(1)}
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>({tutor.ratingCount})</span>
                    </span>
                  )}
                </div>

                {hasMeta && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {!!tutor.qualification && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                        🎓 {tutor.qualification}
                      </span>
                    )}
                    {tutor.teachingExperienceYears != null && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                        ⏳ {tutor.teachingExperienceYears} years experience
                      </span>
                    )}
                    {!!tutor.preferredLanguage && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                        🗣️ {tutor.preferredLanguage}
                      </span>
                    )}
                  </div>
                )}

                {tutor.subjects.length > 0 && <SubjectChips subjects={tutor.subjects} />}
              </div>
            </div>

            {!!tutor.bio && (
              <div style={{
                border: "1px solid var(--border)", borderRadius: 20, background: "var(--bg-card)", padding: 20,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
                  {t("shikshaHubAboutTitle", "About the Tutor")}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: "21px", fontWeight: 500, color: "var(--text-muted)" }}>
                  {tutor.bio}
                </div>
              </div>
            )}

            <ReviewsSection tutorUid={tutor.uid} />
          </div>

          {/* ── RIGHT: action card ──────────────────────────────── */}
          <div className="shikshahub-action-card">
            <div style={{
              border: "1px solid rgba(20,184,166,0.35)", borderRadius: 20,
              background: "linear-gradient(180deg, rgba(20,184,166,0.09), var(--bg-card) 55%)",
              padding: 20, display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
                {t("shikshaHubInterested", "Interested in learning with")} {tutor.name || "this tutor"}?
              </div>

              <BookingPanel tutor={tutor} />

              <ActionButton label={t("shikshaHubContactTutor", "Contact Tutor")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ShikshaHub Phase 6 — non-hidden reviews for this tutor, off completed
 *  Instant Help sessions only (see functions/src/tutorReviews.ts's header
 *  comment). Renders nothing if there are none, same "hide fields that
 *  aren't available" rule this page already follows elsewhere. */
function ReviewsSection({ tutorUid }: { tutorUid: string }) {
  const { t } = useAppTranslation();
  const { reviews, loading } = useTutorReviews(tutorUid);

  if (loading || reviews.length === 0) return null;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 20, background: "var(--bg-card)", padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>
        {t("reviewsTitle", "Reviews")} ({reviews.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {reviews.map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{r.studentName || "Student"}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>{"⭐".repeat(r.rating)}</span>
            </div>
            {!!r.reviewText && (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: "19px" }}>{r.reviewText}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** UI-only placeholder — messaging has no backend yet (Phase 1 only
 *  covers booking, see this file's header comment), so this stays
 *  disabled rather than wired to fake behaviour. */
function ActionButton({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <button
      disabled
      title="Coming soon"
      style={{
        width: "100%", border: primary ? "none" : "1px solid var(--border)",
        borderRadius: 14, padding: "13px 0", fontSize: 14, fontWeight: 800,
        cursor: "not-allowed", opacity: 0.55,
        background: primary ? "linear-gradient(90deg, #0f766e, #14b8a6)" : "var(--bg-card)",
        color: primary ? "#fff" : "var(--text)",
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid var(--border)", borderRadius: 12,
  padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--text)",
  background: "var(--bg)", outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 5, display: "block",
};

const STATUS_META: Record<Booking["status"], { label: string; color: string }> = {
  requested: { label: "Requested — waiting for tutor confirmation", color: "#f59e0b" },
  accepted:  { label: "Accepted",  color: "#22c55e" },
  declined:  { label: "Declined",  color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "var(--text-muted)" },
  // Booking completion phase.
  completed: { label: "Completed", color: "#0d9488" },
};

/** ShikshaHub Phase 1/3 booking form. No payment anywhere in here — submit
 *  only calls requestBooking() (Firestore write, no Razorpay) and then
 *  listens to the resulting bookings/{id} doc for a live status update,
 *  so an "Accepted"/"Declined" from respondToBooking shows up here
 *  without a page reload.
 *
 *  Phase 3: fetches this tutor's published services first. If they have
 *  any, the panel switches to the service picker below and the legacy
 *  flat subject/fee/availability fields are never used for booking —
 *  matches requestBooking's own migration rule (a tutor with ANY service
 *  stops accepting the legacy path). If they have zero services, this
 *  renders byte-for-byte the same legacy form Phase 1/2 always has. */
function BookingPanel({ tutor }: { tutor: MarketplaceTutor }) {
  const [services, setServices]             = useState<TutorService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  useEffect(() => {
    fetchTutorServices(tutor.uid).then(setServices).finally(() => setServicesLoading(false));
  }, [tutor.uid]);

  if (servicesLoading) return null;

  return services.length > 0
    ? <ServiceBookingPanel tutor={tutor} services={services} />
    : <LegacyBookingPanel tutor={tutor} />;
}

/** Shared "already requested — show live status" view, used by both the
 *  service and legacy booking panels below. */
function BookingStatusView({ bookingId, booking }: { bookingId: string; booking: Booking | null }) {
  const { t } = useAppTranslation();
  const meta = booking ? STATUS_META[booking.status] : null;
  const cancellable = booking?.status === "requested" || booking?.status === "accepted";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "center", padding: "6px 0" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
        {t("shikshaHubBookingSent", "Booking request sent")}
      </div>
      <div style={{
        display: "inline-flex", alignSelf: "center", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 700, color: meta?.color ?? "var(--text-muted)",
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta?.color ?? "var(--text-muted)" }} />
        {meta ? meta.label : t("shikshaHubBookingWaiting", "Waiting for tutor confirmation")}
      </div>
      {cancellable && <CancelBookingButton bookingId={bookingId} />}
    </div>
  );
}

/** ShikshaHub Phase 3 — service-based booking. Every authoritative value
 *  (subject/fee/mode/duration) comes straight off the selected service
 *  doc, never re-derived or editable here — the server re-resolves all of
 *  it from tutorServices/{serviceId} again anyway (see requestBooking's
 *  header comment), this is purely display. instant_help services are
 *  shown (so students can browse/see the rate — approved Phase 3 scope)
 *  but are not selectable for booking — see the disabled state below. */
function ServiceBookingPanel({ tutor, services }: { tutor: MarketplaceTutor; services: TutorService[] }) {
  const { t } = useAppTranslation();
  const [serviceId, setServiceId]     = useState(services[0]?.id ?? "");
  const [sessionType, setSessionType] = useState<BookingSessionType>("trial");
  const [date, setDate]               = useState(todayDateStr());
  const [slotStart, setSlotStart]     = useState("");
  const [phase, setPhase]             = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg]       = useState("");
  const [bookingId, setBookingId]     = useState<string | null>(null);
  const [booking, setBooking]         = useState<Booking | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const isInstantHelp = service?.serviceType === "instant_help";

  const slots = useMemo(
    () => (service && !isInstantHelp ? slotOptionsForDate(service.availability ?? null, date) : []),
    [service, isInstantHelp, date]
  );
  const selectedSlot = slots.find((s) => s.start === slotStart) ?? null;

  useEffect(() => { setSlotStart(""); }, [date, serviceId]);
  useEffect(() => {
    if (service && !isInstantHelp && sessionType === "trial" && !service.trialAvailable) setSessionType("regular");
  }, [service, isInstantHelp, sessionType]);

  useEffect(() => {
    if (!bookingId) return;
    return listenToBooking(bookingId, setBooking);
  }, [bookingId]);

  if (bookingId) return <BookingStatusView bookingId={bookingId} booking={booking} />;

  async function handleRequestInstantHelp() {
    if (!service || !isInstantHelp) return;
    setPhase("submitting");
    setErrorMsg("");
    try {
      await requestInstantHelpCall(tutor.uid, service.id!);
      // No local "waiting" state to set here — apps/web's global
      // InstantHelpBar (mounted in the app layout) picks up the new
      // pending request via its own live listener and renders the
      // waiting/countdown/cancel UI from anywhere in the app, same as
      // it'll later pick up the resulting session.
      setPhase("idle");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not send the request. Please try again.");
      setPhase("error");
    }
  }

  async function handleSubmit() {
    if (!service || isInstantHelp || !selectedSlot) return;
    setPhase("submitting");
    setErrorMsg("");
    try {
      const res = await requestBookingCall({
        tutorUid: tutor.uid,
        serviceId: service.id!,
        subject: service.subject,
        sessionType,
        requestedDate: date,
        requestedStartTime: selectedSlot.start,
        requestedEndTime: selectedSlot.end,
      });
      setBookingId(res.bookingId);
      setPhase("idle");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not send the booking request. Please try again.");
      setPhase("error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <span style={labelStyle}>{t("serviceLabel", "Service")}</span>
        <select style={inputStyle} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.serviceName} · {SERVICE_TYPE_LABEL[s.serviceType]}
            </option>
          ))}
        </select>
      </div>

      {service && (
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
          {service.subject} · {service.deliveryMode === "online_offline" ? "Online + Offline" : service.deliveryMode === "online" ? "Online" : "Offline"}
        </div>
      )}

      {isInstantHelp ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: "1px solid var(--border)", paddingTop: 10,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{t("shikshaHubFeeLabel", "Fee")}</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>
              {service?.creditsPerMinute ?? "—"} {t("creditsPerMinuteSuffix", "credits/min")}
            </span>
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700,
            color: tutor.isOnlineForInstantHelp ? "#10b981" : "var(--text-muted)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: tutor.isOnlineForInstantHelp ? "#10b981" : "var(--text-muted)" }} />
            {tutor.isOnlineForInstantHelp
              ? t("instantHelpTutorOnline", "Online now")
              : t("instantHelpTutorOffline", "Offline — can't request right now")}
          </div>

          {phase === "error" && (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#ef4444" }}>{errorMsg}</div>
          )}

          <button
            onClick={handleRequestInstantHelp}
            disabled={!tutor.isOnlineForInstantHelp || phase === "submitting"}
            style={{
              width: "100%", border: "none", borderRadius: 14, padding: "13px 0", fontSize: 14, fontWeight: 800,
              cursor: !tutor.isOnlineForInstantHelp || phase === "submitting" ? "not-allowed" : "pointer",
              opacity: !tutor.isOnlineForInstantHelp || phase === "submitting" ? 0.55 : 1,
              background: "linear-gradient(90deg, #0f766e, #14b8a6)", color: "#fff",
            }}
          >
            {phase === "submitting" ? t("shikshaHubRequesting", "Sending request…") : t("instantHelpAskNow", "Ask Now")}
          </button>
          <a href="/shikshahub/credits" style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>
            {t("instantHelpBuyCreditsLink", "Buy credits →")}
          </a>
        </div>
      ) : (
        <>
          <div>
            <span style={labelStyle}>{t("shikshaHubSessionTypeLabel", "Session")}</span>
            <div style={{ display: "flex", gap: 8 }}>
              {(["trial", "regular"] as const).map((opt) => {
                const disabled = opt === "trial" && !service?.trialAvailable;
                return (
                  <button
                    key={opt} type="button" disabled={disabled}
                    onClick={() => setSessionType(opt)}
                    style={{
                      flex: 1, borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 800,
                      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
                      border: sessionType === opt ? "1px solid #14b8a6" : "1px solid var(--border)",
                      background: sessionType === opt ? "rgba(20,184,166,0.15)" : "var(--bg)",
                      color: sessionType === opt ? "#0d9488" : "var(--text)",
                    }}
                  >
                    {opt === "trial" ? t("shikshaHubTrial", "Trial") : t("shikshaHubRegular", "Regular")}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span style={labelStyle}>{t("shikshaHubDateLabel", "Date")}</span>
            <input type="date" min={todayDateStr()} value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <span style={labelStyle}>{t("shikshaHubTimeLabel", "Time")}</span>
            {slots.length === 0 ? (
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
                {t("shikshaHubNoSlots", "No slots available on this date — try another day.")}
              </div>
            ) : (
              <select style={inputStyle} value={slotStart} onChange={(e) => setSlotStart(e.target.value)}>
                <option value="">{t("shikshaHubSelectTime", "Select a time")}</option>
                {slots.map((s) => <option key={s.start} value={s.start}>{s.label}</option>)}
              </select>
            )}
          </div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{t("shikshaHubFeeLabel", "Fee")}</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>₹{service?.sessionFee}</span>
          </div>

          {phase === "error" && (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#ef4444" }}>{errorMsg}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selectedSlot || phase === "submitting"}
            style={{
              width: "100%", border: "none", borderRadius: 14, padding: "13px 0", fontSize: 14, fontWeight: 800,
              cursor: !selectedSlot || phase === "submitting" ? "not-allowed" : "pointer",
              opacity: !selectedSlot || phase === "submitting" ? 0.55 : 1,
              background: "linear-gradient(90deg, #0f766e, #14b8a6)", color: "#fff",
            }}
          >
            {phase === "submitting" ? t("shikshaHubRequesting", "Sending request…") : t("shikshaHubRequestBooking", "Request Booking")}
          </button>
        </>
      )}
    </div>
  );
}

/** ShikshaHub Phase 1/2 legacy booking form — unchanged from before Phase
 *  3, rendered only for a tutor with zero services (see requestBooking's
 *  migration rule in functions/src/tutorBooking.ts). */
function LegacyBookingPanel({ tutor }: { tutor: MarketplaceTutor }) {
  const { t } = useAppTranslation();
  const [subject, setSubject]         = useState(tutor.subjects[0] ?? "");
  const [sessionType, setSessionType] = useState<BookingSessionType>("trial");
  const [date, setDate]               = useState(todayDateStr());
  const [slotStart, setSlotStart]     = useState("");
  const [phase, setPhase]             = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg]       = useState("");
  const [bookingId, setBookingId]     = useState<string | null>(null);
  const [booking, setBooking]         = useState<Booking | null>(null);

  const slots = useMemo(() => slotOptionsForDate(tutor.availability, date), [tutor.availability, date]);
  const selectedSlot = slots.find((s) => s.start === slotStart) ?? null;

  useEffect(() => {
    setSlotStart(""); // reset the picked slot whenever the date (and therefore the slot list) changes
  }, [date]);

  useEffect(() => {
    if (!bookingId) return;
    return listenToBooking(bookingId, setBooking);
  }, [bookingId]);

  if (tutor.subjects.length === 0 || tutor.sessionFee == null) {
    return (
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
        {t("shikshaHubBookingNotReady", "This tutor hasn't set up bookable subjects/pricing yet.")}
      </div>
    );
  }

  if (bookingId) return <BookingStatusView bookingId={bookingId} booking={booking} />;

  async function handleSubmit() {
    if (!selectedSlot) return;
    setPhase("submitting");
    setErrorMsg("");
    try {
      const res = await requestBookingCall({
        tutorUid: tutor.uid,
        subject,
        sessionType,
        requestedDate: date,
        requestedStartTime: selectedSlot.start,
        requestedEndTime: selectedSlot.end,
      });
      setBookingId(res.bookingId);
      setPhase("idle");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not send the booking request. Please try again.");
      setPhase("error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <span style={labelStyle}>{t("shikshaHubSubjectLabel", "Subject")}</span>
        <select style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)}>
          {tutor.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <span style={labelStyle}>{t("shikshaHubSessionTypeLabel", "Session")}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["trial", "regular"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSessionType(opt)}
              style={{
                flex: 1, borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 800, cursor: "pointer",
                border: sessionType === opt ? "1px solid #14b8a6" : "1px solid var(--border)",
                background: sessionType === opt ? "rgba(20,184,166,0.15)" : "var(--bg)",
                color: sessionType === opt ? "#0d9488" : "var(--text)",
              }}
            >
              {opt === "trial" ? t("shikshaHubTrial", "Trial") : t("shikshaHubRegular", "Regular")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={labelStyle}>{t("shikshaHubDateLabel", "Date")}</span>
        <input type="date" min={todayDateStr()} value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div>
        <span style={labelStyle}>{t("shikshaHubTimeLabel", "Time")}</span>
        {slots.length === 0 ? (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
            {t("shikshaHubNoSlots", "No slots available on this date — try another day.")}
          </div>
        ) : (
          <select style={inputStyle} value={slotStart} onChange={(e) => setSlotStart(e.target.value)}>
            <option value="">{t("shikshaHubSelectTime", "Select a time")}</option>
            {slots.map((s) => <option key={s.start} value={s.start}>{s.label}</option>)}
          </select>
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{t("shikshaHubFeeLabel", "Fee")}</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>₹{tutor.sessionFee}</span>
      </div>

      {phase === "error" && (
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#ef4444" }}>{errorMsg}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!selectedSlot || phase === "submitting"}
        style={{
          width: "100%", border: "none", borderRadius: 14, padding: "13px 0", fontSize: 14, fontWeight: 800,
          cursor: !selectedSlot || phase === "submitting" ? "not-allowed" : "pointer",
          opacity: !selectedSlot || phase === "submitting" ? 0.55 : 1,
          background: "linear-gradient(90deg, #0f766e, #14b8a6)", color: "#fff",
        }}
      >
        {phase === "submitting" ? t("shikshaHubRequesting", "Sending request…") : t("shikshaHubRequestBooking", "Request Booking")}
      </button>
    </div>
  );
}

/** ShikshaHub Phase 2 — cancel a "requested"/"accepted" booking from the
 *  student side. No local status mutation on success: the parent's
 *  listenToBooking onSnapshot listener picks up the callable's Admin-SDK
 *  write and re-renders with status "cancelled" (which flips
 *  `cancellable` false above), same pattern apps/tutor's bookings page
 *  uses for accept/decline. */
function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const { t } = useAppTranslation();
  const [phase, setPhase] = useState<"idle" | "cancelling" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCancel() {
    setPhase("cancelling");
    setErrorMsg("");
    try {
      await cancelBookingCall(bookingId);
      setPhase("idle");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not cancel this booking. Please try again.");
      setPhase("error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      <button
        onClick={handleCancel}
        disabled={phase === "cancelling"}
        style={{
          border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)",
          borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700,
          cursor: phase === "cancelling" ? "not-allowed" : "pointer", opacity: phase === "cancelling" ? 0.6 : 1,
        }}
      >
        {phase === "cancelling" ? t("shikshaHubCancelling", "Cancelling…") : t("shikshaHubCancelBooking", "Cancel booking")}
      </button>
      {phase === "error" && (
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#ef4444" }}>{errorMsg}</div>
      )}
    </div>
  );
}

export default function ShikshaHubProfilePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Loading…</div>}>
      <ShikshaHubProfileContent />
    </Suspense>
  );
}
