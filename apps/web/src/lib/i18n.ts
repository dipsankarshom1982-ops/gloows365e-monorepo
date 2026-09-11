// PATH: apps/web/src/lib/i18n.ts
//
// i18next instance + lazy locale loading. Mirrors apps/mobile/lib/i18n's
// architecture (i18next + react-i18next), adapted for web's two extra
// constraints mobile doesn't have:
//   1. "Do not bundle all languages initially" — mobile bundles all 14
//      languages into the JS bundle at build time since it's a compiled
//      app; that's wasteful on web where most visitors only ever need one
//      language. Locale JSON files are loaded on demand via dynamic
//      import() and registered with i18n.addResourceBundle() as needed —
//      Next.js code-splits each into its own chunk.
//   2. Static export (`output: "export"`) — i18next is initialized with
//      EMPTY resources at module load (safe for SSR/build time, no locale
//      data needed yet), and the active language's data is loaded
//      asynchronously on the client. LanguageProvider (see
//      components/LanguageProvider.tsx) handles showing the app once the
//      initial language is ready, so there's no flash of untranslated keys.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type LanguageCode =
  | "en" | "hi" | "bn" | "as" | "mr" | "gu"
  | "ta" | "te" | "kn" | "ml" | "pa" | "or";

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export interface LanguageMeta {
  code: LanguageCode;
  /** English name, shown alongside the native script in pickers */
  name: string;
  /** Native script rendering, e.g. "हिन्दी" */
  native: string;
  /** Flag emoji — per spec, India's flag for every entry (these are
   *  regional Indian languages, not different countries) */
  flag: string;
}

// Order here is also display order in the Settings → Language picker.
export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: "en", name: "English",   native: "English",  flag: "🇮🇳" },
  { code: "hi", name: "Hindi",     native: "हिन्दी",     flag: "🇮🇳" },
  { code: "bn", name: "Bengali",   native: "বাংলা",     flag: "🇮🇳" },
  { code: "as", name: "Assamese",  native: "অসমীয়া",   flag: "🇮🇳" },
  { code: "mr", name: "Marathi",   native: "मराठी",     flag: "🇮🇳" },
  { code: "gu", name: "Gujarati",  native: "ગુજરાતી",   flag: "🇮🇳" },
  { code: "ta", name: "Tamil",     native: "தமிழ்",     flag: "🇮🇳" },
  { code: "te", name: "Telugu",    native: "తెలుగు",    flag: "🇮🇳" },
  { code: "kn", name: "Kannada",   native: "ಕನ್ನಡ",     flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", native: "മലയാളം",   flag: "🇮🇳" },
  { code: "pa", name: "Punjabi",   native: "ਪੰਜਾਬੀ",    flag: "🇮🇳" },
  { code: "or", name: "Odia",      native: "ଓଡ଼ିଆ",     flag: "🇮🇳" },
];

export const SUPPORTED_CODES: LanguageCode[] = SUPPORTED_LANGUAGES.map((l) => l.code);

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return !!code && SUPPORTED_CODES.includes(code as LanguageCode);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {},       // intentionally empty — locales load lazily, see loadLocale()
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
    react: {
      // Wait for resources to be added before components render translated
      // text — avoids a flash of raw keys before the first locale loads.
      useSuspense: false,
    },
  });

// ─── Lazy loader with in-memory + i18next-level cache ───────────
// i18next itself tracks which bundles are loaded (hasResourceBundle), so
// this also guards against re-fetching a language that's already active.
const inFlight = new Map<LanguageCode, Promise<void>>();

export async function loadLocale(code: LanguageCode): Promise<void> {
  if (i18n.hasResourceBundle(code, "translation")) return;

  const existing = inFlight.get(code);
  if (existing) return existing;

  const promise = (async () => {
    try {
      // FIX (console error — "Cannot find module 'undefined'"): this was
      // `../../../locales/${code}.json` (3 levels up from src/lib/), which
      // overshoots apps/web entirely — there's no locales/ folder above it.
      // Correct path from apps/web/src/lib/i18n.ts to apps/web/locales/ is
      // 2 levels up (lib -> src -> web), then into locales/.
      const mod = await import(`../../locales/${code}.json`);
      const data = mod.default ?? mod;
      i18n.addResourceBundle(code, "translation", data, true, true);
    } catch (err) {
      console.error(`[i18n] Failed to load locale "${code}"`, err);
      if (code !== DEFAULT_LANGUAGE) {
        await loadLocale(DEFAULT_LANGUAGE);
      }
    } finally {
      inFlight.delete(code);
    }
  })();

  inFlight.set(code, promise);
  return promise;
}

export default i18n;
