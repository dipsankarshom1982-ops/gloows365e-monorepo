"use client";

// PATH: apps/web/src/app/(app)/shikshahub/page.tsx
// ShikshaHub — browsable marketplace of verified Gloows Tutor profiles.
// Mirrors apps/mobile/app/(drawer)/(tabs)/shikshahub.tsx. A flat filterable
// grid (no home/category drill-down split like GloStore) since there's no
// featured-curation source yet — just one subject-chip filter row over the
// full verified-tutor list. See apps/web/src/lib/shikshahub/index.ts for
// the data layer this reads from.
//
// UI-only redesign pass (data layer / fetchAllTutors untouched): responsive
// card grid (1/2/3/4 cols by viewport, see _shared.tsx's .shikshahub-grid),
// richer per-card info, and a slightly more polished hero.
//
// Tutor discovery phase — MarketplaceTutor has carried ratingCount/
// ratingAverage since Phase 6, but nothing browsable ever surfaced it
// (only the profile detail page did). Adds a rating badge per card, a
// sort toggle (name / top rated), and a minimum-rating filter chip row —
// all client-side over the same fetchAllTutors() result, same as the
// existing subject-chip filter, since this fetches every verified tutor
// with no pagination already.
//
// More discovery filters phase — three more client-side filters over the
// same fetchAllTutors() result, same "hide fields that aren't available"
// rule the rating filter above already follows (a tutor missing the
// relevant field is excluded, never assumed to pass): a session-fee price
// band, an "online now" toggle reusing isOnlineForInstantHelp (already
// synced live for Instant Help matching — see MarketplaceTutor's own
// comment), and a minimum-years-experience threshold.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  deriveSubjectChips,
  fetchAllTutors,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import { ShikshaHubStyles, SubjectChips, TutorAvatar, VerifiedBadge } from "./_shared";

type SortMode = "name" | "rating";
// "under500" / "500to1000" / "1000plus" — fixed buckets over sessionFee
// (whole INR, per session). No user-typed min/max input since there's no
// server-side range query behind this (everything here is a client-side
// filter over one already-fetched array) — a small fixed set of bands is
// simpler than a slider for the same result, and matches this file's
// existing chip-based filter UI throughout.
type PriceBand = "under500" | "500to1000" | "1000plus";

