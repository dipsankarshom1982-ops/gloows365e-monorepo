"use client";

// apps/web/src/app/providers.tsx
// Client-side wrapper: initializes Firebase in the browser
// and mounts all shared context providers.

import "@/lib/firebase";
import { StudentProfileProvider, FeatureFlagsProvider } from "@gloows/shared-logic";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StudentProfileProvider>
      <FeatureFlagsProvider>
        {children}
      </FeatureFlagsProvider>
    </StudentProfileProvider>
  );
}