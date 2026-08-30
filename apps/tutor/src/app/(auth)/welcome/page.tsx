"use client";
// apps/tutor/src/app/(auth)/welcome/page.tsx
// Redesigned to match apps/mobile's (auth)/welcome.tsx — the Gloows365E
// student app's welcome screen (indigo→violet gradient, floating brand
// logo with a "365" pill badge, language chips, gradient pill CTA) — so
// Gloows Tutor's first screen reads as part of the same ecosystem instead
// of a plain, unbranded card.

import Link from "next/link";
import { useTutorT, SUPPORTED_TUTOR_LANGUAGES, type TutorLanguageCode } from "@gloows/tutor-i18n";

// Brand logo — "Gl" + "oows" + a gradient "365" pill + gold "E", matching
// apps/mobile's header.tsx / (auth)/welcome.tsx brand mark exactly.
function BrandLogo() {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="text-5xl font-black tracking-tight">
        <span className="text-brand-300">Gl</span>
        <span className="text-slate-100">oows</span>
      </span>
      <span className="rounded-[11px] px-2.5 py-1 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#EC4899]">
        <span className="text-white text-2xl font-black tracking-wide">365</span>
      </span>
      <span className="text-lg font-black text-gold">E</span>
    </div>
  );
}

export default function WelcomePage() {
  const { t, i18n } = useTutorT();
  const currentLang = (i18n.language?.split("-")[0] ?? "en") as TutorLanguageCode;

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden p-6 bg-gradient-to-br from-[#1E1B4B] via-[#4F46E5] to-[#7C3AED]">
      {/* Glow effects — mirrors mobile's glow1/glow2 */}
      <div className="absolute top-14 -left-12 w-48 h-48 rounded-full bg-brand-400 opacity-20 blur-2xl" />
      <div className="absolute bottom-20 -right-10 w-44 h-44 rounded-full bg-[#C084FC] opacity-20 blur-2xl" />

      {/* Floating brand logo */}
      <div className="animate-brand-float">
        <BrandLogo />
      </div>

      {/* Tagline */}
      <p className="mt-4 mb-6 max-w-xs text-center text-[15px] leading-relaxed text-brand-100 whitespace-pre-line">
        {t("welcomeSubtitle")}
      </p>

      {/* Language selection */}
      <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-sm">
        {SUPPORTED_TUTOR_LANGUAGES.map((lang) => {
          const active = lang.code === currentLang;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => i18n.changeLanguage(lang.code)}
              className={
                "rounded-full px-3.5 py-1.5 text-xs border transition-colors " +
                (active
                  ? "bg-white border-white text-brand-900 font-bold"
                  : "bg-white/10 border-white/30 text-white hover:bg-white/20")
              }
            >
              {lang.native}
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <Link
        href="/register"
        className="rounded-full px-14 py-4 font-bold text-brand-900 bg-gradient-to-b from-white to-brand-100 hover:opacity-90 transition-opacity"
      >
        {t("getStarted")} →
      </Link>

      <Link href="/login" className="mt-4 text-sm text-white/90 hover:text-white underline underline-offset-4">
        {t("loginTitle")}
      </Link>

      {/* Trust line */}
      <p className="mt-8 text-xs text-brand-200">{t("welcomeFooter")}</p>
    </div>
  );
}
