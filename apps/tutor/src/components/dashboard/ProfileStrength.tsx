"use client";
// apps/tutor/src/components/dashboard/ProfileStrength.tsx
// "Profile Strength" card — star rating + encouraging copy, never
// punitive language per spec (no "poor"/"weak" tier exists at all, see
// packages/shared-logic/src/lib/tutorProfileCompletion.ts).

import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorProfileStrength } from "@gloows/shared-logic";
import { Card } from "@/components/ui";

const STARS: Record<TutorProfileStrength, number> = {
  beginner: 1, developing: 2, good: 3, strong: 4, excellent: 5,
};

const LABEL_KEY: Record<TutorProfileStrength, string> = {
  beginner: "dashStrengthBeginner", developing: "dashStrengthDeveloping", good: "dashStrengthGood",
  strong: "dashStrengthStrong", excellent: "dashStrengthExcellent",
};

const TIP_KEY: Record<TutorProfileStrength, string> = {
  beginner: "dashStrengthTipBeginner", developing: "dashStrengthTipDeveloping", good: "dashStrengthTipGood",
  strong: "dashStrengthTipStrong", excellent: "dashStrengthTipExcellent",
};

export default function ProfileStrength({ strength }: { strength: TutorProfileStrength }) {
  const { t } = useTutorT();
  const filled = STARS[strength];

  return (
    <Card className="mb-4">
      <p className="text-[11px] font-bold text-slate-500 tracking-widest uppercase mb-2">{t("dashProfileStrengthTitle")}</p>
      <div className="flex items-center gap-1.5 mb-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= filled ? "text-gold text-lg" : "text-slate-700 text-lg"}>★</span>
        ))}
      </div>
      <p className="text-sm font-black text-slate-100 mb-1.5">{t(LABEL_KEY[strength])}</p>
      <p className="text-xs text-slate-500">{t(TIP_KEY[strength])}</p>
    </Card>
  );
}
