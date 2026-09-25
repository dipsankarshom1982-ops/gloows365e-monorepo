"use client";

// PATH: apps/web/src/app/(app)/settings/language/page.tsx
// Mirrors mobile app/language-settings.tsx exactly
// All 23 languages (English + 22 from 8th Schedule of Constitution)
// Search · current selection pill · list with native script badge · info card

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { INDIAN_LANGUAGES } from "@/lib/languages";

// ─── Icons ────────────────────────────────────────────────────
function Icon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "search-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="221" cy="221" r="157" stroke={color} strokeWidth={32}/>
        <path d="M338 338l134 134" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "close-circle": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M256 48C141.3 48 48 141.3 48 256s93.3 208 208 208 208-93.3 208-208S370.7 48 256 48zm75.3 260.7l-22.6 22.6L256 279.2l-52.7 52.1-22.6-22.6 52.1-52.7-52.1-52.7 22.6-22.6 52.7 52.1 52.7-52.1 22.6 22.6-52.1 52.7 52.1 52.7z"/>
      </svg>
    ),
    "checkmark-circle": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29l-134.4 160a16 16 0 01-12 5.71h-.27a16 16 0 01-11.89-5.3l-57.6-64a16 16 0 1123.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0124.5 20.58z"/>
      </svg>
    ),
    "ellipse-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="208" stroke={color} strokeWidth={32}/>
      </svg>
    ),
    "information-circle-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="208" stroke={color} strokeWidth={32}/>
        <path d="M256 176v16M256 336V240" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "arrow-back": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M328 400L184 256l144-144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  return icons[name] ?? <svg width={size} height={size}/>;
}

