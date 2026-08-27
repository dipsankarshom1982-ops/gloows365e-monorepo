// PATH: apps/web/src/app/(auth)/layout.tsx
//
// Auth group layout — passthrough only.
// No AuthGuard, no AppHeader, no BottomNav.
// All pages in (auth)/ render full-screen, matching mobile's pure gradient screens.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
