// PATH: apps/web/src/lib/languages.ts
//
// Single source of truth for the app's supported languages: English +
// all 22 languages from the 8th Schedule of the Constitution of India.
//
// Previously this list was duplicated three times (welcome/page.tsx had 5,
// register/page.tsx had 13, settings/language/page.tsx had the full 23) and
// had drifted out of sync. Welcome/register now import from here instead of
// keeping their own copy, so adding a language only means editing this file.
//
// localStorage key + helpers below let a language choice made BEFORE login
// (on the welcome screen, when there's no Firestore user yet) survive
// through login/registration and become the saved preference once the
// student profile is created. Mirrors the same localStorage pattern
// ThemeContext.tsx already uses for theme persistence.

export interface LanguageOption {
  name: string;
  native: string;
  region: string;
}

export const INDIAN_LANGUAGES: LanguageOption[] = [
  { name: "English",   native: "English",       region: "Official language of India" },
  { name: "Assamese",  native: "অসমীয়া",        region: "Assam" },
  { name: "Bengali",   native: "বাংলা",          region: "West Bengal, Assam" },
  { name: "Bodo",      native: "बड़ो",            region: "Assam" },
  { name: "Dogri",     native: "डोगरी",           region: "Jammu & Kashmir" },
  { name: "Gujarati",  native: "ગુજરાતી",         region: "Gujarat" },
  { name: "Hindi",     native: "हिन्दी",           region: "Widely spoken across India" },
  { name: "Kannada",   native: "ಕನ್ನಡ",           region: "Karnataka" },
  { name: "Kashmiri",  native: "کٲشُر",           region: "Jammu & Kashmir" },
  { name: "Konkani",   native: "कोंकणी",          region: "Goa, Coastal Karnataka" },
  { name: "Maithili",  native: "मैथिली",          region: "Bihar, Jharkhand" },
  { name: "Malayalam", native: "മലയാളം",          region: "Kerala, Lakshadweep" },
  { name: "Manipuri",  native: "মৈতৈলোন্",        region: "Manipur" },
  { name: "Marathi",   native: "मराठी",           region: "Maharashtra, Goa" },
  { name: "Nepali",    native: "नेपाली",          region: "Sikkim, West Bengal" },
  { name: "Odia",      native: "ଓଡ଼ିଆ",           region: "Odisha" },
  { name: "Punjabi",   native: "ਪੰਜਾਬੀ",          region: "Punjab, Haryana" },
  { name: "Sanskrit",  native: "संस्कृतम्",        region: "Classical / Liturgical" },
  { name: "Santali",   native: "ᱥᱟᱱᱛᱟᱲᱤ",       region: "Jharkhand, Odisha, West Bengal" },
  { name: "Sindhi",    native: "سنڌي",            region: "Gujarat, Rajasthan" },
  { name: "Tamil",     native: "தமிழ்",           region: "Tamil Nadu, Puducherry" },
  { name: "Telugu",    native: "తెలుగు",          region: "Andhra Pradesh, Telangana" },
  { name: "Urdu",      native: "اردو",            region: "Widespread across India" },
];

export const DEFAULT_LANGUAGE = "English";

// ─── Pre-login language preference ─────────────────────────────
// Set the moment a language is tapped on the welcome screen, before any
// Firestore user exists. Read by:
//   - LanguageContext (so the UI reflects the choice immediately, app-wide,
//     even before login/registration)
//   - register/page.tsx (to pre-select the language chip instead of
//     defaulting to blank)
// Cleared once registration successfully writes preferredLanguage to
// students/{uid} — after that, Firestore is the source of truth and this
// localStorage value would otherwise go stale.
//
// FEATURE (full i18n rebuild — "make it like my Expo app"): storage key is
// now "gloows_language", storing the SAME {name, code} JSON shape
// context/LanguageContext.tsx uses (mirroring apps/mobile's
// "vidya_app_language" key) — one consistent format, one key, read/written
// from both places instead of two parallel mechanisms. This replaces the
// old "@preferred_language" key, which stored only the name as a bare
// string; LanguageContext migrates any leftover old-key value
// automatically on first load, so nothing already saved is lost.
//
// Only the 12 UI-translation-supported languages (see lib/i18n.ts
// SUPPORTED_LANGUAGES) have a real `code` — for the other 11 constitutional
// languages in INDIAN_LANGUAGES above (Bodo, Dogri, Kashmiri, Konkani,
// Maithili, Nepali, Sanskrit, Santali, Sindhi, Manipuri, Urdu), code falls
// back to "en" since there's no UI translation data for them yet; the
// student's chosen name is still saved correctly to their profile either
// way, only the *app UI* falls back to English for those.
const STORAGE_KEY = "gloows_language";

interface StoredLanguage { name: string; code: string }

// Lazily import to avoid a hard circular dependency at module-eval time —
// lib/i18n.ts doesn't import this file, so this is safe, but kept as a
// function-local require-style import for clarity about the direction of
// the dependency.
function nameToCode(name: string): string {
  const SUPPORTED: Record<string, string> = {
    English: "en", Hindi: "hi", Bengali: "bn", Assamese: "as", Marathi: "mr",
    Gujarati: "gu", Tamil: "ta", Telugu: "te", Kannada: "kn", Malayalam: "ml",
    Punjabi: "pa", Odia: "or",
  };
  return SUPPORTED[name] ?? "en";
}

export function getStoredLanguage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredLanguage = JSON.parse(raw);
    return parsed.name ?? null;
  } catch {
    return null;
  }
}

export function setStoredLanguage(name: string): void {
  if (typeof window === "undefined") return;
  try {
    const code = nameToCode(name);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, code }));
  } catch {
    /* ignore (e.g. storage disabled) */
  }
}

export function clearStoredLanguage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
