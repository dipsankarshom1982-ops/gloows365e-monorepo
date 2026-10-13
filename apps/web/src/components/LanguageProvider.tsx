"use client";

// PATH: apps/web/src/components/LanguageProvider.tsx
//
// Thin wrapper around context/LanguageContext.tsx's provider, in the
// location requested by the i18n architecture spec (components/, not
// context/). Kept as a separate file rather than merging into
// LanguageContext.tsx so the provider's location matches what's documented
// and easy to find, while the context file owns all the actual state logic.
//
// This is what app/providers.tsx renders — see that file for where it sits
// in the provider tree (must wrap anything that calls useLanguage() or
// useAppTranslation(), which in practice means most of the authenticated
// app).

import { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import { LanguageProviderInner } from "@/context/LanguageContext";

export function LanguageProvider({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageProviderInner>{children}</LanguageProviderInner>
    </I18nextProvider>
  );
}
