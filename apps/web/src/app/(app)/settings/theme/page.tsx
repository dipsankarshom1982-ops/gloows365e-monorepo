"use client";

// PATH: apps/web/src/app/(app)/settings/theme/page.tsx
// Theme settings — mirrors mobile settings.tsx dark/light toggle behaviour
// but expands it into a proper page with visual theme cards + live preview
// Uses exact same color tokens as mobile ThemeContext.tsx (darkColors / lightColors)

import { useRouter } from "next/navigation";
import { useTheme, darkColors, lightColors } from "@/context/ThemeContext";

// ─── Icons ────────────────────────────────────────────────────
function Icon({ name, size = 22, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "moon": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M283.2 512a228.6 228.6 0 01-92.6-19.4A236.7 236.7 0 0119.4 283.2C7.3 226.1 14.6 169.5 39.8 120.4s65.8-89.5 116.1-113.8A36 36 0 01201 34.7a34.9 34.9 0 0113.7 32.2 197.5 197.5 0 0026.6 152.7 197.8 197.8 0 00131 87.7 34.9 34.9 0 0127.8 21.4 36 36 0 01-2.6 45.4 237.4 237.4 0 01-114.3 138z" />
      </svg>
    ),
    "sunny": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <circle cx="256" cy="256" r="80" />
        <path d="M256 48v48M256 416v48M147 109l34 34M331 331l34 34M48 256h48M416 256h48M147 403l34-34M331 181l34-34" stroke={color} strokeWidth={40} strokeLinecap="round" />
      </svg>
    ),
    "checkmark-circle": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29l-134.4 160a16 16 0 01-12 5.71h-.27a16 16 0 01-11.89-5.3l-57.6-64a16 16 0 1123.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0124.5 20.58z" />
      </svg>
    ),
    "arrow-back": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M328 400L184 256l144-144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };
  return icons[name] ?? <svg width={size} height={size} />;
}

