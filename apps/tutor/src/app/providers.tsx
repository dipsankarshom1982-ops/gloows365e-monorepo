"use client";
// apps/tutor/src/app/providers.tsx
// Root client-side providers: shared Tutor i18n (packages/tutor-i18n) +
// shared tutor auth/profile state (packages/shared-logic's
// TutorProfileProvider). Split into its own file since app/layout.tsx
// itself is a server component in the App Router and can't hold client
// context providers directly.

import { I18nextProvider } from "react-i18next";
import { createTutorI18n } from "@gloows/tutor-i18n";
import { TutorProfileProvider } from "@gloows/shared-logic";
import "@/lib/firebase"; // ensure Firebase is initialized before any child reads it

const i18n = createTutorI18n();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <TutorProfileProvider>{children}</TutorProfileProvider>
    </I18nextProvider>
  );
}
