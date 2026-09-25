"use client";

// PATH: apps/web/src/app/(app)/shikshahub/InstantTutorPanel.tsx
// Web ShikshaHub polish pass — the Instant Tutor hero flow, adapted for
// desktop from apps/mobile/components/shikshahub/InstantTutorSheet.tsx.
//
// Deliberately NOT a literal port: mobile's sheet is a 5-step wizard
// (subject -> class level -> optional description -> matching -> match).
// This is a centered modal (a bottom sheet isn't a native desktop pattern)
// with just two real steps — subject -> best match — dropping the class
// level prefill and the optional free-text description. Those two extra
// steps depend on student-profile class inference and a chat message
// side-channel that add real complexity for a first web pass without
// changing the core promise ("find me a tutor who's online right now").
// Nothing here is fake: the ranking, the "Available Now" status, and the
// Connect Now action all call the exact same real functions
// (rankInstantHelpMatches / requestInstantHelpCall) the mobile flow uses.
//
// No local "waiting" UI after Connect Now — components/InstantHelpBar.tsx
// (mounted globally in (app)/layout.tsx) already picks up the new pending
// request from anywhere in the app, same as mobile's own sheet relies on
// its equivalent global bar.

import { useEffect, useState } from "react";
import type { TutorService } from "@gloows/shared-logic";
import {
  deriveInstantHelpSubjects,
  rankInstantHelpMatches,
  requestInstantHelpCall,
  type InstantHelpCandidate,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import { VerifiedBadge } from "./_shared";

type Step = "subject" | "match" | "nomatch";

export default function InstantTutorPanel({
  open,
  onClose,
  tutors,
  services,
  onBrowseSubject,
  onViewProfile,
}: {
  open: boolean;
  onClose: () => void;
  tutors: MarketplaceTutor[];
  services: TutorService[];
  onBrowseSubject: (subject: string) => void;
  onViewProfile: (uid: string) => void;
}) {
  const [step, setStep] = useState<Step>("subject");
  const [subject, setSubject] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<InstantHelpCandidate[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("subject");
    setSubject(null);
    setCandidates([]);
    setMatchIndex(0);
    setErrorMsg("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const subjects = deriveInstantHelpSubjects(tutors, services);

  function pickSubject(s: string) {
    setSubject(s);
    const ranked = rankInstantHelpMatches(tutors, services, s);
    setCandidates(ranked);
    setMatchIndex(0);
    setStep(ranked.length > 0 ? "match" : "nomatch");
  }

  async function handleConnect() {
    const candidate = candidates[matchIndex];
    if (!candidate?.service?.id) return;
    setConnecting(true);
    setErrorMsg("");
    try {
      await requestInstantHelpCall(candidate.tutor.uid, candidate.service.id);
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not connect right now. Please try another tutor.");
    } finally {
      setConnecting(false);
    }
  }

  const candidate = candidates[matchIndex];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Instant Tutor"
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(440px, calc(100vw - 32px))", maxHeight: "min(600px, calc(100vh - 64px))",
          overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 20, padding: 24, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>⚡ Instant Tutor</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ✕
          </button>
        </div>

        {step === "subject" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
              What subject do you need help with?
            </div>
            {subjects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32 }}>😴</div>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                  No tutors are online for Instant Help right now.
                </div>
                <button
                  onClick={onClose}
                  style={{ marginTop: 10, border: "none", background: "none", color: "#0d9488", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  Browse regular tutors instead
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {subjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => pickSubject(s)}
                    style={{
                      border: "1.5px solid var(--border)", borderRadius: 14, padding: "10px 14px",
                      background: "transparent", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "match" && candidate && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              border: "1px solid var(--border)", borderRadius: 16, padding: 16,
              background: "rgba(20,184,166,0.06)", display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: "var(--text)" }}>{candidate.tutor.name || "Tutor"}</span>
                <VerifiedBadge compact />
              </div>
              {candidate.tutor.ratingAverage != null && candidate.tutor.ratingCount > 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
                  ⭐ {candidate.tutor.ratingAverage.toFixed(1)} · {candidate.tutor.ratingCount} reviews
                </div>
              )}
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>🎓 {candidate.service.subject}</div>
              {candidate.tutor.teachingExperienceYears != null && (
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
                  🧑‍🏫 {candidate.tutor.teachingExperienceYears} years experience
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 800, color: "#10b981", marginTop: 4 }}>🟢 Available Now</div>
              {candidate.service.creditsPerMinute != null && (
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>
                  {candidate.service.creditsPerMinute} credits/min
                </div>
              )}
            </div>

            {errorMsg && <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{errorMsg}</div>}

            <button
              onClick={handleConnect}
              disabled={connecting}
              style={{
                border: "none", borderRadius: 14, padding: "13px 0", background: "#0f766e", color: "#fff",
                fontSize: 14, fontWeight: 800, cursor: connecting ? "default" : "pointer", opacity: connecting ? 0.6 : 1,
              }}
            >
              {connecting ? "Connecting…" : "Connect Now"}
            </button>
            <button
              onClick={() => onViewProfile(candidate.tutor.uid)}
              style={{ border: "none", background: "none", color: "#0d9488", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
            >
              View Profile
            </button>
            {matchIndex < candidates.length - 1 && (
              <button
                onClick={() => setMatchIndex((i) => i + 1)}
                style={{ border: "none", background: "none", color: "var(--text-muted)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >
                Try someone else
              </button>
            )}
          </div>
        )}

        {step === "nomatch" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 32 }}>🤔</div>
              <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
                No matching tutor is available right now
              </div>
            </div>
            <button
              onClick={() => { if (subject) onBrowseSubject(subject); onClose(); }}
              style={{ border: "none", borderRadius: 14, padding: "13px 0", background: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Browse Other Tutors
            </button>
            <button
              onClick={() => { setSubject(null); setStep("subject"); }}
              style={{ border: "none", background: "none", color: "#0d9488", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
            >
              Change Subject
            </button>
          </div>
        )}
      </div>
    </>
  );
}
