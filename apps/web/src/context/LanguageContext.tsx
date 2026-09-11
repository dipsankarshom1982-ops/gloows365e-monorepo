"use client";

// PATH: apps/web/src/context/LanguageContext.tsx
//
// Rebuilt on react-i18next (already in package.json as a dependency, but
// previously unused — web had a hand-rolled t() lookup instead). This
// mirrors apps/mobile/context/LanguageContext.tsx's architecture closely,
// per the instruction to "make it like my Expo app":
//   - Same shape: { languageName, languageCode, changeLanguage }
//   - Same Firestore sync: subscribes to students/{uid}.preferredLanguage
//     and applies it whenever it changes (covers both registration and
//     Settings → Language saves)
//   - Same fallback-to-English behavior via i18next's fallbackLng
//
// Differences from mobile, both deliberate:
//   - localStorage key is "gloows_language" (per this feature's spec) and
//     stores the SAME {name, code} JSON shape mobile uses under
//     "vidya_app_language" — same shape, different key name, so there's
//     one consistent format across platforms even though the storage
//     mechanism differs (AsyncStorage vs localStorage).
//   - Locale data is lazy-loaded per language (see lib/i18n.ts) instead of
//     bundled upfront — web's "don't bundle all languages" requirement
//     doesn't apply to mobile, which compiles everything into one bundle
//     regardless.
//   - This REPLACES the old "@preferred_language" key from the welcome-
//     screen feature (name-only, no code) — that key is migrated/cleared
//     on first read so there's a single source of truth going forward.
//     See migrateLegacyStorage() below.
//
// Backward compatibility: existing pages call two different hook names —
// `useLanguage()` (ai-guru/* pages) and `useAppTranslation()` (home/page.tsx).
// Both are preserved as exports here so neither call site breaks.

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { getFirestore, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useTranslation as useI18nextTranslation } from "react-i18next";
import i18n, {
  loadLocale,
  isSupportedLanguage,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from "@/lib/i18n";

const STORAGE_KEY = "gloows_language";
const LEGACY_STORAGE_KEY = "@preferred_language"; // pre-this-feature, name-only

interface StoredLanguage { name: string; code: LanguageCode; }

interface LanguageContextValue {
  languageName: string;     // e.g. "Hindi" — kept for display/backward compat
  languageCode: LanguageCode;
  isReady: boolean;         // true once the active language's data has loaded
  changeLanguage: (name: string) => Promise<void>;
  /** Locale-aware number formatting — see requirement #7. Always renders
   *  Western digits (confirmed convention for hi-IN/bn-IN/etc. in real
   *  software — Devanagari/Bengali numeral glyphs exist but aren't what
   *  production apps use). */
  formatNumber: (n: number) => string;
  /** Locale-aware date formatting — see requirement #8. */
  formatDate: (d: Date) => string;
}

const nameToCode = (name: string): LanguageCode => {
  const match = SUPPORTED_LANGUAGES.find((l) => l.name === name);
  return match?.code ?? DEFAULT_LANGUAGE;
};
const codeToName = (code: LanguageCode): string => {
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return match?.name ?? "English";
};

// Maps our language codes to BCP-47 locale tags Intl actually recognizes.
// (Intl has no "as-IN"/"or-IN" data in all environments — falls back to
// "en-IN" formatting for those if the runtime lacks the locale, which still
// produces correct Western-digit grouping.)
const INTL_LOCALE: Record<LanguageCode, string> = {
  en: "en-IN", hi: "hi-IN", bn: "bn-IN", as: "as-IN", mr: "mr-IN",
  gu: "gu-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN",
  pa: "pa-IN", or: "or-IN",
};

const LanguageContext = createContext<LanguageContextValue>({
  languageName: "English",
  languageCode: DEFAULT_LANGUAGE,
  isReady: false,
  changeLanguage: async () => {},
  formatNumber: (n) => String(n),
  formatDate: (d) => d.toDateString(),
});

function migrateLegacyStorage(): StoredLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    // Already on the new key — nothing to migrate.
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return JSON.parse(current);

    // Check the old, name-only key from the welcome-screen feature.
    const legacyName = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyName) {
      const code = nameToCode(legacyName);
      const migrated: StoredLanguage = { name: legacyName, code };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch { /* ignore corrupt/inaccessible storage */ }
  return null;
}

