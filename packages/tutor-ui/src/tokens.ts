// packages/tutor-ui/src/tokens.ts
// Shared design tokens for Gloows Tutor — the single source of truth for
// colors/spacing/typography/radii, consumed by:
//   - apps/tutor (web): mapped into tailwind.config.ts's theme.extend
//   - apps/tutor-mobile: consumed directly as a plain object in
//     StyleSheet.create() calls / a theme context
//
// No components live in this package — web and mobile can't share literal
// JSX (DOM vs React Native), so each platform builds its own Button/
// Input/Card/etc. against these same values instead. That's the
// deliberate design-system approach here: shared TOKENS, platform-native
// COMPONENTS.
//
// Palette is not invented from scratch — it's pulled from the color
// language already used across the live Gloows365E app (VidyaStar
// Starboard, contest screens, etc.: indigo/violet primary, dark slate
// backgrounds, amber for highlights/prizes) so Gloows Tutor reads as part
// of the same ecosystem rather than a visually unrelated product.

export const colors = {
  // Brand — indigo/violet, matches the primary accent used across
  // apps/mobile & apps/web's contest/starboard screens (#4f46e5/#6366f1/#818cf8).
  brand: {
    50:  "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
  },
  // Neutral / surface — dark slate, matches the existing app's dark UI shell.
  slate: {
    50:  "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
  // Semantic
  success: "#22c55e",
  warning: "#f59e0b",
  danger:  "#ef4444",
  gold:    "#fbbf24", // matches Starboard's prize/medal accent
  info:    "#3b82f6",
} as const;

// Semantic aliases — prefer these over raw palette values in app code so
// a future re-theme only touches this file.
export const semantic = {
  background:      colors.slate[900],
  surface:         colors.slate[800],
  surfaceElevated: colors.slate[700],
  border:          "rgba(255,255,255,0.08)",
  textPrimary:     colors.slate[100],
  textSecondary:   colors.slate[400],
  textMuted:       colors.slate[500],
  primary:         colors.brand[600],
  primaryHover:    colors.brand[700],
  primaryText:     "#ffffff",
  accent:          colors.brand[400],
  success:         colors.success,
  warning:         colors.warning,
  danger:          colors.danger,

  // Verification status → color, shared across web/mobile status badges
  // and admin's review queue so "Verified" always reads the same color
  // everywhere it appears.
  statusDraft:       colors.slate[500],
  statusSubmitted:   colors.info,
  statusUnderReview: colors.warning,
  statusVerified:    colors.success,
  statusRejected:    colors.danger,
  statusSuspended:   colors.slate[600],
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

// Font sizes only — actual font family is left to each platform's default
// system font (matches the rest of this app's existing screens, none of
// which load a custom web font today).
export const typography = {
  size: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    "2xl": 22,
    "3xl": 28,
    "4xl": 34,
  },
  weight: {
    regular:  "400",
    medium:   "600",
    bold:     "700",
    black:    "900",
  },
} as const;

export type Colors    = typeof colors;
export type Semantic  = typeof semantic;
export type Spacing   = typeof spacing;
export type Radii     = typeof radii;
export type Typography = typeof typography;
