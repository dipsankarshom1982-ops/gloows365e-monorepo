import { isPrimaryClassLevel } from "./classes";

// Client features not offered to Class 3–5. Keys match the flag keys used by
// FeatureFlagsContext's homeSection() / aiGuru().
const PRIMARY_HIDDEN: Record<"homeSection" | "aiGuru", readonly string[]> = {
  // Discover is a college/career/scholarship advisor; the server also refuses Class 3–5.
  homeSection: ["discover_preview"],
  aiGuru: ["discover"],
};

export function isFeatureHiddenForClass(
  area: "homeSection" | "aiGuru",
  key: string,
  studentClass: unknown
): boolean {
  return isPrimaryClassLevel(studentClass) && PRIMARY_HIDDEN[area].includes(key);
}
