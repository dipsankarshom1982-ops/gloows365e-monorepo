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
// richer per-card info, and a slightly more polished hero. No rating field
// is rendered anywhere — functions/src/tutorMarketplace.ts's SAFE_FIELDS
// list (mirrored into MarketplaceTutor) has no such field, so there is
// nothing real to show; not shown here rather than invented.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  deriveSubjectChips,
  fetchAllTutors,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import { ShikshaHubStyles, SubjectChips, VerifiedBadge } from "./_shared";

export default function ShikshaHubPage() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const [tutors, setTutors]   = useState<MarketplaceTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState<string | null>(null);

  useEffect(() => {
    fetchAllTutors().then(setTutors).finally(() => setLoading(false));
  }, []);

  const subjectChips = useMemo(() => deriveSubjectChips(tutors), [tutors]);
  const filtered = useMemo(
    () => (subject ? tutors.filter((tu) => tu.subjects.includes(subject)) : tutors),
    [tutors, subject]
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <ShikshaHubStyles />
      <Hero />

      {!loading && subjectChips.length > 0 && (
        <div className="shikshahub-container" style={{ padding: "0 16px 18px" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            <Chip label={t("shikshaHubAllSubjects", "All")} active={subject === null} onClick={() => setSubject(null)} />
            {subjectChips.map((s) => (
              <Chip key={s} label={s} active={subject === s} onClick={() => setSubject(s)} />
            ))}
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
      <div className="shikshahub-container" style={{ padding: 0 }}>
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

function TutorCard({ tutor, onClick }: { tutor: MarketplaceTutor; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shikshahub-card"
      style={{
        textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
        borderRadius: 18, overflow: "hidden", background: "var(--bg-card)", padding: 0,
        display: "flex", flexDirection: "column", height: "100%", width: "100%",
      }}
    >
      <div style={{
        position: "relative", aspectRatio: "4 / 3",
        background: tutor.profilePic ? `url(${tutor.profilePic}) center/cover` : "rgba(20,184,166,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!tutor.profilePic && <span style={{ fontSize: 38 }}>🧑‍🏫</span>}
        <div style={{ position: "absolute", top: 10, left: 10 }}>
          <VerifiedBadge compact />
        </div>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", lineHeight: "19px" }}>
          {tutor.name || "Tutor"}
        </span>

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
      </div>
    </button>
  );
}
