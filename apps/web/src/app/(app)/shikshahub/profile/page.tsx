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
// (Contact Tutor since links to a real thread — Phase 1's own note above
// is stale, left as-is rather than rewritten.)
//
// Public Tutor Profile pass — everything in this section reads ONLY
// MarketplaceTutor (tutorMarketplaceProfiles/{uid}, the collection that
// structurally only ever contains currently-verified tutors — see
// functions/src/tutorMarketplace.ts's SAFE_FIELDS and its sync trigger,
// and firestore.rules' tutorMarketplaceProfiles block). No new Firestore
// collection, field, or query was added: Availability reuses the same
// `availability` field BookingPanel already reads; Related Tutors reuses
// fetchAllTutors() (the exact call the discovery grid already makes,
// ranked client-side); Trust & Verification is static, accurate copy,
// not a new flag. Fields the detailed brief asked for that do NOT exist
// on this public profile — city/location, structured degree/institution/
// year, teaching mode, student levels, curriculum board — are
// deliberately NOT fabricated here; see this feature's final report for
// the recommended follow-up to mirror them from tutors/{uid} if/when
// they're judged public-safe.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  fetchAllTutors,
  fetchTutorById,
  fetchTutorServices,
  requestBookingCall,
  cancelBookingCall,
  requestInstantHelpCall,
  listenToBooking,
  slotOptionsForDate,
  weekdayKeyForDate,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import type { Booking, BookingSessionType, TutorService, TutorWeekday } from "@gloows/shared-logic";
import { useTutorReviews } from "@gloows/shared-logic";
import { ProfileSectionCard, ShikshaHubStyles, SubjectChips, TutorAvatar, VerifiedBadge } from "../_shared";
import { TutorCard } from "../page";

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

  if (loading) return <ProfileSkeleton />;

  // Covers every reason a profile can be unreachable — invalid/typo'd id,
  // never existed, rejected, unverified, or since-unverified — as one
  // generic state. This isn't a client-side check standing in for real
  // access control: fetchTutorById reads tutorMarketplaceProfiles/{uid},
  // a collection that structurally only ever contains currently-verified
  // tutors (functions/src/tutorMarketplace.ts's sync trigger deletes the
  // mirror doc the instant verified flips false, and firestore.rules
  // blocks all client writes to it) — so a manually-typed id for a
  // draft/rejected/test tutor gets exactly the same "not found" result
  // as a nonexistent one, never their private data or the real reason.
  if (notFound || !tutor) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40 }}>🤔</div>
        <div style={{ marginTop: 10, color: "var(--text)", fontSize: 15, fontWeight: 800 }}>
          {t("shikshaHubNotFoundTitle", "Tutor Not Available")}
        </div>
        <div style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
          {t("shikshaHubNotFound", "This tutor profile is currently unavailable.")}
        </div>
        <button
          onClick={() => router.replace("/shikshahub")}
          style={{ marginTop: 14, background: "#14b8a6", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
        >
          {t("browseShikshaHub", "Browse Tutors")}
        </button>
      </div>
    );
  }

  const hasMeta = !!tutor.qualification || tutor.teachingExperienceYears != null || !!tutor.preferredLanguage;
  // preferredLanguage is a single free-text field on the public profile
  // (see lib/shikshahub's MarketplaceTutor) — a tutor CAN enter multiple
  // ("English, Hindi"), so split on comma to render as a proper multi-
  // language list rather than fabricating a structured field that
  // doesn't exist. A single language still renders as one chip.
  const languages = tutor.preferredLanguage.split(",").map((l) => l.trim()).filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 60 }}>
      <ShikshaHubStyles />

      <div className="shikshahub-container" style={{ padding: "16px 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 14, fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
          <Link href="/shikshahub" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            {t("shikshaHubTitle", "ShikshaHub")}
          </Link>
          {/* Not a filtered-list link — /shikshahub doesn't read an
              initial subject filter from the URL today, and wiring that
              up is discovery-page scope, not this page's. Plain
              breadcrumb text still gives the "where am I" context the
              spec asks for without implying a filter link that doesn't
              actually filter. */}
          {tutor.subjects[0] && (
            <>
              <span aria-hidden>/</span>
              <span>{tutor.subjects[0]} {t("shikshaHubTutorsSuffix", "Tutors")}</span>
            </>
          )}
          <span aria-hidden>/</span>
          <span style={{ color: "var(--text)" }}>{tutor.name || "Tutor"}</span>
        </div>

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
                        🗣️ {languages.join(", ")}
                      </span>
                    )}
                  </div>
                )}

                {tutor.subjects.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 6, letterSpacing: 0.2 }}>
                      {t("shikshaHubSubjectsLabel", "Subjects I Teach")}
                    </div>
                    <SubjectChips subjects={tutor.subjects} />
                  </div>
                )}
              </div>
            </div>

            <ProfileSectionCard title={t("shikshaHubAboutTitle", "About the Tutor")}>
              <BioText bio={tutor.bio} />
            </ProfileSectionCard>

            <AvailabilitySection availability={tutor.availability} />

            <TrustSection />

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

              <button
                onClick={() => router.push(`/shikshahub/messages/thread?peer=${tutor.uid}`)}
                style={{
                  width: "100%", border: "1px solid var(--border)", borderRadius: 14,
                  padding: "13px 0", fontSize: 14, fontWeight: 800, cursor: "pointer",
                  background: "var(--bg-card)", color: "var(--text)",
                }}
              >
                {t("shikshaHubContactTutor", "Contact Tutor")}
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <RelatedTutorsSection currentTutor={tutor} />
        </div>
      </div>
    </div>
  );
}

