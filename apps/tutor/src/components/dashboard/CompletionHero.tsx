"use client";
// apps/tutor/src/components/dashboard/CompletionHero.tsx
// Tutor Profile Completion & Verification Dashboard — the hero card at
// the top: greeting, status-dependent subtitle, animated completion
// progress bar, checklist summary, dynamic primary CTA. Progress-bar
// visual (gradient fill, percent-driven width, no gauge library) is
// adapted from apps/tutor/src/components/onboarding/OnboardingUI.tsx's
// ProgressBar — same gradient (brand-500 -> cyan-400) for visual
// continuity between onboarding and the dashboard that follows it.

import Link from "next/link";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorProfileCompletionResult } from "@gloows/shared-logic";
import { tutorProfileSectionLabel } from "@gloows/shared-logic";
import {
  STATUS_META, greetingKeyForHour, type DashboardStatusKey,
} from "@/lib/dashboardStatus";
import { Card } from "@/components/ui";

type Props = {
  name: string;
  status: DashboardStatusKey;
  completion: TutorProfileCompletionResult;
  payoutSetUp: boolean;
  ctaHref: string;
};

export default function CompletionHero({ name, status, completion, payoutSetUp, ctaHref }: Props) {
  const { t } = useTutorT();
  const meta = STATUS_META[status];
  const hour = new Date().getHours();
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  return (
    <Card className="mb-4">
      <p className="text-lg font-black text-slate-100">
        {t(greetingKeyForHour(hour), { name: firstName })} 👋
      </p>
      <p className="text-sm text-slate-400 mt-1 mb-5">{t(meta.subtitleKey)}</p>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
          {t("dashProfileCompletion")}
        </span>
        <span className="text-sm font-black text-brand-300">{completion.completionPercentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-700 overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400 transition-all duration-500"
          style={{ width: `${completion.completionPercentage}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mb-4">{t("dashCompletionHint")}</p>

      <ul className="flex flex-col gap-1.5 mb-5">
        {completion.completedSections.map((id) => (
          <li key={id} className="flex items-center gap-2 text-[13px] text-slate-300">
            <span className="text-success">✓</span> {tutorProfileSectionLabel(id)}
          </li>
        ))}
        {completion.incompleteSections.map((id) => (
          <li key={id} className="flex items-center gap-2 text-[13px] text-slate-500">
            <span className={id === "verification_documents" ? "text-warning" : "text-slate-600"}>
              {id === "verification_documents" ? "⚠" : "○"}
            </span>
            {tutorProfileSectionLabel(id)}
          </li>
        ))}
        <li className="flex items-center gap-2 text-[13px] text-slate-500">
          <span className={payoutSetUp ? "text-success" : "text-slate-600"}>{payoutSetUp ? "✓" : "○"}</span>
          {t("dashPayoutSetupLabel")}
        </li>
      </ul>

      <Link href={ctaHref} className="block w-full text-center rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold py-3 transition-colors">
        {t(meta.ctaKey)}
      </Link>
    </Card>
  );
}
