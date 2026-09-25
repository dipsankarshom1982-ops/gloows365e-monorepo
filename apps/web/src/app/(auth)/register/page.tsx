"use client";

// PATH: apps/web/src/app/(auth)/register/page.tsx
//
// Mirrors mobile app/(auth)/register.tsx exactly:
//   - Full student profile form (name, phone, pincode→location, school, DOB, board, class, language, interests)
//   - Age gate: if age >= 18 → show RestartEducationBlock instead
//   - Referral code (optional, 8-char)
//   - Writes to students/{uid} + users/{uid} with onboardingComplete: true
//   - On success → /home
//   - RestartEducation path → writes profileType to users/{uid} → /restart-education/onboarding
//
// Parent phone OTP verification no longer lives here — it moved to
// (auth)/parent-profile → (auth)/phone-verification → (auth)/parent-permissions,
// which must be completed before this page (enforced by the guard effect below).

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { INDIAN_LANGUAGES, DEFAULT_LANGUAGE, getStoredLanguage, clearStoredLanguage } from "@/lib/languages";
import { TITLES } from "@/lib/avatars";
import { CLASS_RANGE_LABEL, resolveOnboardingRoute, STREAM_CLASS_LEVELS, STUDENT_STREAMS, SUPPORTED_CLASS_LEVEL_STRINGS, type StudentStream } from "@gloows/shared-logic";

// Matches mobile services/referralService.ts — deterministic 8-char code from UID.
// Written to users/{uid} at registration so the referral page can display it
// and friends can enter it. Must produce a valid 8-char alphanumeric string
// because register/page.tsx only accepts codes of exactly length 8.
function generateReferralCode(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const part1 = clean.slice(0, 4).padEnd(4, "X");
  const part2 = clean.slice(-4).padEnd(4, "Y");
  return `${part1}${part2}`;
}

const BOARDS         = ["CBSE", "ICSE", "State Board", "Other"];
const CLASS_OPTIONS  = SUPPORTED_CLASS_LEVEL_STRINGS;
const STREAM_CLASSES = STREAM_CLASS_LEVELS.map(String);
const INTERESTS      = ["Maths","Science","Coding","AI","Robotics","Cricket","Football","Art","Music","GK","Other"];

function calculateAge(dob: string): number {
  const [day, month, year] = dob.split("/").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (
    today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day)
  ) age--;
  return age;
}