// ─── Mini UI preview card — shows what the theme looks like ───
function ThemePreview({ isDark }: { isDark: boolean }) {
  const c = isDark ? darkColors : lightColors;
  const accent = isDark ? "#38bdf8" : "#3b82f6";

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      background: c.background,
      border: `1px solid ${isDark ? "rgba(56,189,248,0.15)" : "#e5e7eb"}`,
      width: "100%", padding: 12,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {/* Fake header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <div style={{ width: 22, height: 8, borderRadius: 4, background: accent }} />
          <div style={{ width: 14, height: 8, borderRadius: 4, background: c.textSecondary, opacity: 0.5 }} />
        </div>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: accent + "33", border: `2px solid ${accent}` }} />
      </div>
      {/* Fake card */}
      <div style={{ background: c.card, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: accent + "22", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ width: "70%", height: 7, borderRadius: 4, background: c.text, opacity: 0.7 }} />
          <div style={{ width: "45%", height: 5, borderRadius: 4, background: c.textSecondary, opacity: 0.5 }} />
        </div>
        <div style={{ width: 28, height: 14, borderRadius: 8, background: accent + "44" }} />
      </div>
      {/* Fake nav */}
      <div style={{ display: "flex", gap: 6, justifyContent: "space-around" }}>
        {[accent, c.textSecondary, c.textSecondary, c.textSecondary].map((col, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: i === 0 ? accent + "22" : "transparent" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: 3, background: col, opacity: i === 0 ? 1 : 0.35 }} />
            </div>
            <div style={{ width: 20, height: 4, borderRadius: 2, background: col, opacity: i === 0 ? 1 : 0.3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Theme option card ────────────────────────────────────────
function ThemeCard({
  isDark, isSelected, onSelect, accentSel,
}: {
  isDark: boolean; isSelected: boolean; onSelect: () => void; accentSel: string;
}) {
  const label = isDark ? "Dark" : "Light";
  const icon  = isDark ? "moon" : "sunny";
  const iconColor = isDark ? "#818cf8" : "#f59e0b";

  return (
    <button
      onClick={onSelect}
      style={{
        flex: 1, display: "flex", flexDirection: "column", gap: 12,
        padding: 16, borderRadius: 20, cursor: "pointer",
        border: isSelected ? `2px solid ${accentSel}` : "2px solid transparent",
        background: isSelected
          ? (isDark ? "rgba(56,189,248,0.08)" : "rgba(59,130,246,0.08)")
          : (isDark ? "#0f172a" : "#f8fafc"),
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
        boxShadow: isSelected ? `0 0 0 4px ${accentSel}22` : "none",
      }}
    >
      {/* Preview */}
      <ThemePreview isDark={isDark} />

      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name={icon} size={20} color={iconColor} />
          <span style={{
            fontSize: 15, fontWeight: 700,
            color: isDark ? "#f1f5f9" : "#1e293b",
          }}>
            {label}
          </span>
        </div>
        {isSelected && <Icon name="checkmark-circle" size={22} color={accentSel} />}
      </div>

      {/* Description */}
      <p style={{
        margin: 0, fontSize: 12, fontWeight: 500, textAlign: "left",
        color: isDark ? "#94a3b8" : "#64748b",
        lineHeight: "16px",
      }}>
        {isDark
          ? "Deep navy background — easier on the eyes at night"
          : "Clean white background — great for reading in daylight"}
      </p>
    </button>
  );
}

// ─── Color swatch row ─────────────────────────────────────────
function ColorPalette({ isDark }: { isDark: boolean }) {
  const c = isDark ? darkColors : lightColors;
  const accent = isDark ? "#38bdf8" : "#3b82f6";
  const swatches = [
    { label: "Background", color: c.background },
    { label: "Card",       color: c.card },
    { label: "Accent",     color: accent },
    { label: "Text",       color: c.text },
    { label: "Muted",      color: c.textSecondary },
  ];
  const textSec = isDark ? "#94a3b8" : "#64748b";

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {swatches.map((s) => (
        <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: s.color,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          }} />
          <span style={{ fontSize: 9, fontWeight: 600, color: textSec, textAlign: "center", maxWidth: 36 }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ThemeSettingsPage() {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const router = useRouter();

  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";
  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b"  : "#ffffff";
  const borderCol = isDarkMode ? "#334155"  : "#e2e8f0";
  const pageBg    = isDarkMode
    ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)"
    : colors.background;

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── Page title ── */}
      <div style={{ padding: "16px 20px 4px" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: accent, marginBottom: 4 }}>
          {isDarkMode ? "🌙" : "☀️"} Theme
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: textSec }}>
          Choose how Gloows365E looks to you
        </div>
      </div>

      {/* ── Theme selector cards ── */}
      <div style={{ padding: "20px 20px 0", display: "flex", gap: 12 }}>
        <ThemeCard
          isDark={true}
          isSelected={isDarkMode}
          onSelect={() => { if (!isDarkMode) toggleTheme(); }}
          accentSel={accent}
        />
        <ThemeCard
          isDark={false}
          isSelected={!isDarkMode}
          onSelect={() => { if (isDarkMode) toggleTheme(); }}
          accentSel={accent}
        />
      </div>

      {/* ── Current theme indicator (mirrors mobile LinearGradient card) ── */}
      <div style={{
        margin: "20px 20px 0",
        padding: 16, borderRadius: 14,
        border: `1px solid ${isDarkMode ? "#3730a3" : "#c7d2fe"}`,
        background: isDarkMode
          ? "linear-gradient(135deg, #1e1b4b, #1e293b)"
          : "linear-gradient(135deg, #f0f4ff, #e8eeff)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: textSec }}>Current Theme:</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: isDarkMode ? "#818cf8" : "#4f46e5" }}>
          {isDarkMode ? "🌙 Dark" : "☀️ Light"}
        </span>
      </div>

      {/* ── Color palette section ── */}
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>
          Active Palette
        </div>
        <div style={{
          padding: 16, borderRadius: 14, background: surfaceBg,
          border: `1px solid ${borderCol}`,
        }}>
          <ColorPalette isDark={isDarkMode} />
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${borderCol}` }}>
            <span style={{ fontSize: 11, color: textSec, fontWeight: 500 }}>
              {isDarkMode
                ? "Indigo-900 base · Sky-400 accent · Slate text scale"
                : "White base · Blue-500 accent · Gray text scale"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Info card ── */}
      <div style={{
        margin: "16px 20px 0", padding: 14, borderRadius: 12,
        border: `1px solid ${borderCol}`, background: surfaceBg,
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: textSec, lineHeight: "18px" }}>
          Your theme preference is saved locally on this device. Switching themes applies instantly across all pages of the app.
        </p>
      </div>

      {/* ── Go Back button ── */}
      <div style={{ padding: "24px 20px 0" }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", padding: "14px 0", borderRadius: 14, cursor: "pointer",
            background: surfaceBg, border: `1px solid ${borderCol}`,
          }}
        >
          <Icon name="arrow-back" size={20} color={textMain} />
          <span style={{ fontSize: 15, fontWeight: 700, color: textMain }}>Back to Settings</span>
        </button>
      </div>
    </div>
  );
}