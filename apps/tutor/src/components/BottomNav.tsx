"use client";
// apps/tutor/src/components/BottomNav.tsx
// Phase 1d redesign — Classes as the 3rd primary slot pushed this to 6
// items (Dashboard/Students/Batches/Classes/Profile/Verification),
// exactly the trigger flagged back in Phase 1c. Adapted from spec
// section 11's own recommended nav (Home/Students/Classes/Marketplace/
// More — Marketplace doesn't exist yet) to Dashboard/Students/Classes/
// More, with Batches demoted into More alongside Profile/Verification —
// the spec's own list never had Batches as primary either.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/students",  label: "Students",  icon: "🧑‍🎓" },
  { href: "/classes",   label: "Classes",   icon: "🗓️" },
];

const MORE_PREFIXES = ["/batches", "/bookings", "/services", "/payouts", "/profile", "/verification", "/documents", "/notifications", "/reviews", "/messages", "/more"];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTutorT();
  const moreActive = MORE_PREFIXES.some((p) => pathname?.startsWith(p));

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-slate-700 flex items-center justify-around py-2 px-4">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-semibold ${
            pathname === l.href ? "text-brand-400" : "text-slate-500"
          }`}
        >
          <span className="text-base">{l.icon}</span>
          {l.label}
        </Link>
      ))}
      <Link
        href="/more"
        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-semibold ${
          moreActive ? "text-brand-400" : "text-slate-500"
        }`}
      >
        <span className="text-base">☰</span>
        {t("moreNavLabel")}
      </Link>
      <button
        onClick={() => { signOut(auth); router.replace("/welcome"); }}
        className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-semibold text-slate-500"
      >
        <span className="text-base">🚪</span>
        {t("logout")}
      </button>
    </nav>
  );
}
