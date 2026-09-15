"use client";

// PATH: apps/web/src/app/(app)/settings/privacy/page.tsx
// Mirrors mobile app/privacy.tsx — accordion-style policy sections

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

function Icon({ name, size = 18, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "chevron-up": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M112 328l144-144 144 144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "chevron-down": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M112 184l144 144 144-144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "mail-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <rect x="48" y="96" width="416" height="320" rx="40" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M48 116l192 152a48 48 0 0064 0l192-152" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
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

type Section = { id: string; icon: string; title: string; body: string };
const SECTIONS: Section[] = [
  {
    id: "collect", icon: "📋", title: "Data We Collect",
    body: "We collect information you provide directly — such as your name, email address, phone number, school, class, and profile picture — when you create or update your account. We also collect usage data like quiz scores, lesson progress, and in-app activity to personalise your learning experience.",
  },
  {
    id: "use", icon: "⚙️", title: "How We Use Your Data",
    body: "Your data is used to deliver and improve the GLOOWS365E learning experience, including personalised content recommendations, progress tracking, leaderboards, and notifications. We do not sell your personal data to third parties.",
  },
  {
    id: "storage", icon: "🗄️", title: "Data Storage & Security",
    body: "All data is stored securely on Google Firebase servers. We apply industry-standard encryption in transit (TLS) and at rest. Access to your data is restricted to authorised GLOOWS365E systems and personnel.",
  },
  {
    id: "third", icon: "🔗", title: "Third-Party Services",
    body: "GLOOWS365E integrates with trusted third-party services including Google Firebase (auth, database, storage), Cloudflare Stream (video delivery), and Razorpay (payments). Each service operates under its own privacy policy.",
  },
  {
    id: "rights", icon: "✅", title: "Your Rights",
    body: "You may request access to, correction of, or deletion of your personal data at any time through Profile Settings → Delete Account, or by contacting us at support@gloows365.in. We will process your request within 30 days.",
  },
  {
    id: "children", icon: "👧", title: "Children's Privacy",
    body: "GLOOWS365E is designed for students and may be used by children under 13 with parental consent. We encourage parents to review their child's account activity. We do not knowingly collect sensitive data from children without verifiable parental consent.",
  },
  {
    id: "updates", icon: "🔄", title: "Policy Updates",
    body: "We may update this Privacy Policy from time to time. When we do, we will notify you via in-app message or email. Continued use of the app after changes constitutes your acceptance of the revised policy.",
  },
];

export default function PrivacyPage() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b" : "#f8fafc";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";
  const pageBg    = isDarkMode ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)" : colors.background;

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ padding: "16px 20px 4px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginBottom: 4 }}>🔒 Privacy Policy</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: textSec, marginBottom: 12 }}>Last updated: May 2026</div>
        <div style={{ border: `1px solid ${accent}30`, borderRadius: 12, padding: 12, background: accent + "15", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: accent, lineHeight: "20px" }}>
            We respect your privacy and are committed to protecting your personal data.
          </span>
        </div>
      </div>

      {/* Accordion sections */}
      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
        {SECTIONS.map((sec) => {
          const open = expanded === sec.id;
          return (
            <div
              key={sec.id}
              style={{
                border: `1px solid ${open ? accent : borderCol}`,
                borderRadius: 14, overflow: "hidden", background: surfaceBg,
              }}
            >
              <button
                onClick={() => toggle(sec.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 14, background: "none", border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 18 }}>{sec.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: textMain, flex: 1 }}>{sec.title}</span>
                </div>
                <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={textSec}/>
              </button>
              {open && (
                <div style={{ fontSize: 13, lineHeight: 1.65, fontWeight: 500, color: textSec, padding: "0 14px 14px" }}>
                  {sec.body}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contact CTA */}
      {/* FIX (leftover rebrand): this said support@nextvidya.in — stale from
          before the NextVidya → GLOOWS365E rebrand. Also made the email
          a real mailto: link since it's meant as a CTA. */}
      <a
        href="mailto:support@gloows365.in"
        style={{
          display: "flex", alignItems: "center", gap: 12,
          margin: "20px 20px 0", padding: 16, borderRadius: 14,
          border: `1px solid ${borderCol}`, background: surfaceBg,
          textDecoration: "none", cursor: "pointer",
        }}
      >
        <Icon name="mail-outline" size={22} color={accent}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: textMain }}>Questions about privacy?</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: textSec, marginTop: 2 }}>support@gloows365.in</div>
        </div>
      </a>

      {/* Back */}
      <div style={{ padding: "20px 20px 0" }}>
        <button
          onClick={() => router.back()}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer",
            background: accent, color: "#fff", fontSize: 15, fontWeight: 700,
          }}
        >
          <Icon name="arrow-back" size={20} color="#fff"/>
          Back to Settings
        </button>
      </div>
    </div>
  );
}