/** Bio with a 4-line clamp + Read more/less toggle, and an honest empty
 *  state ("About information is not available yet.") rather than
 *  omitting the whole About card when a tutor hasn't written one — the
 *  spec's own distinction: qualifications get omitted when missing,
 *  bio gets an explicit placeholder. Plain text only — bio is stored
 *  and served as plain text everywhere else in this codebase (see
 *  functions/src/tutorReviews.ts's identical note on reviewText), so
 *  no HTML/markdown rendering is introduced here either. */
function BioText({ bio }: { bio: string }) {
  const { t } = useAppTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!bio.trim()) {
    return (
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-muted)", fontStyle: "italic" }}>
        {t("shikshaHubNoBio", "About information is not available yet.")}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          fontSize: 13.5, lineHeight: "21px", fontWeight: 500, color: "var(--text-muted)",
          whiteSpace: "pre-wrap", overflow: "hidden",
          display: expanded ? "block" : "-webkit-box",
          WebkitLineClamp: expanded ? undefined : 4,
          WebkitBoxOrient: "vertical",
        }}
      >
        {bio}
      </div>
      {bio.length > 220 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ marginTop: 6, background: "none", border: "none", padding: 0, color: "#0d9488", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
        >
          {expanded ? t("readLess", "Read less") : t("readMore", "Read more")}
        </button>
      )}
    </div>
  );
}

