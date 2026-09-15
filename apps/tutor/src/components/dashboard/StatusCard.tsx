"use client";
// apps/tutor/src/components/dashboard/StatusCard.tsx
// Dedicated profile-status card — icon + text label + description,
// never color-only per the spec ("Do not rely only on colour. Always
// display text labels."). Shows the admin-provided rejection reason
// inline when present, matching the spec's "always show the specific
// reason, never just Rejected" requirement.

import { useTutorT } from "@gloows/tutor-i18n";
import { STATUS_META, type DashboardStatusKey } from "@/lib/dashboardStatus";
import { Card } from "@/components/ui";

type Props = {
  status: DashboardStatusKey;
  rejectionReason?: string;
};

export default function StatusCard({ status, rejectionReason }: Props) {
  const { t } = useTutorT();
  const meta = STATUS_META[status];

  return (
    <Card className="mb-4">
      <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-2">{t("dashStatusCardTitle")}</p>
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none">{meta.icon}</span>
        <div>
          <p className="text-sm font-black text-slate-100">{t(meta.labelKey)}</p>
          <p className="text-[13px] text-slate-400 mt-0.5">{t(meta.descriptionKey)}</p>
        </div>
      </div>
      {status === "rejected" && rejectionReason && (
        <div className="mt-3 rounded-lg border-l-[3px] border-danger bg-danger/10 px-3 py-2.5">
          <p className="text-[11px] font-bold text-danger uppercase tracking-wide mb-1">{t("dashRejectionReasonLabel")}</p>
          <p className="text-[13px] text-slate-200">{rejectionReason}</p>
        </div>
      )}
    </Card>
  );
}
