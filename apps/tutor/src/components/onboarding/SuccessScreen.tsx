"use client";
// apps/tutor/src/components/onboarding/SuccessScreen.tsx
// Shown after submitTutorOnboarding succeeds — see
// ../../app/onboarding/page.tsx.

import { useRouter } from "next/navigation";
import { useTutorT } from "@gloows/tutor-i18n";
import { PrimaryButton } from "./OnboardingUI";

export default function SuccessScreen() {
  const { t } = useTutorT();
  const router = useRouter();

  return (
    <div className="text-center">
      <div className="text-5xl mb-5">🎉</div>
      <h1 className="text-2xl font-extrabold text-slate-50 mb-2 tracking-tight">{t("obSuccessTitle")}</h1>
      <p className="text-sm text-slate-300 font-semibold mb-1.5">{t("obSuccessThankYou")}</p>
      <p className="text-sm text-slate-400 mb-7 leading-relaxed">{t("obSuccessBody")}</p>

      <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3.5 mb-7">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="text-[13.5px] font-extrabold text-amber-300">{t("obSuccessStatus")}</span>
      </div>

      <PrimaryButton onClick={() => router.replace("/dashboard")}>
        {t("obSuccessDashboardButton")}
      </PrimaryButton>

      <button
        type="button"
        onClick={() => router.push("/verification")}
        className="mt-4 text-[13.5px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
      >
        {t("obSuccessStatusLink")}
      </button>
    </div>
  );
}
