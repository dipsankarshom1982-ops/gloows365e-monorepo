// PATH: apps/web/src/lib/avatars.ts
//
// Single source of truth for the "Title" field (Mr / Ms / Mrs) collected at
// registration, and the default avatar derived from it.
//
// Why this exists: before a student uploads a real photo in Settings, every
// avatar slot in the app (header, drawer, leaderboard, etc.) had nothing
// student-specific to show — AppHeader.tsx and wallet/page.tsx were falling
// back to `https://i.pravatar.cc/...?u=<uid>`, a random third-party cartoon
// avatar with no relation to the student at all. Registration now asks for
// a Title, and every one of those fallback sites uses defaultAvatarForTitle()
// instead — a simple inline SVG silhouette (no network call, no external
// avatar service dependency), colored/shaped per the chosen title, so a new
// student sees something that's at least *theirs* from the moment they
// finish registering.
//
// This is a presentational default only — it never overrides a real
// uploaded photo (settings/profile/page.tsx) or a Google account photo
// (photoURL, written at Google sign-in) when one exists. Callers should
// always prefer profilePic / photoURL first and only fall back to this.

export const TITLES = ["Mr", "Ms", "Mrs"] as const;
export type Title = (typeof TITLES)[number];

export function isTitle(value: string): value is Title {
  return (TITLES as readonly string[]).includes(value);
}

// "Ms"/"Mrs" both map to the female silhouette — the distinction between
// them is marital-status phrasing, not a different avatar.
export function genderFromTitle(title: string): "male" | "female" {
  return title === "Mr" ? "male" : "female";
}

const MALE_AVATAR_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
  `<rect width="96" height="96" rx="48" fill="#6366F1"/>` +
  `<circle cx="48" cy="38" r="18" fill="#E0E7FF"/>` +
  `<path d="M14 90c0-21 15.2-34 34-34s34 13 34 34" fill="#E0E7FF"/>` +
  `</svg>`;

const FEMALE_AVATAR_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
  `<rect width="96" height="96" rx="48" fill="#EC4899"/>` +
  `<path d="M48 20c-12 0-19 9-19 21 0 3 .5 6 1.4 9-2.3 1.7-4.4 4-4.4 4l3 8s2-3 4-5c3 4 8 6 15 6s12-2 15-6c2 2 4 5 4 5l3-8s-2.1-2.3-4.4-4c.9-3 1.4-6 1.4-9 0-12-7-21-19-21z" fill="#FCE7F3"/>` +
  `<path d="M14 90c0-19.3 15.2-32 34-32s34 12.7 34 32" fill="#FCE7F3"/>` +
  `</svg>`;

function toDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Returns a data-URI SVG avatar appropriate for the given title. Falls
 *  back to the male silhouette for an unrecognized/empty title so callers
 *  never have to null-check before rendering an <img src>. */
export function defaultAvatarForTitle(title: string | null | undefined): string {
  const svg = title && genderFromTitle(title) === "female" ? FEMALE_AVATAR_SVG : MALE_AVATAR_SVG;
  return toDataUri(svg);
}
