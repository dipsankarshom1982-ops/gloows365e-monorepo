"use client";

// PATH: apps/web/src/app/(app)/shikshahub/page.tsx
// ShikshaHub — browsable marketplace of verified Gloows Tutor profiles.
// Mirrors apps/mobile/app/(drawer)/(tabs)/shikshahub.tsx. A flat filterable
// grid (no home/category drill-down split like GloStore) since there's no
// featured-curation source yet — just one subject-chip filter row over the
// full verified-tutor list. See apps/web/src/lib/shikshahub/index.ts for
// the data layer this reads from.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  deriveSubjectChips,
  fetchAllTutors,
  type MarketplaceTutor,
} from "@/lib/shikshahub";

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
      <Hero />

      {!loading && subjectChips.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 16px" }}>
          <Chip label={t("shikshaHubAllSubjects", "All")} active={subject === null} onClick={() => setSubject(null)} />
          {subjectChips.map((s) => (
            <Chip key={s} label={s} active={subject === s} onClick={() => setSubject(s)} />
          ))}
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
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 14, padding: "0 16px 40px",
        }}>
          {filtered.map((tu) => (
            <TutorCard key={tu.uid} tutor={tu} onClick={() => router.push(`/shikshahub/profile?id=${tu.uid}`)} />
          ))}
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
      padding: "16px 20px 26px", borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    }}>
      <div style={{ fontSize: 40, marginTop: 10 }}>🎓</div>
      <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, marginTop: 2 }}>
        {t("shikshaHubTitle", "ShikshaHub")}
      </div>
      <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, marginTop: 4, maxWidth: 420 }}>
        {t("shikshaHubSubtitle", "Verified tutors, ready to teach — browse and find the right fit")}
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
      style={{
        textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
        borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", padding: 0,
      }}
    >
      <div style={{
        height: 120, background: tutor.profilePic ? `url(${tutor.profilePic}) center/cover` : "rgba(20,184,166,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!tutor.profilePic && <span style={{ fontSize: 34 }}>🧑‍🏫</span>}
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{tutor.name || "Tutor"}</span>
        {!!tutor.qualification && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>{tutor.qualification}</span>
        )}
        {tutor.subjects.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#14b8a6" }}>{tutor.subjects.slice(0, 3).join(", ")}</span>
        )}
        {tutor.teachingExperienceYears != null && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>
            {tutor.teachingExperienceYears} yrs experience
          </span>
        )}
      </div>
    </button>
  );
}