// ─── Main Page ────────────────────────────────────────────────
export default function LanguageSettingsPage() {
  const { isDarkMode, colors } = useTheme();
  const { user, studentProfile } = useStudentProfile();
  const router = useRouter();

  const [query,  setQuery]  = useState("");
  const [saving, setSaving] = useState(false);

  const currentLang = studentProfile?.preferredLanguage ?? "English";

  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b" : "#ffffff";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";
  const pageBg    = isDarkMode
    ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)"
    : colors.background;

  const handleSelect = async (lang: string) => {
    if (lang === currentLang || saving || !user) return;
    setSaving(true);
    try {
      const db = getFirestore();
      // FIX (bug report — "language setting not working"): this used to write
      // to users/{uid}, but StudentProfileContext merges students/{uid} ON TOP
      // of users/{uid} (students wins on overlap), and registration writes
      // preferredLanguage to students/{uid}, not users/{uid}. So this update
      // was always being shadowed by the old value already in students/{uid}
      // and never visibly took effect. Writing to students/{uid} instead.
      await updateDoc(doc(db, "students", user.uid), { preferredLanguage: lang });
      // Go back after selection like mobile does
      router.back();
    } catch (e) {
      console.error("Language save error", e);
    } finally {
      setSaving(false);
    }
  };

  const filtered = INDIAN_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.native.includes(query) ||
      l.region.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── Title row ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px 8px",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginBottom: 4 }}>
            🌐 Language
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: textSec, lineHeight: "18px" }}>
            Choose your preferred learning language
          </div>
        </div>
        {saving && (
          <div style={{
            width: 22, height: 22, border: `3px solid ${accent}33`,
            borderTop: `3px solid ${accent}`, borderRadius: "50%",
            animation: "spin 0.8s linear infinite", flexShrink: 0,
          }}/>
        )}
      </div>

      {/* ── Current selection pill ── */}
      {!saving && (
        <div style={{ padding: "0 20px 12px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 20,
            border: `1px solid ${accent}`,
            background: isDarkMode
              ? "linear-gradient(135deg, #1e1b4b, #312e81)"
              : "linear-gradient(135deg, #ede9fe, #ddd6fe)",
          }}>
            <Icon name="checkmark-circle" size={16} color={accent}/>
            <span style={{ fontSize: 14, fontWeight: 800, color: accent }}>{currentLang}</span>
          </div>
        </div>
      )}

      {/* ── Search box ── */}
      <div style={{ padding: "0 20px 16px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          border: `1px solid ${borderCol}`, borderRadius: 14,
          padding: "12px 14px", background: surfaceBg,
        }}>
          <Icon name="search-outline" size={17} color={textSec}/>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search language or region..."
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 15, fontWeight: 500, color: textMain,
            }}
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
            >
              <Icon name="close-circle" size={17} color={textSec}/>
            </button>
          )}
        </div>
      </div>

      {/* ── Language list (mirrors mobile grouped list style) ── */}
      <div style={{ padding: "0 20px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 30, fontSize: 14, color: textSec }}>
            No languages match your search.
          </div>
        )}
        {filtered.map((lang, idx) => {
          const isActive = currentLang === lang.name;
          const isFirst  = idx === 0;
          const isLast   = idx === filtered.length - 1;
          return (
            <button
              key={lang.name}
              onClick={() => handleSelect(lang.name)}
              style={{
                display: "flex", alignItems: "center", gap: 14, width: "100%",
                padding: "14px 16px",
                // FIX (console warning — "mixing shorthand and non-shorthand
                // border properties"): this used to set `border: "1px solid
                // ..."` (shorthand, which internally expands to
                // borderTopWidth/borderTopColor/etc. on all 4 sides) AND
                // `borderTopWidth` directly in the same style object, to
                // collapse the shared edge between adjacent rows in this
                // grouped list. React warns because mixing the two for the
                // same underlying property is order-dependent across
                // re-renders. Replaced with explicit longhand for every
                // side instead — same visual result, no shorthand/longhand
                // conflict.
                borderTopWidth: isFirst ? 1 : 0,
                borderBottomWidth: 1,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderStyle: "solid",
                borderColor: isActive ? accent : borderCol,
                borderRadius: isFirst && isLast ? 14
                  : isFirst ? "14px 14px 0 0"
                  : isLast  ? "0 0 14px 14px"
                  : 0,
                background: isActive ? accent + "18" : surfaceBg,
                cursor: "pointer", textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = isDarkMode ? "#263348" : "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = isActive ? accent + "18" : surfaceBg;
              }}
            >
              {/* Native script badge */}
              <div style={{
                minWidth: 72, padding: "6px 10px", borderRadius: 10,
                background: isActive ? accent + "22" : isDarkMode ? "#334155" : textSec + "18",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: isActive ? accent : textMain }}>
                  {lang.native}
                </span>
              </div>

              {/* Name + region */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: isActive ? accent : textMain, marginBottom: 2 }}>
                  {lang.name}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: textSec }}>
                  {lang.region}
                </div>
              </div>

              {/* Check / circle */}
              {isActive
                ? <Icon name="checkmark-circle" size={22} color={accent}/>
                : <Icon name="ellipse-outline" size={22} color={borderCol}/>
              }
            </button>
          );
        })}
      </div>

      {/* ── Info card ── */}
      <div style={{
        display: "flex", gap: 10, margin: "24px 20px 0",
        padding: 14, borderRadius: 12,
        border: `1px solid ${borderCol}`, background: surfaceBg,
        alignItems: "flex-start",
      }}>
        <Icon name="information-circle-outline" size={18} color={textSec}/>
        <p style={{
          flex: 1, margin: 0, fontSize: 12, fontWeight: 500,
          color: textSec, lineHeight: "18px",
        }}>
          These are the 22 languages listed in the 8th Schedule of the Constitution of India.
          Your selected language will be used to personalise lessons and content across the app.
        </p>
      </div>

      {/* ── Back button ── */}
      <div style={{ padding: "20px 20px 0" }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: "14px 0", borderRadius: 14, cursor: "pointer",
            background: surfaceBg, border: `1px solid ${borderCol}`,
          }}
        >
          <Icon name="arrow-back" size={20} color={textMain}/>
          <span style={{ fontSize: 15, fontWeight: 600, color: textMain }}>Back to Settings</span>
        </button>
      </div>

      <div style={{ height: 40 }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}