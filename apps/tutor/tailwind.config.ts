// apps/tutor/tailwind.config.ts
// Maps @gloows/tutor-ui's shared design tokens into Tailwind's theme, so
// every color/spacing/radius value used across this app traces back to
// one source of truth (packages/tutor-ui/src/tokens.ts) — the same file
// apps/tutor-mobile's RN theme object reads from.
import type { Config } from "tailwindcss";
import { colors, semantic, radii } from "../../packages/tutor-ui/src/tokens";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        slate: colors.slate,
        success: colors.success,
        warning: colors.warning,
        danger:  colors.danger,
        gold:    colors.gold,
        bg:       semantic.background,
        surface:  semantic.surface,
        surface2: semantic.surfaceElevated,
      },
      borderRadius: {
        sm: `${radii.sm}px`,
        md: `${radii.md}px`,
        lg: `${radii.lg}px`,
        xl: `${radii.xl}px`,
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
