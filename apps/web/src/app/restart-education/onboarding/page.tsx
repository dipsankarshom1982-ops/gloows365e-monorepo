"use client";

// PATH: apps/web/src/app/restart-education/onboarding/page.tsx
// Web port of apps/mobile/app/restart-education/onboarding.tsx — same
// 3-step wizard, same Firestore writes to users/{uid}, same field names,
// so the mobile and web apps produce identical profile data.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import AuthGuard from "@/components/layout/AuthGuard";

const LAST_CLASS_OPTIONS = [
  "Class 5 or below", "Class 6", "Class 7", "Class 8",
  "Class 9", "Class 10 (Failed)", "Class 10 (Passed)",
  "Class 11", "Class 12 (Failed)", "Class 12 (Passed)",
  "Graduate (incomplete)", "Never attended school",
];

const OCCUPATION_OPTIONS = [
  "Currently unemployed", "Daily wage worker", "Working in family business",
  "Private job / employed", "Farming / agriculture", "Homemaker", "Other",
];

const GAP_REASONS = [
  "Financial difficulties", "Family responsibilities", "Marriage",
  "Health issues", "Had to start working", "School not available nearby",
  "Lost interest / motivation", "Other",
];

function OnboardingContent() {
  const router = useRouter();

  const [lastClass, setLastClass] = useState("");
  const [occupation, setOccupation] = useState("");
  const [gapReason, setGapReason] = useState("");
  const [otherOccupation, setOtherOccupation] = useState("");
  const [otherReason, setOtherReason] = useState("");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleComplete = async () => {
    if (!lastClass || !occupation || !gapReason) {
      setError("Please complete all selections.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Session expired. Please login again.");
        setLoading(false);
        return;
      }

      await setDoc(doc(db, "users", user.uid), {
        lastClassPassed:    lastClass,
        currentOccupation:  occupation === "Other" ? (otherOccupation || "Other") : occupation,
        educationGapReason: gapReason  === "Other" ? (otherReason     || "Other") : gapReason,
        onboardingComplete: true,
        profileType:        "restartEducation",
        updatedAt:          serverTimestamp(),
      }, { merge: true });

      router.replace("/restart-education/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const canGoNext = step === 1 ? !!lastClass : !!occupation;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerTitle}>🎓 Restart My Education</div>
        <div style={S.stepRow}>
          {([1, 2, 3] as const).map((s) => (
            <div key={s} style={{ ...S.stepDot, ...(step >= s ? S.stepDotActive : {}) }} />
          ))}
        </div>
        <div style={S.stepLabel}>Step {step} of 3</div>
      </div>

      <div style={S.scroll}>
        {step === 1 && (
          <div style={S.stepCard}>
            <div style={S.question}>What was the last class you attended?</div>
            <div style={S.subQuestion}>This helps us find the right pathway for you</div>
            <div style={S.optionsGrid}>
              {LAST_CLASS_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  style={{ ...S.optionChip, ...(lastClass === opt ? S.optionChipActive : {}) }}
                  onClick={() => setLastClass(opt)}
                >
                  <span style={{ ...S.optionText, ...(lastClass === opt ? S.optionTextActive : {}) }}>
                    {opt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={S.stepCard}>
            <div style={S.question}>What are you currently doing?</div>
            <div style={S.subQuestion}>No judgment — we&apos;re here to help everyone</div>
            <div style={S.optionsList}>
              {OCCUPATION_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  style={{ ...S.optionRow, ...(occupation === opt ? S.optionRowActive : {}) }}
                  onClick={() => setOccupation(opt)}
                >
                  <div style={{ ...S.radio, ...(occupation === opt ? S.radioActive : {}) }}>
                    {occupation === opt && <div style={S.radioDot} />}
                  </div>
                  <span style={{ ...S.optionRowText, ...(occupation === opt ? S.optionTextActive : {}) }}>
                    {opt}
                  </span>
                </button>
              ))}
            </div>
            {occupation === "Other" && (
              <input
                style={S.input}
                placeholder="Please describe..."
                value={otherOccupation}
                onChange={(e) => setOtherOccupation(e.target.value)}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div style={S.stepCard}>
            <div style={S.question}>Why did you stop your education?</div>
            <div style={S.subQuestion}>
              Your story matters — understanding your situation helps us guide you better
            </div>
            <div style={S.optionsList}>
              {GAP_REASONS.map((opt) => (
                <button
                  key={opt}
                  style={{ ...S.optionRow, ...(gapReason === opt ? S.optionRowActive : {}) }}
                  onClick={() => setGapReason(opt)}
                >
                  <div style={{ ...S.radio, ...(gapReason === opt ? S.radioActive : {}) }}>
                    {gapReason === opt && <div style={S.radioDot} />}
                  </div>
                  <span style={{ ...S.optionRowText, ...(gapReason === opt ? S.optionTextActive : {}) }}>
                    {opt}
                  </span>
                </button>
              ))}
            </div>
            {gapReason === "Other" && (
              <input
                style={S.input}
                placeholder="Please describe..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            )}
          </div>
        )}

        {error && <div style={S.error}>{error}</div>}

        <div style={S.btnRow}>
          {step > 1 && (
            <button style={S.backBtn} onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              ← <span style={S.backBtnText}>Back</span>
            </button>
          )}

          {step < 3 ? (
            <button
              style={{ ...S.nextBtn, ...(!canGoNext ? { opacity: 0.4 } : {}) }}
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={!canGoNext}
            >
              <span style={S.nextBtnGradient}>Next →</span>
            </button>
          ) : (
            <button
              style={{ ...S.nextBtn, ...((!gapReason || loading) ? { opacity: 0.4 } : {}) }}
              onClick={handleComplete}
              disabled={!gapReason || loading}
            >
              <span style={S.nextBtnGradient}>{loading ? "Please wait…" : "Let's Begin! 🚀"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RestartOnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingContent />
    </AuthGuard>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "linear-gradient(160deg, #0a0a1a, #1a1040, #0d2a1a)",
  },
  header: { textAlign: "center", padding: "20px 20px 16px" },
  headerTitle: { color: "#4ade80", fontSize: 18, fontWeight: 800, marginBottom: 12 },
  stepRow: { display: "flex", justifyContent: "center", gap: 8, marginBottom: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.2)" },
  stepDotActive: { background: "#4ade80", width: 24 },
  stepLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  scroll: { maxWidth: 560, margin: "0 auto", padding: "8px 20px 40px" },
  stepCard: { marginBottom: 24 },
  question: { color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 6, lineHeight: 1.4 },
  subQuestion: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 20, lineHeight: 1.5 },
  optionsGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  optionChip: {
    padding: "10px 14px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)", cursor: "pointer",
  },
  optionChipActive: { background: "rgba(22,163,74,0.25)", borderColor: "#4ade80" },
  optionText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  optionTextActive: { color: "#4ade80", fontWeight: 700 },
  optionsList: { display: "flex", flexDirection: "column", gap: 10 },
  optionRow: {
    display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
    cursor: "pointer", textAlign: "left", width: "100%",
  },
  optionRowActive: { borderColor: "#4ade80", background: "rgba(22,163,74,0.1)" },
  optionRowText: { color: "rgba(255,255,255,0.8)", fontSize: 14, flex: 1 },
  radio: {
    width: 20, height: 20, borderRadius: 10, border: "2px solid rgba(255,255,255,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  radioActive: { borderColor: "#4ade80" },
  radioDot: { width: 10, height: 10, borderRadius: 5, background: "#4ade80" },
  input: {
    background: "rgba(255,255,255,0.06)", padding: 14, borderRadius: 12, color: "#fff",
    marginTop: 10, border: "1px solid rgba(255,255,255,0.1)", width: "100%", boxSizing: "border-box",
    fontSize: 14,
  },
  error: { color: "#F87171", textAlign: "center", marginBottom: 12, fontSize: 13 },
  btnRow: { display: "flex", gap: 12, alignItems: "center" },
  backBtn: {
    display: "flex", alignItems: "center", gap: 4, padding: "16px 8px",
    background: "none", border: "none", color: "#86efac", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  backBtnText: { color: "#86efac" },
  nextBtn: { flex: 1, borderRadius: 14, overflow: "hidden", border: "none", padding: 0, cursor: "pointer" },
  nextBtnGradient: {
    display: "block", padding: "16px 0", textAlign: "center",
    background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 16, fontWeight: 800,
  },
};
