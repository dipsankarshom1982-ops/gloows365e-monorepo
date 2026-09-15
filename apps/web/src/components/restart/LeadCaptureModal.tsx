"use client";

// PATH: apps/web/src/components/restart/LeadCaptureModal.tsx
// Web port of apps/mobile/components/restart/LeadCaptureModal.tsx —
// reusable lead capture form shown after 3 AI advisor messages or from the
// "My Guidance Requests" screen. Writes to the same educationLeads/
// Firestore collection the mobile app and admin's RestartLeads.tsx read.

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry", "Chandigarh",
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function LeadCaptureModal({ visible, onClose, onSubmitted }: Props) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [interestedInEd, setInterestedInEd] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStateList, setShowStateList] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!visible) return null;

  const handleSubmit = async () => {
    setError("");
    if (!name.trim())                  { setError("Please enter your name."); return; }
    if (!/^[6-9]\d{9}$/.test(mobile))  { setError("Please enter a valid 10-digit mobile number."); return; }
    if (!state)                        { setError("Please select your state."); return; }
    if (!district.trim())              { setError("Please enter your district."); return; }
    if (interestedInEd === null)       { setError("Please indicate your interest in education."); return; }
    if (!consent)                      { setError("Please give consent to be contacted."); return; }

    setLoading(true);
    try {
      const user = auth.currentUser;

      let age = 0;
      let lastClass = "";
      let occupation = "";
      let preferredLang = "";

      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          age           = d.age ?? 0;
          lastClass     = d.lastClassPassed ?? "";
          occupation    = d.currentOccupation ?? "";
          preferredLang = d.preferredLanguage ?? "English";
        }
      }

      await addDoc(collection(db, "educationLeads"), {
        userId: user?.uid ?? null,
        name: name.trim(),
        mobile: mobile.trim(),
        state,
        district: district.trim(),
        language: preferredLang || "English",
        age,
        lastClassPassed: lastClass,
        currentOccupation: occupation,
        interestedInContinuingEducation: interestedInEd,
        consentGiven: true,
        status: "New",
        assignedPartner: "",
        notes: "",
        source: "ai-advisor",
        createdAt: serverTimestamp(),
      });

      onSubmitted();
      setDone(true);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    onClose();
  };

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={S.topRow}>
          <div style={S.handle} />
          <button style={S.closeBtn} onClick={handleClose} aria-label="Close">✕</button>
        </div>

        <div style={S.scroll}>
          {done ? (
            <div style={S.doneWrap}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
              <div style={S.headerTitle}>Request Submitted!</div>
              <div style={S.headerSub}>
                Our team will contact you soon to provide free personal guidance on your
                education journey.
              </div>
              <button style={S.submitBtn} onClick={handleClose}>
                <span style={S.submitGradient}>Thank You</span>
              </button>
            </div>
          ) : (
            <>
              <div style={S.headerSection}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🤝</div>
                <div style={S.headerTitle}>Need Personal Guidance?</div>
                <div style={S.headerSub}>
                  Our education assistance is completely free. Our team will personally
                  help you explore the best pathways for your situation.
                </div>
              </div>

              <label style={S.label}>Full Name *</label>
              <input
                style={S.input} placeholder="Your name"
                value={name} onChange={(e) => setName(e.target.value)}
              />

              <label style={S.label}>Mobile Number *</label>
              <input
                style={S.input} placeholder="10-digit mobile" inputMode="numeric"
                maxLength={10} value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
              />

              <label style={S.label}>State *</label>
              <div
                style={S.input}
                onClick={() => setShowStateList((v) => !v)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: state ? "#111" : "#9ca3af" }}>{state || "Select state"}</span>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>{showStateList ? "▲" : "▼"}</span>
                </div>
              </div>
              {showStateList && (
                <div style={S.stateList}>
                  {INDIAN_STATES.map((s) => (
                    <div
                      key={s}
                      style={{ ...S.stateItem, ...(state === s ? S.stateItemActive : {}) }}
                      onClick={() => { setState(s); setShowStateList(false); }}
                    >
                      <span style={{ ...S.stateItemText, ...(state === s ? S.stateItemTextActive : {}) }}>
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <label style={S.label}>District *</label>
              <input
                style={S.input} placeholder="Your district"
                value={district} onChange={(e) => setDistrict(e.target.value)}
              />

              <label style={S.label}>Interested in continuing education? *</label>
              <div style={S.yesNoRow}>
                <button
                  style={{ ...S.yesNoBtn, ...(interestedInEd === true ? S.yesNoBtnActive : {}) }}
                  onClick={() => setInterestedInEd(true)}
                >
                  <span style={{ ...S.yesNoBtnText, ...(interestedInEd === true ? S.yesNoBtnTextActive : {}) }}>
                    ✓ Yes
                  </span>
                </button>
                <button
                  style={{ ...S.yesNoBtn, ...(interestedInEd === false ? S.yesNoBtnActive : {}) }}
                  onClick={() => setInterestedInEd(false)}
                >
                  <span style={{ ...S.yesNoBtnText, ...(interestedInEd === false ? S.yesNoBtnTextActive : {}) }}>
                    Just exploring
                  </span>
                </button>
              </div>

              <div style={S.consentRow} onClick={() => setConsent((v) => !v)}>
                <div style={{ ...S.checkbox, ...(consent ? S.checkboxActive : {}) }}>
                  {consent && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                </div>
                <span style={S.consentText}>
                  I agree to be contacted by the Gloows Education team for free guidance
                  regarding educational opportunities.
                </span>
              </div>

              {error && <div style={S.errorText}>{error}</div>}

              <button
                style={{ ...S.submitBtn, ...((loading || !consent) ? S.submitBtnDisabled : {}) }}
                onClick={handleSubmit}
                disabled={loading || !consent}
              >
                <span style={S.submitGradient}>{loading ? "Submitting…" : "Request Guidance →"}</span>
              </button>

              <div style={S.freeNote}>🆓 This service is completely free. No fees, ever.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 3000,
  },
  sheet: {
    background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "92vh", width: "100%", maxWidth: 480,
    overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
  },
  topRow: { display: "flex", justifyContent: "center", alignItems: "center", padding: 12, position: "relative" },
  handle: { width: 40, height: 4, borderRadius: 2, background: "#E5E7EB" },
  closeBtn: {
    position: "absolute", right: 16, top: 10, background: "none", border: "none",
    color: "#6b7280", fontSize: 16, cursor: "pointer", padding: 4,
  },
  scroll: { padding: "0 20px 32px" },

  headerSection: { textAlign: "center", marginBottom: 24 },
  headerTitle: { fontSize: 20, fontWeight: 800, color: "#111", marginBottom: 6 },
  headerSub: { fontSize: 13, color: "#6B7280", lineHeight: 1.55 },

  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input: {
    border: "1px solid #E5E7EB", borderRadius: 12,
    padding: "12px 14px", fontSize: 14, color: "#111",
    background: "#F9FAFB", marginBottom: 14, width: "100%",
    boxSizing: "border-box", cursor: "pointer",
  },

  stateList: {
    border: "1px solid #E5E7EB", borderRadius: 12, maxHeight: 180,
    overflowY: "auto", marginBottom: 14, marginTop: -8,
  },
  stateItem: { padding: "10px 14px", borderBottom: "0.5px solid #F3F4F6", cursor: "pointer" },
  stateItemActive: { background: "#F0FDF4" },
  stateItemText: { fontSize: 13, color: "#374151" },
  stateItemTextActive: { color: "#16a34a", fontWeight: 700 },

  yesNoRow: { display: "flex", gap: 10, marginBottom: 16 },
  yesNoBtn: {
    flex: 1, padding: "12px 0", borderRadius: 12, textAlign: "center",
    border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer",
  },
  yesNoBtnActive: { background: "#F0FDF4", borderColor: "#16a34a" },
  yesNoBtnText: { color: "#6B7280", fontSize: 14, fontWeight: 600 },
  yesNoBtnTextActive: { color: "#16a34a" },

  consentRow: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, cursor: "pointer" },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, border: "2px solid #D1D5DB",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { background: "#16a34a", borderColor: "#16a34a" },
  consentText: { flex: 1, fontSize: 12, color: "#6B7280", lineHeight: 1.5 },

  errorText: { color: "#dc2626", fontSize: 12, marginBottom: 12 },

  submitBtn: {
    borderRadius: 14, overflow: "hidden", marginBottom: 12, border: "none",
    width: "100%", cursor: "pointer", padding: 0,
  },
  submitBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  submitGradient: {
    display: "block", background: "linear-gradient(135deg, #16a34a, #15803d)",
    color: "#fff", fontSize: 16, fontWeight: 800, padding: "16px 0",
  },
  freeNote: { textAlign: "center", fontSize: 12, color: "#9CA3AF" },

  doneWrap: { textAlign: "center", padding: "20px 0 8px" },
};
