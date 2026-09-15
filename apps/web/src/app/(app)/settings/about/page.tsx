"use client";

// PATH: apps/web/src/app/(app)/settings/about/page.tsx
// Mirrors mobile app/about.tsx

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

function Icon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "mail-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <rect x="48" y="96" width="416" height="320" rx="40" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M48 116l192 152a48 48 0 0064 0l192-152" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "globe-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="208" stroke={color} strokeWidth={32}/>
        <path d="M48 256h416M256 48c-58.07 111.26-91 176-91 208s32.93 96.74 91 208M256 48c58.07 111.26 91 176 91 208s-32.93 96.74-91 208" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M48 176h416M48 336h416" stroke={color} strokeWidth={32}/>
      </svg>
    ),
    "open-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M320 120h72v72M392 120L272 240M280 88H120a40 40 0 00-40 40v224a40 40 0 0040 40h224a40 40 0 0040-40V312" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
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

type LinkItem = { icon: string; label: string; value: string; href: string };
// FIX (leftover rebrand): these were stale support@nextvidya.in /
// www.nextvidya.in links from before the NextVidya → GLOOWS365E rebrand.
const LINKS: LinkItem[] = [
  { icon: "mail-outline",  label: "Support", value: "support@gloows365.in", href: "mailto:support@gloows365.in" },
  { icon: "globe-outline", label: "Website", value: "www.gloows365.in",     href: "https://www.gloows365.in" },
];

type FeatureItem = { icon: string; title: string; desc: string };
const FEATURES: FeatureItem[] = [
  { icon: "🎓", title: "Seekho",       desc: "Structured video courses from class 4 to 12" },
  { icon: "⚔️", title: "Skill Battle", desc: "Live quiz battles to compete and earn VCoins" },
  { icon: "🤖", title: "AI Guru",      desc: "Personalised AI-powered learning assistant" },
  { icon: "📺", title: "Reels",        desc: "Bite-sized knowledge shorts for quick learning" },
  { icon: "🏅", title: "Starboard",    desc: "Rank among peers and track your progress" },
];

export default function AboutPage() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();

  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b" : "#f8fafc";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";
  const pageBg    = isDarkMode ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)" : colors.background;

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 40 }}>

      {/* App identity */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px" }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, border: `2px solid ${accent}30`,
          background: accent + "15", display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: "#6366f1" }}>GL</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: textMain, marginBottom: 4 }}>GLOOWS365E</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: accent, marginBottom: 10 }}>Learn. Compete. Grow.</div>
        <div style={{ padding: "4px 14px", borderRadius: 20, background: accent + "15" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>Version 1.0.0</span>
        </div>
      </div>

      {/* Mission */}
      <div style={{ margin: "0 20px 24px", padding: 16, borderRadius: 14, border: `1px solid ${borderCol}`, background: surfaceBg }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: textMain }}>🎯 Our Mission</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, fontWeight: 500, color: textSec, marginTop: 8 }}>
          GLOOWS365E is a gamified learning platform built for students from Class 4 to 12.
          We combine structured courses, AI-powered guidance, and competitive quizzes to make
          education engaging, accessible, and effective — in every Indian language.
        </div>
      </div>

      {/* Features */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: textMain, padding: "0 20px", marginBottom: 12 }}>
          ✨ What&apos;s Inside
        </div>
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: 14, borderRadius: 12, border: `1px solid ${borderCol}`, background: surfaceBg,
            }}>
              <span style={{ fontSize: 22 }}>{f.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: textMain }}>{f.title}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: textSec, marginTop: 2 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact / Links */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: textMain, padding: "0 20px", marginBottom: 12 }}>
          📬 Get in Touch
        </div>
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 14, borderRadius: 12, border: `1px solid ${borderCol}`, background: surfaceBg,
                textDecoration: "none",
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: accent + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={link.icon} size={20} color={accent}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: textSec, marginBottom: 2 }}>{link.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: textMain }}>{link.value}</div>
              </div>
              <Icon name="open-outline" size={16} color={textSec}/>
            </a>
          ))}
        </div>
      </div>

      {/* Legal */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: textSec }}>© 2026 GLOOWS365E. All rights reserved.</span>
        <Link href="/settings/privacy" style={{ fontSize: 11, fontWeight: 700, color: accent, textDecoration: "none" }}>
          Privacy Policy
        </Link>
      </div>

      {/* Back */}
      <div style={{ padding: "0 20px" }}>
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
