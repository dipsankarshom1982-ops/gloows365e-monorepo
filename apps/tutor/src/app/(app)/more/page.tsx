"use client";
// apps/tutor/src/app/(app)/more/page.tsx
// Phase 1d nav redesign — Batches moved here alongside Profile/
// Verification now that Classes takes the 3rd primary BottomNav slot
// (spec section 11's own recommended nav never had Batches as primary
// either). Reuses each destination's existing *Title i18n key rather
// than duplicating labels.

import Link from "next/link";
import { useTutorT } from "@gloows/tutor-i18n";
import { useTutorProfile, useUnreadNotificationCount } from "@gloows/shared-logic";
import { Card } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const ITEMS = [
  { href: "/notifications", titleKey: "notificationsTitle", icon: "🔔" },
  { href: "/batches",      titleKey: "batchesTitle",      icon: "📚" },
  { href: "/services",     titleKey: "servicesTitle",     icon: "🧩" },
  { href: "/payouts",      titleKey: "payoutsTitle",      icon: "💸" },
  { href: "/bookings",     titleKey: "shikshaHubBookingRequestsTitle", icon: "🎓" },
  { href: "/messages",     titleKey: "myMessagesTitle",   icon: "💬" },
  { href: "/reviews",      titleKey: "myReviewsTitle",    icon: "⭐" },
  { href: "/profile",      titleKey: "profileTitle",      icon: "👤" },
  { href: "/verification", titleKey: "verificationTitle", icon: "📄" },
];

export default function MorePage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const unreadCount = useUnreadNotificationCount(user?.uid);

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">{t("moreTitle")}</h1>
        <div className="flex flex-col gap-3">
          {ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="flex items-center gap-3 hover:border-brand-500 transition-colors">
                <span className="text-lg">{item.icon}</span>
                <span className="font-semibold text-slate-100 flex-1">{t(item.titleKey)}</span>
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span className="bg-danger text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