const WEEKDAY_LABELS: { key: string; label: string }[] = [
  { key: "monday", label: "Mon" }, { key: "tuesday", label: "Tue" }, { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" }, { key: "friday", label: "Fri" }, { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

/** Public availability summary — reuses the SAME tutor.availability field
 *  the booking panel already reads (public-safe: it's on tutorMarketplace
 *  -Profiles already, a weekly enabled/start/end template, no exact
 *  calendar/booked-slot data). Deliberately shows only WHICH DAYS have
 *  some availability, never the start/end times themselves — a simplified
 *  summary, not the tutor's real schedule, per the spec's "do not expose
 *  exact personal schedules" rule. */
function AvailabilitySection({ availability }: { availability: MarketplaceTutor["availability"] }) {
  const { t } = useAppTranslation();
  const enabledDays = WEEKDAY_LABELS.filter((d) => availability?.[d.key as TutorWeekday]?.enabled);

  if (enabledDays.length === 0) {
    return (
      <ProfileSectionCard title={t("shikshaHubAvailabilityTitle", "Availability")}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
          {t("shikshaHubNoAvailability", "Availability information is currently not available.")}
        </div>
      </ProfileSectionCard>
    );
  }

  const todayKey = weekdayKeyForDate(todayDateStr());
  const isTodayEnabled = todayKey ? enabledDays.some((d) => d.key === todayKey) : false;
  const statusText = isTodayEnabled
    ? t("shikshaHubAvailableToday", "Available Today")
    : enabledDays.length >= 4
    ? t("shikshaHubAvailableThisWeek", "Available This Week")
    : t("shikshaHubLimitedAvailability", "Limited Availability");
  const statusColor = isTodayEnabled ? "#22c55e" : enabledDays.length >= 4 ? "#14b8a6" : "#f59e0b";

  return (
    <ProfileSectionCard title={t("shikshaHubAvailabilityTitle", "Availability")}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{statusText}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {WEEKDAY_LABELS.map((d) => {
          const on = enabledDays.some((e) => e.key === d.key);
          return (
            <span
              key={d.key}
              style={{
                width: 40, textAlign: "center", borderRadius: 10, padding: "6px 0", fontSize: 11, fontWeight: 800,
                border: on ? "1px solid #14b8a6" : "1px solid var(--border)",
                background: on ? "rgba(20,184,166,0.12)" : "var(--bg)",
                color: on ? "#0d9488" : "var(--text-muted)",
              }}
            >
              {d.label}
            </span>
          );
        })}
      </div>
    </ProfileSectionCard>
  );
}

/** Accurately worded, never overclaiming — every profile this page can
 *  reach is already verified by construction (tutorMarketplaceProfiles
 *  only exists for verified:true, see fetchTutorById's caller), so this
 *  is unconditional, not a per-tutor check. Deliberately does NOT claim
 *  "Identity Verified" or "Background Checked" — no such step exists
 *  anywhere in the real Gloows365 verification process (onboarding's
 *  mobile OTP is a client-side stub, and no government-ID collection
 *  exists at all), only that an admin reviewed the submitted profile and
 *  documents before approving it. */
function TrustSection() {
  const { t } = useAppTranslation();
  const items = [
    t("shikshaHubTrustVerified", "Gloows Verified Tutor"),
    t("shikshaHubTrustReviewed", "Profile & qualifications reviewed by our team"),
  ];
  return (
    <ProfileSectionCard title={t("shikshaHubTrustTitle", "Why Learn With This Tutor?")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((label) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            <span style={{ color: "#22c55e", fontWeight: 900 }}>✓</span>
            {label}
          </div>
        ))}
      </div>
    </ProfileSectionCard>
  );
}

/** "You May Also Like" — reuses fetchAllTutors (the exact same call the
 *  discovery grid already makes, no new query/index) and ranks
 *  client-side: shared subjects first, then shared language, then
 *  rating, capped at 4. Excludes the current tutor. Every candidate
 *  already comes from tutorMarketplaceProfiles, so — same as the main
 *  profile fetch — unverified/test/inactive tutors are structurally
 *  absent already, nothing extra to filter here. */
function RelatedTutorsSection({ currentTutor }: { currentTutor: MarketplaceTutor }) {
  const { t } = useAppTranslation();
  const router = useRouter();
  const [related, setRelated] = useState<MarketplaceTutor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllTutors().then((all) => {
      if (cancelled) return;
      const others = all.filter((tu) => tu.uid !== currentTutor.uid);
      const scored = others.map((tu) => {
        const sharedSubjects = tu.subjects.filter((s) => currentTutor.subjects.includes(s)).length;
        const sameLanguage = tu.preferredLanguage && tu.preferredLanguage === currentTutor.preferredLanguage ? 1 : 0;
        return { tu, score: sharedSubjects * 10 + sameLanguage * 2 + (tu.ratingAverage ?? 0) };
      });
      scored.sort((a, b) => b.score - a.score);
      setRelated(scored.slice(0, 4).map((s) => s.tu));
    }).catch(() => setRelated([]));
    return () => { cancelled = true; };
  }, [currentTutor.uid, currentTutor.subjects, currentTutor.preferredLanguage]);

  if (!related || related.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>
        {t("shikshaHubRelatedTitle", "You May Also Like")}
      </div>
      <div className="shikshahub-grid">
        {related.map((tu) => (
          <TutorCard key={tu.uid} tutor={tu} onClick={() => router.push(`/shikshahub/profile?id=${tu.uid}`)} />
        ))}
      </div>
    </div>
  );
}