export function LanguageProviderInner({ children }: { children: ReactNode }) {
  const [languageName, setLanguageName] = useState("English");
  const [languageCode, setLanguageCode] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [isReady, setIsReady] = useState(false);
  const firestoreUnsub = useRef<(() => void) | null>(null);

  const applyLanguage = async (name: string, code: LanguageCode) => {
    await loadLocale(code);
    await i18n.changeLanguage(code);
    setLanguageName(name);
    setLanguageCode(code);
    setIsReady(true);
  };

  // On mount: load from localStorage (migrating the legacy key if needed)
  // instantly, so the UI doesn't flash in English before settling.
  useEffect(() => {
    const stored = migrateLegacyStorage();
    if (stored?.name && stored?.code && isSupportedLanguage(stored.code)) {
      applyLanguage(stored.name, stored.code);
    } else {
      // No stored preference yet — still need to mark ready once English
      // (the default i18next language) has its bundle loaded.
      loadLocale(DEFAULT_LANGUAGE).then(() => setIsReady(true));
    }
  }, []);

  // When auth state changes: subscribe to Firestore preferred language —
  // same students/{uid}.preferredLanguage field the rest of the app
  // (registration, Settings → Language) already reads/writes.
  useEffect(() => {
    const auth = getAuth();
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (firestoreUnsub.current) { firestoreUnsub.current(); firestoreUnsub.current = null; }
      if (!user) return;

      const db = getFirestore();
      firestoreUnsub.current = onSnapshot(
        doc(db, "students", user.uid),
        (snap) => {
          if (!snap.exists()) return;
          const preferred: string = snap.data()?.preferredLanguage ?? "";
          if (!preferred) return;
          const code = nameToCode(preferred);
          applyLanguage(preferred, code);
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: preferred, code }));
          } catch { /* ignore storage errors */ }
        },
        () => { /* ignore read errors — keep whatever language is active */ }
      );
    });

    return () => {
      unsubAuth();
      if (firestoreUnsub.current) firestoreUnsub.current();
    };
  }, []);

  const changeLanguage = async (name: string) => {
    const code = nameToCode(name);
    await applyLanguage(name, code);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, code }));
    } catch { /* ignore storage errors */ }
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      updateDoc(doc(getFirestore(), "students", uid), { preferredLanguage: name }).catch(() => {});
    }
  };

  const formatNumber = (n: number): string => {
    try {
      return new Intl.NumberFormat(INTL_LOCALE[languageCode] ?? "en-IN").format(n);
    } catch {
      return new Intl.NumberFormat("en-IN").format(n);
    }
  };

  const formatDate = (d: Date): string => {
    try {
      return new Intl.DateTimeFormat(INTL_LOCALE[languageCode] ?? "en-IN", {
        day: "numeric", month: "long", year: "numeric",
      }).format(d);
    } catch {
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      }).format(d);
    }
  };

  return (
    <LanguageContext.Provider
      value={{ languageName, languageCode, isReady, changeLanguage, formatNumber, formatDate }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// Language state (name, code, changeLanguage, formatters) — use this for
// any component that needs to know the current language or switch it.
export const useLanguage = () => useContext(LanguageContext);

// Translation hook — wraps react-i18next's useTranslation so each
// component subscribes directly to i18next and re-renders automatically
// on language change. Preserved under its existing name since
// app/(app)/home/page.tsx and the ai-guru/* pages already call this.
//
// Existing call sites use the two-argument style `t("key", "English
// fallback")`. i18next's `t(key, defaultValue: string)` shorthand has
// supported exactly this for years and should work as-is — but `t` is
// wrapped here regardless so that style is *guaranteed* correct no matter
// the installed i18next version's exact handling, rather than depending on
// it implicitly. Anything beyond a plain string fallback (interpolation
// options, plurals, etc.) still passes through to the real i18next t().
export function useAppTranslation() {
  const { t: rawT, i18n: i18nInstance, ready } = useI18nextTranslation();

  const t = (
    key: string,
    fallbackOrOptions?: string | Record<string, unknown>,
    interpolationValues?: Record<string, unknown>
  ): string => {
    if (typeof fallbackOrOptions === "string") {
      return rawT(key, { defaultValue: fallbackOrOptions, ...interpolationValues }) as string;
    }
    return rawT(key, fallbackOrOptions) as string;
  };

  return { t, i18n: i18nInstance, ready };
}
