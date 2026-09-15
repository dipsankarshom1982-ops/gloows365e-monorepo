"use client";

// PATH: apps/web/src/app/(auth)/welcome/page.tsx
//
// Mirrors mobile app/(auth)/welcome.tsx exactly:
//   - Same brand logo (Gloows + gradient pill + E)
//   - Same "Start Learning →" CTA → /login
//   - Same deep-purple gradient background
//   - CSS animation replaces react-native-reanimated floating effect
//
// FEATURE (bug report — "language option on welcome screen does nothing"):
// previously only showed 5 languages and selecting one was purely cosmetic —
// `selectedLang` was local state never read anywhere else, and "Start
// Learning" always routed to /login regardless of what was tapped.
//
// Now:
//   - Shows all 23 supported languages (English + 22 from the 8th Schedule
//     of the Constitution of India), from the shared list in lib/languages.
//   - English is selected by default.
//   - Tapping a language immediately saves it via setStoredLanguage(), which
//     LanguageContext reads as a fallback for any visitor who doesn't have a
//     Firestore profile yet — so the whole app (including the login/register
//     screens that follow) switches to that language right away.
//   - register/page.tsx reads the same stored value to pre-select the
//     language chip there too, instead of defaulting to blank.
//
// FIX (spec change — install prompt moved app-wide): this page used to
// render <InstallPrompt /> as a secondary, easy-to-miss button at the
// bottom of the welcome screen. Per updated spec, installing is now an
// upfront "Install Gloows365E?" Yes/No dialog shown on page load across
// the whole site (see components/InstallDialog.tsx, mounted in
// layout.tsx) — so the in-page button here was removed to avoid asking
// twice in two different ways.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { INDIAN_LANGUAGES, DEFAULT_LANGUAGE, getStoredLanguage, setStoredLanguage } from "@/lib/languages";

export default function WelcomePage() {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Pick up a choice from an earlier visit (e.g. user went back to
    // welcome after starting login), so the chip reflects it on return.
    const stored = getStoredLanguage();
    if (stored) setSelectedLang(stored);
  }, []);

  const handleSelectLanguage = (lang: string) => {
    setSelectedLang(lang);
    setStoredLanguage(lang);
  };

  const handleGetStarted = () => {
    setStoredLanguage(selectedLang);
    router.push("/login");
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #1E1B4B, #4F46E5, #7C3AED)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Glow blobs — mirrors mobile glow1 / glow2 */}
      <div style={{
        position: "absolute", top: 60, left: -50,
        width: 200, height: 200, borderRadius: "50%",
        background: "#818CF8", opacity: 0.2, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 80, right: -40,
        width: 180, height: 180, borderRadius: "50%",
        background: "#C084FC", opacity: 0.2, pointerEvents: "none",
      }} />

      {/* Floating logo — CSS animation replaces RN Animated */}
      <div style={{
        animation: mounted ? "float 4s ease-in-out infinite" : "none",
        marginBottom: 10,
      }}>
        {/* Brand logo — exact match to mobile BrandLogo component */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 5,
        }}>
          <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: -0.5 }}>
            <span style={{ color: "#A5B4FC" }}>Gl</span>
            <span style={{ color: "#F1F5F9" }}>oows</span>
          </span>
          {/* Gradient pill for "365" */}
          <span style={{
            background: "linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899)",
            borderRadius: 11,
            paddingInline: 10,
            paddingBlock: 3,
            fontSize: 22,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: 0.5,
            display: "inline-flex",
            alignItems: "center",
          }}>365</span>
          <span style={{
            fontSize: 16, fontWeight: 900, color: "#FBBF24",
            marginBottom: 18,
          }}>E</span>
        </div>
      </div>

      {/* Hook text */}
      <p style={{
        textAlign: "center", color: "#E0E7FF",
        marginTop: 10, marginBottom: 25,
        fontSize: 15, lineHeight: "22px",
      }}>
        Learn smarter. Grow faster.{"\n"}
        Your personal AI teacher is ready 🚀
      </p>

      {/* Language selector */}
      <p style={{
        color: "#C7D2FE", fontSize: 12, fontWeight: 700,
        marginBottom: 10, letterSpacing: 0.3,
      }}>
        🌐 Choose your language
      </p>
      <div style={{
        display: "flex", flexWrap: "wrap",
        justifyContent: "center", gap: 8,
        marginBottom: 18,
        maxHeight: 168, overflowY: "auto",
        maxWidth: 380, padding: "2px 4px",
      }}>
        {INDIAN_LANGUAGES.map((lang) => {
          const active = selectedLang === lang.name;
          return (
            <button
              key={lang.name}
              onClick={() => handleSelectLanguage(lang.name)}
              style={{
                border: `1px solid ${active ? "#fff" : "rgba(255,255,255,0.4)"}`,
                paddingInline: 12, paddingBlock: 7,
                borderRadius: 25,
                background: active ? "#fff" : "rgba(255,255,255,0.08)",
                color: active ? "#312E81" : "#fff",
                fontSize: 12, cursor: "pointer",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontWeight: 700 }}>{lang.native}</span>
              {lang.name !== lang.native && (
                <span style={{ fontSize: 10, opacity: active ? 0.7 : 0.65 }}>{lang.name}</span>
              )}
            </button>
          );
        })}
      </div>
      <p style={{ color: "#A5B4FC", fontSize: 11, marginBottom: 22 }}>
        Selected: <strong style={{ color: "#fff" }}>{selectedLang}</strong> — you can change this anytime in Settings
      </p>

      {/* CTA button */}
      <button
        onClick={handleGetStarted}
        style={{
          background: "linear-gradient(135deg,#ffffff,#E0E7FF)",
          border: "none",
          borderRadius: 30,
          paddingInline: 60, paddingBlock: 16,
          fontSize: 16, fontWeight: "bold",
          color: "#312E81", cursor: "pointer",
          transition: "opacity 0.2s, transform 0.1s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
        onMouseOut={(e)  => (e.currentTarget.style.opacity = "1")}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={(e)   => (e.currentTarget.style.transform = "scale(1)")}
      >
        Start Learning →
      </button>

      {/* Micro trust line */}
      <p style={{ marginTop: 20, color: "#C7D2FE", fontSize: 12 }}>
        Join thousands of students learning daily
      </p>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
