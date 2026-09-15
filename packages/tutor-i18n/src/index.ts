// packages/tutor-i18n/src/index.ts
// Shared translation system for apps/tutor (web) and apps/tutor-mobile —
// one i18next configuration + one set of locale JSON files, consumed by
// both platforms instead of each building its own (which is what
// happened historically for the student app: apps/web/src/lib/i18n.ts and
// apps/mobile/lib/i18n/ are two separate, structurally different
// implementations that never got unified).
//
// SCOPE: English + Hindi only for now (Phase 1a). Resources are bundled
// statically here rather than lazy-loaded per locale — with only 2
// languages that's a negligible amount of JSON, and it avoids the
// cross-package dynamic-import() path fragility apps/web/src/lib/i18n.ts
// hit once (see that file's history: a relative import path that
// "overshot" the package boundary). When more languages are added,
// switch resources to a loadTutorLocale()-style lazy loader mirroring
// that file's pattern — the addRestourceBundle-based i18next API this
// module already uses is the same one that pattern builds on, so the
// migration is additive, not a rewrite — both approaches sit on i18next's
// same addResourceBundle() API under the hood.
//
// Each app calls createTutorI18n() ONCE at startup (mirrors how each
// platform calls shared-logic's initSharedFirebase() once) and gets back
// a ready i18next instance to pass to <I18nextProvider>. useTutorT() then
// works identically on web (react-dom) and mobile (react-native) since
// react-i18next itself is platform-agnostic — apps/web and apps/mobile
// both already depend on it independently today.

import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";

export type TutorLanguageCode = "en" | "hi";

export const DEFAULT_TUTOR_LANGUAGE: TutorLanguageCode = "en";

export interface TutorLanguageMeta {
  code: TutorLanguageCode;
  name: string;
  native: string;
  flag: string;
}

// Adding a language later: add its JSON file next to en.json/hi.json,
// import it above, add one entry each here and in the `resources` object
// in createTutorI18n() below.
export const SUPPORTED_TUTOR_LANGUAGES: TutorLanguageMeta[] = [
  { code: "en", name: "English", native: "English", flag: "🇮🇳" },
  { code: "hi", name: "Hindi",   native: "हिन्दी",    flag: "🇮🇳" },
];

const RESOURCES = {
  en: { translation: en },
  hi: { translation: hi },
};

let _instance: I18nInstance | null = null;

/** Call once per app at startup. Returns the same instance on re-entry
 *  (e.g. React Fast Refresh) rather than re-initializing. */
export function createTutorI18n(initialLanguage: TutorLanguageCode = DEFAULT_TUTOR_LANGUAGE): I18nInstance {
  if (_instance) return _instance;

  const instance = i18next.createInstance();
  instance.use(initReactI18next).init({
    resources: RESOURCES,
    lng: initialLanguage,
    fallbackLng: DEFAULT_TUTOR_LANGUAGE,
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
    react: { useSuspense: false },
  });

  _instance = instance;
  return instance;
}

/** Drop-in replacement for react-i18next's useTranslation() — same
 *  `t(key, options)` call shape, scoped to the Tutor translation set. */
export function useTutorT() {
  return useTranslation();
}

export type TutorTranslationKey = keyof typeof en;
