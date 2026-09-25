// PATH: functions/src/aiLanguage.ts
//
// Centralized language handling for every Ask AI Guru feature (askAiGuru.ts,
// examSimulator.ts, photoSolve.ts, voiceTutor.ts, vidyaguru.ts, ...).
//
// FIX (production, 2026-09-06 — "Ask AI Guru → Prepare for Exam" not
// consistently answering in Hindi): each of these functions had grown its
// own inline, slightly-different language logic. Two concrete bugs came out
// of auditing them:
//   - examSimulator.ts and photoSolve.ts each hardcoded a 2-3-way ternary
//     (`language === "Hindi" ? ... : language === "Bengali" ? ... :
//     "English"`) that silently forced English for every OTHER supported
//     language (Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam,
//     Punjabi, Urdu, Odia, Assamese, ...) regardless of what the student
//     actually had selected.
//   - askAiGuru.ts's fallback ("if the question is in English, use the
//     student's preferredLanguage instead") was correct in principle
//     (preferredLanguage IS looked up server-side, never trusted from a
//     stale client) but was phrased as one bullet buried inside a longer
//     "detect the question's language" rule — a conditional instruction
//     an LLM follows far less reliably than a direct, unconditional one,
//     which is exactly why Hindi-preferring students typing English-script
//     exam-prep questions ("Prepare for the Chapter 3 exam") got
//     inconsistent results instead of a hard failure every time.
//
// getLanguageInstruction() replaces every one of those inline ternaries
// with one unconditional, script-explicit directive. resolveStudentLanguage()
// replaces every ad-hoc "req.body.language ?? 'English'" with the same
// looked-up-server-side, three-tier priority order everywhere:
//   1. An explicit, recognized language named in *this* request.
//   2. The student's saved preference — students/{uid}.preferredLanguage,
//      read server-side so it can never go stale the way a client's local
//      cache can (same reasoning askAiGuru.ts already used).
//   3. "English" — the application default. Language is never undefined.

// Canonical language names — MUST stay in sync with
// apps/mobile/lib/i18n/translations.ts's LANGUAGE_CODE_MAP, which is the
// single source of truth for what "preferredLanguage" can actually contain
// (that file is the one users' language pickers write from). This is a
// plain name Set, not the {name: code} map itself, since nothing here needs
// the ISO code — only the human-readable name that goes straight into an
// AI prompt.
export const SUPPORTED_LANGUAGE_NAMES: ReadonlySet<string> = new Set([
  "English",
  "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati", "Hindi", "Kannada",
  "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri", "Marathi",
  "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi", "Tamil",
  "Telugu", "Urdu",
]);

// Script call-outs for languages whose script is easily confused with a
// romanized/"Hinglish"-style transliteration (the task's explicit Hindi
// concern generalized to every language that needs it). Anything not
// listed still gets a generic "its own native script" instruction below —
// this map only sharpens the wording for the common cases, it's not a
// gate on which languages are supported.
const SCRIPT_HINTS: Record<string, string> = {
  Hindi:     "Devanagari script",
  Marathi:   "Devanagari script",
  Sanskrit:  "Devanagari script",
  Nepali:    "Devanagari script",
  Bengali:   "Bengali script",
  Assamese:  "Bengali/Assamese script",
  Urdu:      "Urdu (Nastaliq) script",
  Punjabi:   "Gurmukhi script",
  Gujarati:  "Gujarati script",
  Tamil:     "Tamil script",
  Telugu:    "Telugu script",
  Kannada:   "Kannada script",
  Malayalam: "Malayalam script",
  Odia:      "Odia script",
};

function scriptNote(language: string): string {
  const script = SCRIPT_HINTS[language];
  return script ? ` using ${script}` : " using that language's own native script (not a romanized/English-letter transliteration)";
}

/** Priority 3 of the language resolver — never change this default without
 *  also updating every caller's own "if no language, assume ___" comment. */
export const APP_DEFAULT_LANGUAGE = "English";

/**
 * Resolves the language an AI Guru feature should answer in, in priority
 * order: an explicit language named in this request → the student's saved
 * preference (read server-side, never trusted from client state) →
 * the application default. Always returns a valid, non-empty language name.
 */
export async function resolveStudentLanguage(
  uid: string,
  db: FirebaseFirestore.Firestore,
  requestLanguage?: string
): Promise<string> {
  if (requestLanguage && SUPPORTED_LANGUAGE_NAMES.has(requestLanguage)) {
    return requestLanguage;
  }

  try {
    const snap = await db.collection("students").doc(uid).get();
    const saved = snap.data()?.preferredLanguage as string | undefined;
    if (saved && SUPPORTED_LANGUAGE_NAMES.has(saved)) return saved;
  } catch (err: any) {
    console.warn("[aiLanguage] Could not read preferredLanguage, defaulting to English:", err?.message);
  }

  return APP_DEFAULT_LANGUAGE;
}

/**
 * A single, unconditional, script-explicit language directive — use this
 * for any feature that should ALWAYS answer in the resolved language
 * regardless of what language the input itself happens to be written in
 * (exam generation, lesson/study-material generation, photo-solve, MCQ
 * generation, ...). For a feature where matching the student's own input
 * language is a deliberate part of the UX (a doubt/chat box, voice input),
 * use getDetectOrFallbackInstruction() instead.
 */
export function getLanguageInstruction(language: string): string {
  if (!language || language === APP_DEFAULT_LANGUAGE) {
    return "IMPORTANT LANGUAGE INSTRUCTION: Respond in clear, simple English.";
  }
  return `IMPORTANT LANGUAGE INSTRUCTION:
The student's selected response language is: ${language}.
You MUST write the ENTIRE response in ${language}${scriptNote(language)} — every heading, explanation, example, list, and question, with no exceptions.
Do not respond in English unless English is the selected language.
Do not mix languages (no "Hinglish" or similar romanized transliteration) unless the student explicitly asks for that.`;
}

/**
 * For chat/voice-style features where matching whatever language the
 * student actually wrote or spoke in is the right default behavior (a
 * Bengali-preference student typing a Hindi question should get a Hindi
 * answer back, not a forced switch to Bengali) — but the FALLBACK case
 * (English input, or a language that can't be confidently identified)
 * must land on the student's real preference, unconditionally, not silently
 * default to English. That fallback sentence is deliberately the strongest,
 * most direct part of this instruction — a conditional "detect, else fall
 * back" rule is exactly the shape of instruction an LLM follows least
 * reliably, which is what caused this bug in the first place.
 */
export function getDetectOrFallbackInstruction(preferredLanguage: string): string {
  return `CRITICAL LANGUAGE RULE:
1. Detect the language the student's own message is written or spoken in.
2. If it is clearly a language other than English, respond in that SAME language, using its native script. Do not translate — write naturally, as a real teacher would.
3. If the message is in English, or its language cannot be confidently identified, you MUST respond in ${preferredLanguage}${preferredLanguage === APP_DEFAULT_LANGUAGE ? "" : scriptNote(preferredLanguage)} — the student's own selected app language. This is not optional and does not depend on how confident you are; when in doubt, use ${preferredLanguage}.
Do not mix languages (no "Hinglish" or similar romanized transliteration) unless the student explicitly asks for that.`;
}
