import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import "@/lib/i18n";        // initialises i18next once (side-effect import)
import i18n from "@/lib/i18n";
import { LANGUAGE_CODE_MAP } from "@/lib/i18n/translations";
import { doc, onSnapshot } from "firebase/firestore";
import { updateDoc } from "firebase/firestore";

const STORAGE_KEY = "vidya_app_language";

interface LanguageContextValue {
  languageName: string;    // e.g. "Hindi"
  languageCode: string;    // e.g. "hi"
  changeLanguage: (name: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue>({
  languageName: "English",
  languageCode: "en",
  changeLanguage: async () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languageName, setLanguageName] = useState("English");
  const [languageCode, setLanguageCode] = useState("en");
  const firestoreUnsub = useRef<(() => void) | null>(null);

  const applyLanguage = (name: string, code: string) => {
    setLanguageName(name);
    setLanguageCode(code);
    // i18next.changeLanguage is synchronous when resources are bundled
    i18n.changeLanguage(code);
  };

  // On mount: load from AsyncStorage instantly so the UI doesn't flicker
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        const { name, code } = JSON.parse(stored);
        if (name && code) applyLanguage(name, code);
      } catch { /* ignore corrupt cache */ }
    });
  }, []);

  // When auth state changes: subscribe to Firestore preferred language
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      // Clean up previous Firestore listener
      if (firestoreUnsub.current) { firestoreUnsub.current(); firestoreUnsub.current = null; }
      if (!user) return;

      firestoreUnsub.current = onSnapshot(
        doc(db, "students", user.uid),
        (snap) => {
          if (!snap.exists()) return;
          const preferred: string = snap.data()?.preferredLanguage ?? "";
          if (!preferred) return;
          const code = LANGUAGE_CODE_MAP[preferred] ?? "en";
          applyLanguage(preferred, code);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ name: preferred, code }));
        },
        () => { /* ignore read errors */ }
      );
    });

    return () => {
      unsubAuth();
      if (firestoreUnsub.current) firestoreUnsub.current();
    };
  }, []);

  const changeLanguage = async (name: string) => {
    const code = LANGUAGE_CODE_MAP[name] ?? "en";
    applyLanguage(name, code);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ name, code }));
    const uid = auth.currentUser?.uid;
    if (uid) updateDoc(doc(db, "students", uid), { preferredLanguage: name }).catch(() => {});
  };

  return (
    <LanguageContext.Provider value={{ languageName, languageCode, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Language state (name, code, changeLanguage) — use this for any component that
// needs to know the current language or switch it.
export const useLanguage = () => useContext(LanguageContext);

// Translation hook — wraps react-i18next useTranslation so each component
// subscribes directly to i18next and re-renders automatically on language change.
// Import and call this like: const { t } = useAppTranslation();
export { useTranslation as useAppTranslation } from "react-i18next";
