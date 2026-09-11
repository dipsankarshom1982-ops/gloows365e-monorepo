"use client";

// PATH: apps/web/src/components/ComingSoon.tsx
//
// FIX (bug report — "404 showing on some pages, specially in seekho"):
// several links in the app (seekho subject cards, seekho revision banner,
// the header bell icon → /notifications, the Knowledge Hub section on
// home → /knowledge-hub) pointed at routes that had no page.tsx at all,
// so Next.js rendered its default 404 instead of anything on-brand.
// This is a shared placeholder so those routes render a proper "Coming
// Soon" screen instead of a dead end, styled to match the rest of the app.

import { useRouter } from "next/navigation";

interface Props {
  emoji?: string;
  title: string;
  description?: string;
}

export default function ComingSoon({ emoji = "🚧", title, description }: Props) {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight: "60vh",
        padding: "32px 24px",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 24,
          background: "linear-gradient(135deg, #1e1b4b, #4f46e5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          boxShadow: "0 6px 20px rgba(79,70,229,0.35)",
        }}
      >
        {emoji}
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", margin: 0 }}>
        {title}
      </h1>

      <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, lineHeight: "20px", margin: 0 }}>
        {description ?? "We're still building this. Check back soon — it'll be worth the wait!"}
      </p>

      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        marginTop: 6, padding: "5px 12px", borderRadius: 20,
        background: "rgba(56,189,248,0.12)", color: "#38bdf8",
        fontSize: 12, fontWeight: 700,
      }}>
        ⚡ Coming Soon
      </div>

      <button
        onClick={() => router.back()}
        style={{
          marginTop: 18,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "12px 22px", borderRadius: 12, cursor: "pointer",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          color: "var(--text)", fontSize: 14, fontWeight: 700,
        }}
      >
        ← Go Back
      </button>
    </div>
  );
}
