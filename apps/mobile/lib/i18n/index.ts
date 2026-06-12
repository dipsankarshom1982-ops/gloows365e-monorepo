import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import translations from "./translations";

// Build resources object expected by i18next: { langCode: { translation: {...} } }
const resources: Record<string, { translation: Record<string, string> }> = {};
for (const [code, strings] of Object.entries(translations)) {
  resources[code] = { translation: strings as Record<string, string> };
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",           // default; overridden by LanguageContext on mount
    fallbackLng: "en",   // any missing key falls back to English
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
  });

export default i18n;
