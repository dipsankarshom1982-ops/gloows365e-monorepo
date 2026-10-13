"use client";

// PATH: apps/web/src/app/providers.tsx

import "@/lib/firebase";

import { useEffect } from "react";
import { installSignedOutFirestoreErrorFilter } from "@/lib/signedOutFirestoreErrors";
import { ThemeProvider }          from "@/context/ThemeContext";
import { StudentProfileProvider, FeatureFlagsProvider } from "@gloows/shared-logic";
import { AppConfigProvider }      from "@/context/AppConfigContext";
import { LanguageProvider }       from "@/components/LanguageProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  // See lib/signedOutFirestoreErrors.ts — post-logout permission-denied noise only.
  useEffect(() => { installSignedOutFirestoreErrorFilter(); }, []);

  return (
    <ThemeProvider>
      <StudentProfileProvider>
        {/* FEATURE (full i18n rebuild, react-i18next-based): LanguageProvider
            now does its own direct Firestore subscription to
            students/{uid}.preferredLanguage (mirroring apps/mobile's
            LanguageContext), rather than reading through
            StudentProfileContext. Both work fine in parallel — kept
            nested here, after StudentProfileProvider, only because other
            providers further down (AppConfigProvider, FeatureFlagsProvider)
            may assume student profile data is already available. */}
        <LanguageProvider>
          <AppConfigProvider>
            <FeatureFlagsProvider>
              {children}
            </FeatureFlagsProvider>
          </AppConfigProvider>
        </LanguageProvider>
      </StudentProfileProvider>
    </ThemeProvider>
  );
}