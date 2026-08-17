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
// sticky) and stacks on mobile, per the approved redesign brief. Booking/
// contact actions are UI-only placeholders (disabled, "coming soon") since
// there is no backend support for them yet — not wired to fake behaviour.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import { fetchTutorById, type MarketplaceTutor } from "@/lib/shikshahub";
import { ShikshaHubStyles, SubjectChips, TutorAvatar, VerifiedBadge } from "../_shared";

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

              <ActionButton label={t("shikshaHubBookTrial", "Book a Trial")} primary />
              <ActionButton label={t("shikshaHubBookTutor", "Book Tutor")} primary />
              <ActionButton label={t("shikshaHubContactTutor", "Contact Tutor")} />

              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "center", marginTop: 2 }}>
                {t("shikshaHubActionsComingSoon", "Booking & messaging are coming soon")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** UI-only placeholder — no booking/contact backend exists yet
 *  (see this file's header comment), so these stay disabled rather than
 *  wired to fake behaviour. */
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

export default function ShikshaHubProfilePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Loading…</div>}>
      <ShikshaHubProfileContent />
    </Suspense>
  );
}
