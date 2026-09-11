"use client";
// apps/tutor/src/components/dashboard/VerificationTimeline.tsx
// 5-stage verification journey, current stage highlighted. See
// apps/tutor/src/lib/dashboardStatus.ts's timelineStages() for the
// stage-state logic (including the rejected-branch swap).

import { useTutorT } from "@gloows/tutor-i18n";
import { timelineStages, type DashboardStatusKey, type TimelineStageState } from "@/lib/dashboardStatus";
import { Card } from "@/components/ui";

const STATE_GLYPH: Record<TimelineStageState, { icon: string; color: string }> = {
  done:     { icon: "✓", color: "text-success" },
  current:  { icon: "●", color: "text-brand-400" },
  warning:  { icon: "⚠", color: "text-warning" },
  upcoming: { icon: "○", color: "text-slate-600" },
};

type Props = {
  status: DashboardStatusKey;
  onboardingCompleted?: boolean;
};

export default function VerificationTimeline({ status, onboardingCompleted }: Props) {
  const { t } = useTutorT();
  const stages = timelineStages(status, onboardingCompleted);

  return (
    <Card className="mb-4">
      <p className="text-sm font-black text-slate-100 mb-3">{t("dashTimelineTitle")}</p>
      <div className="flex flex-col gap-2">
        {stages.map((stage, i) => {
          const g = STATE_GLYPH[stage.state];
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span className={`w-4 text-center font-black ${g.color}`}>{g.icon}</span>
              <span className={`text-[13px] ${stage.state === "upcoming" ? "text-slate-500" : "text-slate-200"} ${stage.state === "current" ? "font-bold" : ""}`}>
                {t(stage.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
