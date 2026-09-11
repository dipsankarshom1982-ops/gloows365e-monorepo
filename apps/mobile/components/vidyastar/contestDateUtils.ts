// PATH: components/vidyastar/contestDateUtils.ts
//
// Pure date helpers shared by ContestCard and the VidyaStar listing screen.
// Extracted unchanged from the original vidyastar.tsx — no logic changes.

export const getDate = (t: any): Date | null => {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
};

// "12 Aug 2026" — plain calendar date, no time, for completed/upcoming chips.
export const formatChipDate = (d: Date): string =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
