"use client";

// PATH: apps/web/src/app/(app)/settings/report-bug/page.tsx
// Mirrors mobile app/report-bug.tsx
//
// Lets a student submit a manual bug report — writes to the same
// crashReports/{reportId} collection admin's CrashReports.tsx already
// reads (its TYPE_META already has a "📋 Manual Report" badge for this
// exact type), so it shows up alongside automatically-caught crashes.

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { reportBug } from "@/services/crashReporter";

const ACCENT = "#ef4444";

function Icon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "arrow-back": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M328 400L184 256l144-144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  return icons[name] ?? <svg width={size} height={size}/>;
}

export default function ReportBugPage() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b" : "#f8fafc";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const pageBg    = isDarkMode ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)" : colors.background;

  const [description, setDescription] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  const handleSubmit = async () => {
    if (!description.trim() || submitting) return;
    setSubmitting(true);
    try {
      await reportBug(description.trim(), pathname);
      setSubmitted(true);
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 40 }}>

      {/* Title */}
      <div style={{ padding: "16px 20px 20px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🐛 Report a Bug</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: textSec, lineHeight: "20px" }}>
          Found something broken? Tell us what happened and we&apos;ll take a look.
        </div>
      </div>

      {submitted ? (
        <div style={{
          margin: "0 20px 16px", padding: 24, borderRadius: 16, textAlign: "center",
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
            Thanks — your report is in. Our team will look into it.
          </div>
          <button
            onClick={() => setSubmitted(false)}
            style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", color: colors.accent, fontSize: 13, fontWeight: 700 }}
          >
            Report another issue
          </button>
        </div>
      ) : (
        <div style={{ margin: "0 20px 16px", padding: 16, borderRadius: 16, border: `1px solid ${borderCol}`, background: surfaceBg }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: textMain, marginBottom: 10 }}>What went wrong?</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={6}
            placeholder="What were you doing? What did you expect to happen instead?"
            style={{
              width: "100%", resize: "none", padding: 12, borderRadius: 12,
              border: `1px solid ${borderCol}`, background: isDarkMode ? "#0f172a" : "#ffffff",
              color: textMain, fontSize: 13, fontFamily: "inherit",
            }}
          />
          <div style={{ textAlign: "right", fontSize: 11, color: textSec, marginTop: 4 }}>{description.length}/1000</div>
        </div>
      )}

      {!submitted && (
        <div style={{ padding: "0 20px 12px" }}>
          <button
            onClick={handleSubmit}
            disabled={!description.trim() || submitting}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              cursor: description.trim() && !submitting ? "pointer" : "default",
              opacity: description.trim() && !submitting ? 1 : 0.5,
              background: ACCENT, color: "#fff", fontSize: 15, fontWeight: 700,
            }}
          >
            {submitting ? "Sending…" : "Submit Report"}
          </button>
        </div>
      )}

      <div style={{ padding: "8px 20px 0" }}>
        <button
          onClick={() => router.back()}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 0", borderRadius: 12, border: `1px solid ${borderCol}`, cursor: "pointer",
            background: "transparent", color: textSec, fontSize: 14, fontWeight: 700,
          }}
        >
          <Icon name="arrow-back" size={18} color={textSec}/>
          Back to Settings
        </button>
      </div>
    </div>
  );
}
