// PATH: apps/web/src/lib/detectPostLanguage.ts
// Mirror of apps/mobile/lib/detectPostLanguage.ts — pure logic, no RN deps,
// copied as-is.
//
// Detects a post's language from its caption/title text, for use only at
// upload time (Createreelscreen.tsx) when writing a new post's
// targetLanguage field. NOT used anywhere in the feed-scoring path —
// reelScoring.ts only ever reads whatever targetLanguage ends up stored.
//
// Design, per product decision:
//   - Native script (Devanagari, Bengali script, Tamil script, etc.) is
//     detected directly from Unicode ranges. This part is reliable.
//   - Most Indian-language captions are actually typed in Latin/English
//     script (e.g. "khub bhalo hoyeche" for Bengali) — there is no
//     reliable rule-based way to tell romanized Hindi from romanized
//     Bengali from romanized Marathi from plain English; attempting this
//     would silently mislabel posts more often than it would help. So
//     Latin-only or otherwise undetectable text falls back to the
//     poster's own preferredLanguage instead of guessing.
//   - Several scripts are shared by multiple constitutional languages
//     (Devanagari: Hindi/Marathi/Sanskrit/Bodo/Maithili/Konkani/Nepali/
//     Dogri; Perso-Arabic: Urdu/Sindhi/Kashmiri; Bengali script:
//     Bengali/Assamese/Manipuri) — script alone can't disambiguate within
//     a family. Resolved by preferring the poster's own preferredLanguage
//     if it's a member of the detected family, else defaulting to the
//     family's most common member (Hindi for Devanagari, Bengali for
//     Bengali-script, Urdu for Perso-Arabic — the most widely spoken
//     language in each family, used only when the poster's own language
//     doesn't help disambiguate).

interface ScriptFamily {
  // [start, end] inclusive Unicode code point ranges for this script.
  ranges: Array<[number, number]>;
  // Constitutional languages that can be written in this script.
  members: string[];
  // Used when the poster's preferredLanguage isn't a member of `members`.
  defaultMember: string;
}

// Scripts unique to a single constitutional language — no disambiguation
// needed, detection is the answer.
const UNAMBIGUOUS_SCRIPTS: Array<{ ranges: Array<[number, number]>; language: string }> = [
  { ranges: [[0x0A00, 0x0A7F]], language: "Punjabi" },   // Gurmukhi
  { ranges: [[0x0A80, 0x0AFF]], language: "Gujarati" },  // Gujarati
  { ranges: [[0x0B00, 0x0B7F]], language: "Odia" },      // Odia
  { ranges: [[0x0B80, 0x0BFF]], language: "Tamil" },     // Tamil
  { ranges: [[0x0C00, 0x0C7F]], language: "Telugu" },    // Telugu
  { ranges: [[0x0C80, 0x0CFF]], language: "Kannada" },   // Kannada
  { ranges: [[0x0D00, 0x0D7F]], language: "Malayalam" }, // Malayalam
  { ranges: [[0x1C50, 0x1C7F]], language: "Santali" },   // Ol Chiki
  { ranges: [[0xABC0, 0xABFF]], language: "Manipuri" },  // Meitei Mayek (Manipuri's other script)
];

// Scripts shared by multiple languages — need the poster's preferredLanguage
// (or a sensible default) to disambiguate within the family.
const AMBIGUOUS_SCRIPTS: ScriptFamily[] = [
  {
    ranges: [[0x0900, 0x097F]], // Devanagari
    members: ["Hindi", "Marathi", "Sanskrit", "Bodo", "Maithili", "Konkani", "Nepali", "Dogri"],
    defaultMember: "Hindi",
  },
  {
    ranges: [[0x0980, 0x09FF]], // Bengali script
    members: ["Bengali", "Assamese", "Manipuri"],
    defaultMember: "Bengali",
  },
  {
    ranges: [[0x0600, 0x06FF], [0x0750, 0x077F]], // Perso-Arabic
    members: ["Urdu", "Sindhi", "Kashmiri"],
    defaultMember: "Urdu",
  },
];

function rangesContain(ranges: Array<[number, number]>, codePoint: number): boolean {
  return ranges.some(([start, end]) => codePoint >= start && codePoint <= end);
}

// Counts how many characters of `text` fall in `ranges`, used to require a
// minimum signal before trusting a script match — a single stray emoji or
// punctuation mark shouldn't be enough, but this only matters for ranges
// that could plausibly false-positive on common symbols; the script ranges
// above don't overlap with ASCII/emoji/punctuation, so in practice this
// just guards against a single misplaced character from e.g. a pasted
// foreign word triggering a whole-post mislabel.
function countInRanges(text: string, ranges: Array<[number, number]>): number {
  let count = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp != null && rangesContain(ranges, cp)) count++;
  }
  return count;
}

const MIN_SCRIPT_CHARS = 3;

/**
 * Detects the language of a post's caption/title text.
 *
 * @param text caption + title, concatenated (caller's choice of separator
 *   doesn't matter — this only counts characters, not word boundaries)
 * @param posterPreferredLanguage the uploading student's own
 *   preferredLanguage from students/{uid} — used both as the disambiguator
 *   for same-script language families, and as the fallback when no
 *   native-script signal is found at all (Latin-only or empty text)
 * @returns a language name from the 23-language INDIAN_LANGUAGES list
 *   (language-settings.tsx) — never null, always resolves to something
 *   usable as a targetLanguage value
 */
export function detectPostLanguage(
  text: string,
  posterPreferredLanguage: string | undefined
): string {
  const fallback = posterPreferredLanguage || "English";

  if (!text || text.trim().length === 0) return fallback;

  // Check unambiguous scripts first — if any of these match with enough
  // signal, we're done, no need to consult preferredLanguage at all.
  for (const { ranges, language } of UNAMBIGUOUS_SCRIPTS) {
    if (countInRanges(text, ranges) >= MIN_SCRIPT_CHARS) return language;
  }

  // Then check ambiguous (shared-script) families.
  for (const family of AMBIGUOUS_SCRIPTS) {
    if (countInRanges(text, family.ranges) >= MIN_SCRIPT_CHARS) {
      if (posterPreferredLanguage && family.members.includes(posterPreferredLanguage)) {
        return posterPreferredLanguage;
      }
      return family.defaultMember;
    }
  }

  // No native-script signal found (Latin script only, or too little text)
  // — fall back to the poster's own preferredLanguage rather than
  // attempting unreliable romanized-text guessing. See file header.
  return fallback;
}
