import AuthGuard from "@/components/AuthGuard";
import InstantHelpBar from "@/components/InstantHelpBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      {/* ShikshaHub Phase 4 — global, not per-page: an Instant Help
         request/session can happen no matter which screen is open. */}
      <InstantHelpBar />
    </AuthGuard>
  );
}
