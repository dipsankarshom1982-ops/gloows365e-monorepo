"use client";

// PATH: apps/web/src/app/(auth)/parent-profile/page.tsx
// Mirrors mobile app/(auth)/parent-profile.tsx.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const RELATIONSHIPS = ["Father", "Mother", "Guardian", "Other"];

export default function ParentProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) { router.replace("/login"); return; }
      try {
        const snap = await getDoc(doc(getFirestore(), "students", user.uid));
        const d = snap.exists() ? snap.data() : null;
        if (d) {
          if (d.parentGuardianName) setFullName(d.parentGuardianName);
          if (d.parentRelationship) setRelationship(d.parentRelationship);
          if (d.parentPhone) setPhone(d.parentPhone);
          if (d.parentPhoneVerified && d.parentPhone) setVerifiedPhone(d.parentPhone);
        }
      } catch { /* blank form */ }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const isVerified = verifiedPhone !== null && verifiedPhone === phone;

  const handleVerify = async () => {
    if (!fullName.trim()) { setError("Please enter your full name"); return; }
    if (!relationship) { setError("Please select your relationship with the student"); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { setError("Enter a valid 10-digit mobile number"); return; }
    const user = getAuth().currentUser;
    if (!user) { setError("Not logged in. Please log in first."); return; }
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(getFirestore(), "students", user.uid), {
        parentGuardianName: fullName.trim(),
        parentRelationship: relationship,
        parentPhone: phone,
        onboardingStep: "parentProfileCompleted",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      router.push(`/phone-verification?phone=${phone}`);
    } catch (e) {
      setError((e instanceof Error && e.message) || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const chip = (sel: boolean): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: 20, cursor: isVerified ? "default" : "pointer",
    border: `1.5px solid ${sel ? "#6366F1" : "#555"}`, background: sel ? "#6366F1" : "transparent",
    color: "#fff", fontSize: 13,
  });

  if (loading) return <div style={page}><p style={{ color: "#fff", textAlign: "center", paddingTop: 80 }}>Loading…</p></div>;

  return (
    <div style={page}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ color: "#c7d2fe", fontSize: 22, textAlign: "center", marginBottom: 24 }}>Set Up Your Parent Profile</h1>

        <label style={label}>Full Name *</label>
        <input style={input} placeholder="Your full name" value={fullName} disabled={isVerified}
          onChange={(e) => setFullName(e.target.value.slice(0, 60))} />

        <label style={label}>Relationship with Student *</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {RELATIONSHIPS.map((r) => (
            <button key={r} type="button" style={chip(relationship === r)} disabled={isVerified}
              onClick={() => setRelationship(r)}>{r}</button>
          ))}
        </div>

        <label style={label}>Mobile Number *</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#c7d2fe", fontWeight: 700 }}>+91</span>
          <input style={{ ...input, flex: 1 }} type="tel" maxLength={10} placeholder="XXXXXXXXXX" value={phone}
            disabled={isVerified} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
        </div>
        {isVerified && <p style={{ color: "#34D399", fontWeight: 700, fontSize: 13, marginTop: 8 }}>✓ Verified</p>}

        {error && <p style={{ color: "#f87171", fontSize: 13, textAlign: "center", marginTop: 14 }}>{error}</p>}

        {isVerified ? (
          <button style={btn} onClick={() => router.replace("/parent-permissions")}>Continue →</button>
        ) : (
          <button style={{ ...btn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleVerify}>
            {saving ? "Saving…" : "Verify Mobile Number"}
          </button>
        )}
      </div>
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100dvh", background: "linear-gradient(160deg, #020617, #1E1B4B, #312E81)", overflowY: "auto" };
const label: React.CSSProperties = { color: "#c7d2fe", fontSize: 13, fontWeight: 600, display: "block", margin: "10px 0 6px" };
const input: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" };
const btn: React.CSSProperties = { width: "100%", marginTop: 24, background: "linear-gradient(90deg,#6366F1,#8B5CF6)", border: "none", borderRadius: 30, padding: "16px 0", fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer" };
