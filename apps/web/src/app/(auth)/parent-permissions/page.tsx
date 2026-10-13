"use client";

// PATH: apps/web/src/app/(auth)/parent-permissions/page.tsx
// Mirrors mobile app/(auth)/parent-permissions.tsx — Yes/No controls only.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

// Mirrors mobile app/privacy.tsx's PRIVACY_POLICY_VERSION.
const PRIVACY_POLICY_VERSION = "2026-07-17";

type Answer = boolean | null;

function YesNo({ value, onChange }: { value: Answer; onChange: (v: boolean) => void }) {
  const b = (active: boolean, color: string): React.CSSProperties => ({
    flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 13,
    border: `1.5px solid ${active ? color : "#555"}`, background: active ? color : "transparent",
    color: active ? "#fff" : "#c7d2fe",
  });
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <button type="button" style={b(value === true, "#16a34a")} onClick={() => onChange(true)}>YES</button>
      <button type="button" style={b(value === false, "#dc2626")} onClick={() => onChange(false)}>NO</button>
    </div>
  );
}

export default function ParentPermissionsPage() {
  const router = useRouter();
  const [studentInfo, setStudentInfo] = useState<Answer>(null);
  const [learningActivity, setLearningActivity] = useState<Answer>(null);
  const [importantComms, setImportantComms] = useState<Answer>(null);
  const [promotionalComms, setPromotionalComms] = useState<Answer>(null);
  const [termsAccepted, setTermsAccepted] = useState<Answer>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState<Answer>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canContinue = studentInfo === true && learningActivity === true && importantComms === true
    && termsAccepted === true && privacyAccepted === true;

  const handleContinue = async () => {
    if (!canContinue) { setError("Please answer Yes to all required items to continue"); return; }
    const user = getAuth().currentUser;
    if (!user) { setError("Not logged in. Please log in first."); return; }
    setSaving(true);
    setError("");
    try {
      const db = getFirestore();
      const snap = await getDoc(doc(db, "students", user.uid));
      const parentPhone = snap.exists() ? snap.data()?.parentPhone : undefined;
      await setDoc(doc(db, "students", user.uid), {
        parentPermissions: {
          studentInfo: true,
          learningActivity: true,
          importantCommunications: true,
          promotionalCommunications: promotionalComms === true,
          termsAccepted: true,
          privacyAccepted: true,
          policyVersion: PRIVACY_POLICY_VERSION,
          respondedAt: serverTimestamp(),
        },
        parentalConsent: {
          granted: true,
          grantedAt: serverTimestamp(),
          parentPhone: parentPhone ?? null,
          policyVersion: PRIVACY_POLICY_VERSION,
        },
        onboardingStep: "parentPermissionsCompleted",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      router.replace("/register");
    } catch (e) {
      setError((e instanceof Error && e.message) || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const items: { label: string; q: React.ReactNode; v: Answer; set: (v: boolean) => void }[] = [
    { label: "Student Information", q: "Do you allow Gloows365 to collect and use your student's information for providing educational services?", v: studentInfo, set: setStudentInfo },
    { label: "Learning Activity", q: "Do you allow Gloows365 to record your student's learning activity and progress?", v: learningActivity, set: setLearningActivity },
    { label: "Important Communications", q: "Do you agree to receive important account and educational communications from Gloows365?", v: importantComms, set: setImportantComms },
    { label: "Promotional Communications (optional)", q: "Would you like to receive promotional updates from Gloows365?", v: promotionalComms, set: setPromotionalComms },
    { label: "Terms & Conditions", q: <>Have you read and agree to the <a href="/terms" target="_blank" rel="noreferrer" style={{ color: "#FFD700", fontWeight: 700 }}>Terms &amp; Conditions</a>?</>, v: termsAccepted, set: setTermsAccepted },
    { label: "Privacy Policy", q: <>Have you read and agree to the <a href="/settings/privacy" target="_blank" rel="noreferrer" style={{ color: "#FFD700", fontWeight: 700 }}>Privacy Policy</a>?</>, v: privacyAccepted, set: setPrivacyAccepted },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg, #020617, #1E1B4B, #312E81)", overflowY: "auto" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 900, textAlign: "center", marginBottom: 20 }}>Parent Permissions</h1>
        {items.map((it) => (
          <div key={it.label} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: "20px", marginBottom: 10 }}>{it.q}</p>
            <p style={{ color: "#A5B4FC", fontSize: 12, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>{it.label}</p>
            <YesNo value={it.v} onChange={it.set} />
          </div>
        ))}
        {error && <p style={{ color: "#f87171", fontSize: 13, textAlign: "center" }}>{error}</p>}
        <button disabled={!canContinue || saving} onClick={handleContinue} style={{
          width: "100%", marginTop: 8, background: "linear-gradient(90deg,#6366F1,#8B5CF6)", border: "none",
          borderRadius: 30, padding: "16px 0", fontSize: 15, fontWeight: 700, color: "#fff",
          cursor: !canContinue || saving ? "not-allowed" : "pointer", opacity: !canContinue || saving ? 0.5 : 1,
        }}>
          {saving ? "Saving…" : "Continue to Student Registration →"}
        </button>
      </div>
    </div>
  );
}