// ─── Restart Education block ──────────────────────────────────────────────────
function RestartEducationBlock({ age, onRestart }: { age: number; onRestart: () => void }) {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #0a0a1a, #1a1040, #0d2a1a)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start",
      padding: "40px 24px 48px",
      overflowY: "auto",
    }}>
      <div style={{
        width: 100, height: 100, borderRadius: "50%",
        background: "rgba(22,163,74,0.15)",
        border: "2px solid rgba(22,163,74,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 48, marginBottom: 20,
      }}>🎓</div>

      <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 900, textAlign: "center", marginBottom: 6 }}>
        Welcome!
      </h2>
      <p style={{ color: "#86efac", fontSize: 15, textAlign: "center", marginBottom: 28 }}>
        A different learning path awaits you
      </p>

      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, padding: 18, marginBottom: 16,
      }}>
        <p style={{ color: "#a3e635", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>About this platform</p>
        <p style={{ color: "#d1fae5", fontSize: 14, lineHeight: "22px" }}>
          Gloows365 is designed for current school students in {CLASS_RANGE_LABEL} (under 18 years of age).{" "}
          Based on your age ({age} years), you are eligible for our{" "}
          <strong style={{ color: "#4ade80" }}>Restart My Education</strong> programme — a dedicated
          space for learners who want to continue their education journey after a break.
        </p>
      </div>

      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(22,163,74,0.08)",
        border: "1px solid rgba(22,163,74,0.2)",
        borderRadius: 16, padding: 18, marginBottom: 28,
      }}>
        <p style={{ color: "#86efac", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          What Restart My Education offers:
        </p>
        {[
          { e: "📖", t: "Open Schooling guidance (NIOS & State boards)" },
          { e: "🎓", t: "Distance Learning pathways" },
          { e: "🛠️", t: "Vocational & skill development options" },
          { e: "🤖", t: "Personalised AI Education Advisor" },
          { e: "🌟", t: "Real success stories from learners like you" },
          { e: "🎯", t: "Education Opportunities & scholarships" },
          { e: "🆓", t: "Free personal guidance from our team" },
        ].map((f) => (
          <div key={f.t} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, width: 24 }}>{f.e}</span>
            <span style={{ color: "#d1fae5", fontSize: 13, lineHeight: "20px" }}>{f.t}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onRestart}
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(90deg,#16a34a,#15803d)",
          border: "none", borderRadius: 16,
          padding: "18px 24px", fontSize: 17, fontWeight: 800,
          color: "#fff", cursor: "pointer", marginBottom: 16,
        }}
      >
        Explore Restart My Education →
      </button>

      <p style={{ color: "rgba(134,239,172,0.6)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
        &ldquo;No dream should stop because of circumstances.&rdquo;
      </p>
    </div>
  );
}

// ─── Main registration form ───────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();

  const [name,              setName]              = useState("");
  const [title,             setTitle]             = useState("");
  const [phone,             setPhone]             = useState("");
  const [pincode,           setPincode]           = useState("");
  const [stateVal,          setStateVal]          = useState("");
  const [district,          setDistrict]          = useState("");
  const [area,              setArea]              = useState("");
  const [school,            setSchool]            = useState("");
  const [board,             setBoard]             = useState("");
  const [studentClass,      setStudentClass]      = useState("");
  const [stream,            setStream]            = useState<StudentStream | "">("");
  const isStreamClass = STREAM_CLASSES.includes(studentClass);
  // FEATURE: pre-fill from the language chosen on the welcome screen
  // (see lib/languages.ts) instead of defaulting to blank — the student
  // already told us their language once, no need to ask again here.
  // Falls back to DEFAULT_LANGUAGE ("English") if nothing was stored
  // (e.g. registration reached directly, skipping welcome).
  //
  // BUGFIX (hydration mismatch on the language chip buttons): this used to
  // read getStoredLanguage() straight in the useState initializer. That
  // initializer runs during React's client hydration render too (not just
  // real client-side renders), and this page is statically prerendered
  // (next.config.ts output: "export") — so the server-rendered HTML always
  // has DEFAULT_LANGUAGE selected, while the client's first render could
  // already see a different value from localStorage, giving the selected
  // chip a different border/background color than the server markup and
  // tripping a React hydration warning. Starting from the deterministic
  // default and applying the stored value in an effect (below, after
  // mount) keeps server and client markup identical for hydration, then
  // upgrades to the stored preference a tick later — imperceptible to the
  // user, same eventual pre-fill behavior.
  const [preferredLanguage, setPreferredLanguage] = useState(DEFAULT_LANGUAGE);
  useEffect(() => {
    const stored = getStoredLanguage();
    if (stored) setPreferredLanguage(stored);
  }, []);
  const [dob,               setDob]               = useState("");
  const [interests,         setInterests]         = useState<string[]>([]);
  const [customInterest,    setCustomInterest]    = useState("");
  const [referralCode,      setReferralCode]      = useState("");
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState("");

  // Restart block state
  const [showRestartBlock, setShowRestartBlock] = useState(false);
  const [detectedAge,      setDetectedAge]      = useState(0);

  // Parent phone was collected + OTP-verified upstream (parent-profile →
  // phone-verification → parent-permissions). Read it back for the `phone`
  // field this form still writes, and guard against deep-linking in early.
  useEffect(() => {
    const unsub = getAuth().onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(getFirestore(), "students", user.uid));
        const d = snap.exists() ? snap.data() : undefined;
        const next = resolveOnboardingRoute(d as any);
        if (next === "parent-profile") { router.replace("/parent-profile"); return; }
        if (next === "phone-verification") { router.replace("/phone-verification"); return; }
        if (next === "parent-permissions") { router.replace("/parent-permissions"); return; }
        if (next === "home") { router.replace("/home"); return; }
        if (d?.parentPhone) setPhone(d.parentPhone);
      } catch { /* let the user proceed rather than get stuck */ }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLocation = async (pin: string) => {
    if (pin.length !== 6) return;
    try {
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data[0].Status === "Success") {
        const info = data[0].PostOffice[0];
        setStateVal(info.State);
        setDistrict(info.District);
        setArea(info.Name);
      }
    } catch { /* ignore */ }
  };

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // DOB auto-format: DD/MM/YYYY
  const handleDobChange = (text: string) => {
    let digits    = text.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length > 4) formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    setDob(formatted);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // DOB required first
    if (!dob || !/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
      setError("Please enter a valid date of birth (DD/MM/YYYY)");
      return;
    }

    // Age gate — mirrors mobile
    const age = calculateAge(dob);
    if (age >= 18) {
      setDetectedAge(age);
      setShowRestartBlock(true);
      return;
    }

    // Normal student validation
    if (!name || !title || !phone || !pincode || !school || !board || !studentClass || !preferredLanguage) {
      setError("Please fill all required fields");
      return;
    }
    if (isStreamClass && !stream) {
      setError("Please select your stream");
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      setError("Invalid pincode");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const auth = getAuth();
      const db   = getFirestore();
      const user = auth.currentUser;
      if (!user) { setError("Not logged in. Please log in first."); return; }

      const finalInterests = interests.includes("Other")
        ? [...interests.filter((i) => i !== "Other"), customInterest].filter(Boolean)
        : interests;

      // Avatar precedence: a real Google account photo, if this user signed
      // up/in with Google, is safe to persist — it's a normal raster image
      // URL both web and mobile can render. The Title-derived silhouette is
      // NOT persisted here: it's an SVG data URI, and React Native's Image
      // component can't render those — an account registered on web would
      // show a broken avatar in the mobile app. Instead, leaving profilePic
      // unset when there's no real photo lets each platform compute its own
      // fallback at display time from the `title` field (this file's
      // AppHeader/Drawer callers already do this via defaultAvatarForTitle();
      // the mobile app renders its own native equivalent) — never something
      // written once and shared cross-platform.
      const defaultProfilePic = user.photoURL || "";

      await setDoc(doc(db, "students", user.uid), {
        name, title, phone, school, board,
        class: studentClass, stream: isStreamClass ? (stream || null) : null,
        preferredLanguage,
        dob, age,
        location: { state: stateVal, district, area, pincode },
        interests: finalInterests,
        profilePic: defaultProfilePic,
        stats:           { xp: 0, level: 1, streak: 0 },
        learningProfile: { goal: "Improve learning", dailyTarget: 30 },
        onboardingStep: "studentRegistration",
        onboardingComplete: true,
        createdAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, "users", user.uid), {
        role: "student", roles: ["student"],
        profileType: "student",
        onboardingComplete: true,
        referralCode: generateReferralCode(user.uid),
        createdAt: serverTimestamp(),
      }, { merge: true });

      // FIX (bug report — "200 v-coins not updated"): this used to just
      // set users/{uid}.coins = 200 directly. But hooks/useVCoins.ts (and
      // therefore the Wallet page, header pill, and Drawer balance) only
      // ever reads users/{uid}.vCoinsBalance — a completely different
      // field — so that 200 was written somewhere nothing displays.
      //
      // Then routed through client-side creditVCoins() — since replaced by
      // the creditSignupBonus Cloud Function (functions/src/vcoins.ts):
      // firestore.rules now blocks direct client writes to vCoinsBalance
      // (see that migration's header comment), so the client-side call
      // this used to make would now silently fail. Idempotent server-side
      // (fixed referenceId "signup_bonus" per uid), so it can only ever
      // credit once even if handleRegister somehow runs twice for the same
      // uid — same guarantee the old client-side call relied on.
      try {
        await httpsCallable(functions, "creditSignupBonus")();
      } catch { /* non-fatal — a coin-credit hiccup must never block registration */ }

      // Apply referral code if provided — calls the applyReferral Cloud Function
      // directly via httpsCallable (the previous fetch("/api/apply-referral") was
      // calling a Next.js API route that doesn't exist and can't exist in a static
      // export). The CF validates the code, credits both parties, and writes the
      // referrals/{id} doc atomically — all server-side.
      //
      // NOTE re: "50 v-coins not updated" for referrals — that credit is
      // written entirely inside this Cloud Function, which lives outside
      // this repo (no functions/ source here to inspect). Given the
      // registration bonus above was landing in users/{uid}.coins instead
      // of vCoinsBalance, it's worth checking whether applyReferral has
      // the same field-name mismatch server-side — if it's incrementing
      // something other than vCoinsBalance / writing to a vCoinTransactions
      // doc, the wallet UI won't show it even though the function itself
      // reports success.
      if (referralCode.length === 8) {
        try {
          const applyReferral = httpsCallable<{ code: string }, { success: boolean; coinsEarned: number }>(
            functions, "applyReferral"
          );
          await applyReferral({ code: referralCode });
        } catch { /* non-fatal — referral failure must never block registration */ }
      }

      // Firestore now holds the durable preference — the pre-login
      // localStorage value from welcome has done its job.
      clearStoredLanguage();

      router.replace("/home");

    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Restart Education redirect handler
  const handleRestartRedirect = async () => {
    try {
      const auth = getAuth();
      const db   = getFirestore();
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          name,
          title,
          profilePic: user.photoURL || "",
          preferredLanguage,
          dob,
          age: detectedAge,
          profileType:        "restartEducation",
          onboardingComplete: false,
          createdAt:          serverTimestamp(),
        }, { merge: true });
      }
    } catch { /* non-fatal */ }
    // This flow has its own preferredLanguage write above (to users/{uid},
    // since restart-education profiles aren't students/{uid}) — the
    // pre-login welcome-screen value has done its job either way.
    clearStoredLanguage();
    router.replace("/restart-education/onboarding");
  };

  if (showRestartBlock) {
    return <RestartEducationBlock age={detectedAge} onRestart={handleRestartRedirect} />;
  }

  // ── chip style helper ──
  const chip = (selected: boolean): React.CSSProperties => ({
    paddingInline: 12, paddingBlock: 6,
    borderRadius: 20,
    border: `1.5px solid ${selected ? "#6366F1" : "#555"}`,
    background: selected ? "#6366F1" : "transparent",
    color: "#fff", fontSize: 12, cursor: "pointer",
  });

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #020617, #1E1B4B, #312E81)",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff" }}>
            <span style={{ color: "#A5B4FC" }}>Gl</span>
            <span style={{ color: "#F1F5F9" }}>oows</span>
            <span style={{
              background: "linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 28,
            }}>365</span>
          </div>
          <p style={{ color: "#c7d2fe", fontSize: 15, marginTop: 4 }}>Create Your Profile 🚀</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Name */}
          <input
            style={inputStyle}
            placeholder="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Title — drives the default avatar shown around the app
              until a real photo is uploaded in Settings. */}
          <div>
            <label style={labelStyle}>Title *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TITLES.map((t) => (
                <button key={t} type="button" style={chip(title === t)} onClick={() => setTitle(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Pincode */}
          <div>
            <input
              style={inputStyle}
              placeholder="Pincode *"
              type="tel"
              maxLength={6}
              value={pincode}
              onChange={(e) => { setPincode(e.target.value); fetchLocation(e.target.value); }}
            />
            {stateVal && (
              <p style={{ color: "#34D399", fontSize: 13, marginTop: 6 }}>
                📍 {area}, {district}, {stateVal}
              </p>
            )}
          </div>

          {/* School */}
          <input
            style={inputStyle}
            placeholder="School Name *"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />

          {/* DOB */}
          <input
            style={inputStyle}
            placeholder="Date of Birth * (DD/MM/YYYY)"
            value={dob}
            onChange={(e) => handleDobChange(e.target.value)}
            maxLength={10}
            inputMode="numeric"
          />

          {/* Board */}
          <div>
            <label style={labelStyle}>Board *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BOARDS.map((b) => (
                <button key={b} type="button" style={chip(board === b)} onClick={() => setBoard(b)}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Class */}
          <div>
            <label style={labelStyle}>Class *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CLASS_OPTIONS.map((c) => (
                <button
                  key={c} type="button" style={chip(studentClass === c)}
                  onClick={() => {
                    setStudentClass(c);
                    // Stream only ever applies to Class 11/12 — moving away
                    // from those must never leave a stale stream attached.
                    if (!STREAM_CLASSES.includes(c)) setStream("");
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Stream — Class 11/12 only */}
          {isStreamClass && (
            <div>
              <label style={labelStyle}>Select Stream *</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {STUDENT_STREAMS.map((s) => (
                  <button key={s} type="button" style={chip(stream === s)} onClick={() => setStream(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Language */}
          <div>
            <label style={labelStyle}>Preferred Language *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {INDIAN_LANGUAGES.map((lang) => (
                <button
                  key={lang.name} type="button"
                  style={{
                    ...chip(preferredLanguage === lang.name),
                    display: "flex", flexDirection: "column", alignItems: "center",
                    paddingInline: 14, paddingBlock: 8, gap: 2,
                  }}
                  onClick={() => setPreferredLanguage(lang.name)}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{lang.native}</span>
                  <span style={{ fontSize: 11 }}>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label style={labelStyle}>Interests</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {INTERESTS.map((i) => (
                <button key={i} type="button" style={chip(interests.includes(i))} onClick={() => toggleInterest(i)}>
                  {i}
                </button>
              ))}
            </div>
            {interests.includes("Other") && (
              <input
                style={{ ...inputStyle, marginTop: 8 }}
                placeholder="Enter your interest"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
              />
            )}
          </div>

          {/* Referral */}
          <div>
            <label style={labelStyle}>Referral Code (optional)</label>
            <input
              style={{ ...inputStyle, letterSpacing: 2, fontWeight: 700 }}
              placeholder="Enter friend's referral code"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              maxLength={8}
            />
            {referralCode.length > 0 && referralCode.length < 8 && (
              <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>Code must be 8 characters</p>
            )}
            {referralCode.length === 8 && (
              <p style={{ color: "#34D399", fontSize: 11, marginTop: 4 }}>✓ Code looks good! You&apos;ll get a welcome bonus.</p>
            )}
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "linear-gradient(90deg,#6366F1,#8B5CF6)",
              border: "none", borderRadius: 30,
              paddingBlock: 16, fontSize: 16, fontWeight: 700,
              color: "#fff", cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1, marginTop: 8,
            }}
          >
            {loading ? "Saving..." : "Continue →"}
          </button>

        </form>
      </div>
    </div>
  );
}

// ─── shared local styles ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.06)",
  padding: "14px 16px", borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", fontSize: 15, outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  color: "#c7d2fe", marginBottom: 8,
  fontSize: 13, fontWeight: 600,
  display: "block",
};
