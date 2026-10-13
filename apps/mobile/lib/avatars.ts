// PATH: lib/avatars.ts
//
// Single source of truth for the "Title" field (Mr / Ms / Mrs) collected at
// registration. Mirrors apps/web/src/lib/avatars.ts's TITLES/genderFromTitle
// — kept in sync manually since web and mobile don't share a package here.
//
// Deliberately does NOT export an SVG-data-URI avatar generator the way the
// web version does: React Native's <Image> component cannot render
// `data:image/svg+xml` URIs (only raster formats — PNG/JPEG/GIF/WebP/BMP).
// Rendering the title-derived fallback avatar on mobile is handled instead
// by components/TitleAvatar.tsx, a native View-based component. Neither
// side ever persists a computed fallback into the shared `profilePic`
// field — see register.tsx's FIX comment — so there's no risk of a web
// account's SVG avatar showing up broken in this app, or vice versa.

export const TITLES = ["Mr", "Ms", "Mrs"] as const;
export type Title = (typeof TITLES)[number];

export function isTitle(value: string): value is Title {
  return (TITLES as readonly string[]).includes(value);
}

// "Ms"/"Mrs" both map to the same avatar styling — the distinction between
// them is marital-status phrasing, not a different avatar.
export function genderFromTitle(title: string | null | undefined): "male" | "female" {
  return title === "Mr" ? "male" : "female";
}
