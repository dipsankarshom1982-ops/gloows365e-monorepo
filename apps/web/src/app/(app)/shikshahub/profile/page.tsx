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

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import { fetchTutorById, type MarketplaceTutor } from "@/lib/shikshahub";

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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 60 }}>
      <div style={{
        position: "relative", height: 220,
        background: tutor.profilePic ? `url(${tutor.profilePic}) center/cover` : "linear-gradient(135deg, #0f766e, #14b8a6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <button
          onClick={() => router.back()}
          style={{ position: "absolute", top: 14, left: 16, width: 38, height: 38, borderRadius: 19, background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}
        >
          ‹
        </button>
        {!tutor.profilePic && <span style={{ fontSize: 56 }}>🧑‍🏫</span>}
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>{tutor.name || "Tutor"}</div>

        {tutor.subjects.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tutor.subjects.map((s) => (
              <span key={s} style={{ fontSize: 11, fontWeight: 700, border: "1px solid #14b8a6", borderRadius: 20, padding: "5px 10px", color: "#14b8a6" }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {!!tutor.qualification && (
          <Field label={t("shikshaHubQualificationLabel", "Qualification")} value={tutor.qualification} />
        )}
        {tutor.teachingExperienceYears != null && (
          <Field label={t("shikshaHubExperienceLabel", "Experience")} value={`${tutor.teachingExperienceYears} years`} />
        )}
        {!!tutor.preferredLanguage && (
          <Field label={t("shikshaHubLanguageLabel", "Preferred Language")} value={tutor.preferredLanguage} />
        )}
        {!!tutor.bio && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>
              {t("shikshaHubBioLabel", "About")}
            </div>
            <div style={{ fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--text)" }}>{tutor.bio}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{value}</div>
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
