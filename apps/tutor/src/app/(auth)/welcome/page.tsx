"use client";
import Link from "next/link";
import { useTutorT } from "@gloows/tutor-i18n";
import { Button } from "@/components/ui";

export default function WelcomePage() {
  const { t } = useTutorT();

  return (
    <div className="min-h-dvh flex flex-col justify-between p-8 bg-bg">
      <div />
      <div className="text-center">
        <div className="text-5xl mb-6">🎓</div>
        <h1 className="text-3xl font-black text-slate-100 mb-3">{t("welcomeTitle")}</h1>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">{t("welcomeSubtitle")}</p>
      </div>
      <div className="max-w-sm w-full mx-auto space-y-3">
        <Link href="/register"><Button>{t("getStarted")}</Button></Link>
        <Link href="/login"><Button variant="secondary">{t("loginTitle")}</Button></Link>
      </div>
    </div>
  );
}