/** Loading skeleton — matches the real layout's shape (avatar, name,
 *  metadata, about card, sidebar action card) instead of a blank page
 *  or bare "Loading…" text. */
function ProfileSkeleton() {
  const pulse: React.CSSProperties = { background: "var(--bg-card)", borderRadius: 8, animation: "shikshahub-pulse 1.4s ease-in-out infinite" };
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <style>{`@keyframes shikshahub-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
      <div className="shikshahub-container" style={{ padding: "16px 16px 40px" }}>
        <div style={{ ...pulse, width: 80, height: 34, marginBottom: 16 }} />
        <div className="shikshahub-detail-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 20, padding: 20, display: "flex", gap: 16 }}>
              <div style={{ ...pulse, width: 92, height: 92, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ ...pulse, width: "60%", height: 22 }} />
                <div style={{ ...pulse, width: "40%", height: 14 }} />
                <div style={{ ...pulse, width: "50%", height: 14 }} />
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <div style={{ ...pulse, width: 70, height: 26, borderRadius: 20 }} />
                  <div style={{ ...pulse, width: 90, height: 26, borderRadius: 20 }} />
                </div>
              </div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 20, padding: 20 }}>
              <div style={{ ...pulse, width: "30%", height: 14, marginBottom: 10 }} />
              <div style={{ ...pulse, width: "100%", height: 12, marginBottom: 6 }} />
              <div style={{ ...pulse, width: "90%", height: 12, marginBottom: 6 }} />
              <div style={{ ...pulse, width: "70%", height: 12 }} />
            </div>
          </div>
          <div className="shikshahub-action-card">
            <div style={{ border: "1px solid var(--border)", borderRadius: 20, padding: 20, height: 260 }}>
              <div style={{ ...pulse, width: "80%", height: 16, marginBottom: 16 }} />
              <div style={{ ...pulse, width: "100%", height: 44, borderRadius: 14, marginBottom: 10 }} />
              <div style={{ ...pulse, width: "100%", height: 44, borderRadius: 14 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ShikshaHub Phase 6 — non-hidden reviews for this tutor, off completed
 *  Instant Help sessions only (see functions/src/tutorReviews.ts's header
 *  comment). Shows an honest empty state rather than hiding the section —
 *  review infrastructure genuinely exists and works here, so per the
 *  spec's own distinction that's the "reviews exist but none yet" case,
 *  not the "no review system at all" case. */
function ReviewsSection({ tutorUid }: { tutorUid: string }) {
  const { t } = useAppTranslation();
  const { reviews, loading } = useTutorReviews(tutorUid);

  if (loading) return null;

  return (
    <ProfileSectionCard title={`${t("reviewsTitle", "Reviews")}${reviews.length > 0 ? ` (${reviews.length})` : ""}`}>
      {reviews.length === 0 ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
          {t("shikshaHubNoReviews", "This tutor has not received any student reviews yet.")}
        </div>
      ) : (
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
            {!!r.tutorReply && (
              <div style={{
                marginTop: 8, marginLeft: 12, paddingLeft: 10, borderLeft: "2px solid #14b8a6",
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#14b8a6" }}>
                  {t("tutorReplyLabel", "Reply from tutor")}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: "19px" }}>{r.tutorReply}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </ProfileSectionCard>
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