export default function ShikshaHubPage() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const [tutors, setTutors]   = useState<MarketplaceTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [priceBand, setPriceBand] = useState<PriceBand | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [minExperience, setMinExperience] = useState<number | null>(null);

  useEffect(() => {
    fetchAllTutors().then(setTutors).finally(() => setLoading(false));
  }, []);

  const subjectChips = useMemo(() => deriveSubjectChips(tutors), [tutors]);
  const filtered = useMemo(() => {
    let result = subject ? tutors.filter((tu) => tu.subjects.includes(subject)) : tutors;
    if (minRating != null) {
      result = result.filter((tu) => tu.ratingAverage != null && tu.ratingAverage >= minRating);
    }
    if (priceBand != null) {
      result = result.filter((tu) => {
        if (tu.sessionFee == null) return false;
        if (priceBand === "under500") return tu.sessionFee < 500;
        if (priceBand === "500to1000") return tu.sessionFee >= 500 && tu.sessionFee <= 1000;
        return tu.sessionFee > 1000;
      });
    }
    if (onlineOnly) {
      result = result.filter((tu) => tu.isOnlineForInstantHelp);
    }
    if (minExperience != null) {
      result = result.filter((tu) => tu.teachingExperienceYears != null && tu.teachingExperienceYears >= minExperience);
    }
    if (sortMode === "rating") {
      // Unrated tutors sink to the bottom rather than being hidden —
      // "top rated" still needs somewhere to put a tutor with no reviews
      // yet, same "don't invent a value that isn't there" rule the rest
      // of this file already follows for every other optional field.
      result = [...result].sort((a, b) => {
        const ar = a.ratingAverage ?? -1;
        const br = b.ratingAverage ?? -1;
        if (ar !== br) return br - ar;
        return a.name.localeCompare(b.name);
      });
    }
    return result;
  }, [tutors, subject, sortMode, minRating, priceBand, onlineOnly, minExperience]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <ShikshaHubStyles />
      <Hero />

      {!loading && subjectChips.length > 0 && (
        <div className="shikshahub-container" style={{ padding: "0 16px 12px" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            <Chip label={t("shikshaHubAllSubjects", "All")} active={subject === null} onClick={() => setSubject(null)} />
            {subjectChips.map((s) => (
              <Chip key={s} label={s} active={subject === s} onClick={() => setSubject(s)} />
            ))}
          </div>
        </div>
      )}

      {!loading && tutors.length > 0 && (
        <div className="shikshahub-container" style={{ padding: "0 16px 18px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Chip label={t("shikshaHubSortByName", "Name")} active={sortMode === "name"} onClick={() => setSortMode("name")} />
            <Chip label={`⭐ ${t("shikshaHubSortByRating", "Top rated")}`} active={sortMode === "rating"} onClick={() => setSortMode("rating")} />
          </div>
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: 6 }}>
            <Chip label={t("shikshaHubAllRatings", "All ratings")} active={minRating === null} onClick={() => setMinRating(null)} />
            <Chip label="4★+" active={minRating === 4} onClick={() => setMinRating(4)} />
            <Chip label="3★+" active={minRating === 3} onClick={() => setMinRating(3)} />
          </div>
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: 6 }}>
            <Chip label={t("shikshaHubAnyPrice", "Any price")} active={priceBand === null} onClick={() => setPriceBand(null)} />
            <Chip label={t("shikshaHubPriceUnder500", "Under ₹500")} active={priceBand === "under500"} onClick={() => setPriceBand("under500")} />
            <Chip label={t("shikshaHubPrice500to1000", "₹500–1000")} active={priceBand === "500to1000"} onClick={() => setPriceBand("500to1000")} />
            <Chip label={t("shikshaHubPrice1000Plus", "₹1000+")} active={priceBand === "1000plus"} onClick={() => setPriceBand("1000plus")} />
          </div>
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <Chip label={`🟢 ${t("shikshaHubOnlineNow", "Online now")}`} active={onlineOnly} onClick={() => setOnlineOnly((v) => !v)} />
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: 6 }}>
            <Chip label={t("shikshaHubAnyExperience", "Any experience")} active={minExperience === null} onClick={() => setMinExperience(null)} />
            <Chip label={t("shikshaHubExp1Plus", "1+ yrs")} active={minExperience === 1} onClick={() => setMinExperience(1)} />
            <Chip label={t("shikshaHubExp3Plus", "3+ yrs")} active={minExperience === 3} onClick={() => setMinExperience(3)} />
            <Chip label={t("shikshaHubExp5Plus", "5+ yrs")} active={minExperience === 5} onClick={() => setMinExperience(5)} />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40 }}>🎓</div>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
            {t("shikshaHubEmpty", "No verified tutors yet — check back soon!")}
          </div>
        </div>
      ) : (
        <div className="shikshahub-container" style={{ padding: "0 16px 48px" }}>
          <div className="shikshahub-grid">
            {filtered.map((tu) => (
              <TutorCard key={tu.uid} tutor={tu} onClick={() => router.push(`/shikshahub/profile?id=${tu.uid}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Hero() {
  const { t } = useAppTranslation();
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f766e, #0d9488, #14b8a6)",
      padding: "24px 20px 34px", borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    }}>
      <div className="shikshahub-container" style={{ padding: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{
            width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.16)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          }}>
            🎓
          </div>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 900, marginTop: 12, letterSpacing: -0.3 }}>
            {t("shikshaHubTitle", "ShikshaHub")}
          </div>
          <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: 600, marginTop: 5, maxWidth: 460, lineHeight: "19px" }}>
            {t("shikshaHubSubtitle", "Find verified tutors who match your learning needs.")}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <Link
            href="/shikshahub/bookings"
            style={{
              marginTop: 4, background: "rgba(255,255,255,0.16)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "8px 14px",
              fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", textAlign: "center",
            }}
          >
            {t("shikshaHubMyBookingsTitle", "My Bookings")}
          </Link>
          <Link
            href="/shikshahub/messages"
            style={{
              background: "rgba(255,255,255,0.16)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "8px 14px",
              fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", textAlign: "center",
            }}
          >
            💬 {t("shikshaHubMessagesTitle", "Messages")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, border: active ? "1px solid #14b8a6" : "1px solid var(--border)",
        background: active ? "rgba(20,184,166,0.15)" : "var(--bg-card)",
        color: active ? "#14b8a6" : "var(--text)",
        borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// CARD REDESIGN (desktop layout pass) — the old card spent a fixed 4:3
// aspect-ratio band (roughly half the card's height at typical card
// widths) on a big image area that, for the very common no-profilePic
// case, held nothing but a small centered emoji — exactly the "oversized
// empty image area, tiny avatar" complaint. Replaced with a compact
// header row (72px TutorAvatar + name/verified inline), so every pixel
// of the card is either the avatar or actual information. Reuses the
// existing TutorAvatar/VerifiedBadge/SubjectChips components — no new
// data fields, nothing here reads anything beyond what MarketplaceTutor
// already provides (teachingMode/studentLevels aren't in that public
// mirror, so — same "hide fields that aren't available" rule this file
// already follows for sessionFee/ratingAverage/etc — they're simply not
// shown, rather than displaying invented data).
function TutorCard({ tutor, onClick }: { tutor: MarketplaceTutor; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shikshahub-card"
      style={{
        textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
        borderRadius: 18, background: "var(--bg-card)", padding: 14,
        display: "flex", flexDirection: "column", gap: 8, height: "100%", width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <TutorAvatar tutor={tutor} size={72} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 15, fontWeight: 800, color: "var(--text)", lineHeight: "19px",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
            }}>
              {tutor.name || "Tutor"}
            </span>
            {tutor.ratingAverage != null && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0, fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                ⭐ {tutor.ratingAverage.toFixed(1)}
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>({tutor.ratingCount})</span>
              </span>
            )}
          </div>
          <div style={{ marginTop: 4 }}>
            <VerifiedBadge compact />
          </div>
        </div>
      </div>

      {(!!tutor.qualification || tutor.teachingExperienceYears != null) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
          {!!tutor.qualification && <span>🎓 {tutor.qualification}</span>}
          {!!tutor.qualification && tutor.teachingExperienceYears != null && <span>·</span>}
          {tutor.teachingExperienceYears != null && <span>{tutor.teachingExperienceYears} yrs exp</span>}
        </div>
      )}

      {!!tutor.preferredLanguage && (
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
          🗣️ {tutor.preferredLanguage}
        </span>
      )}

      {tutor.subjects.length > 0 && <SubjectChips subjects={tutor.subjects} limit={3} />}

      {!!tutor.bio && (
        <p className="shikshahub-clamp2" style={{ fontSize: 12, lineHeight: "17px", fontWeight: 500, color: "var(--text-muted)", margin: 0 }}>
          {tutor.bio}
        </p>
      )}

      <div style={{
        marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "center",
        justifyContent: "space-between", fontSize: 12.5, fontWeight: 800, color: "#0d9488",
      }}>
        View Profile
        <span aria-hidden>→</span>
      </div>
    </button>
  );
}
