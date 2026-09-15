"use client";
// apps/tutor/src/components/dashboard/QuickActions.tsx
// Quick Actions grid. For an incomplete profile, "Continue Setup" is
// shown first and the rest still listed below (spec: "for incomplete
// profiles prioritize Continue Setup" — read as ordering, not hiding the
// others, since a tutor mid-setup may still want to jump to documents).

import Link from "next/link";
import { useTutorT } from "@gloows/tutor-i18n";
import type { DashboardStatusKey } from "@/lib/dashboardStatus";
import { Card } from "@/components/ui";

type Action = { labelKey: string; href: string; icon: string };

export default function QuickActions({ status }: { status: DashboardStatusKey }) {
  const { t } = useTutorT();

  const actions: Action[] = [
    ...(status === "draft" ? [{ labelKey: "dashQuickContinueSetup", href: "/onboarding?edit=1", icon: "🚀" }] : []),
    { labelKey: "dashQuickEditProfile", href: "/onboarding?edit=1", icon: "✏️" },
    { labelKey: "dashQuickManageDocuments", href: "/documents", icon: "📄" },
    { labelKey: "dashQuickSetAvailability", href: "/profile", icon: "🗓️" },
    { labelKey: "dashQuickVerificationStatus", href: "/dashboard", icon: "🛡️" },
    { labelKey: "dashQuickPayments", href: "/payouts", icon: "💳" },
  ];

  return (
    <div className="mb-4">
      <p className="text-sm font-black text-slate-100 mb-3">{t("dashQuickActionsTitle")}</p>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link key={a.labelKey} href={a.href}>
            <Card className="hover:border-brand-500 transition-colors text-center py-4">
              <div className="text-xl mb-1.5">{a.icon}</div>
              <p className="text-xs font-bold text-slate-300">{t(a.labelKey)}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
