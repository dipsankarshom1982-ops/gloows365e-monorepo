"use client";
// apps/tutor/src/components/onboarding/OnboardingUI.tsx
// Shared building blocks for app/onboarding/page.tsx — progress bar,
// chip selector, banner, brand mark, icons. Split out purely to keep
// that page's already-large step-by-step JSX readable; nothing here is
// meant to be reused outside the onboarding flow (see ../../app/(auth)/
// login/page.tsx for this app's general-purpose auth-screen icons,
// which are deliberately NOT shared with this file — small duplication
// across auth-adjacent screens is this codebase's established norm, see
// apps/tutor-mobile's BrandLogo duplicated across welcome.tsx/login.tsx).

export type BannerTone = "error" | "success" | "info";

const BANNER_TONE_CLASSES: Record<BannerTone, { box: string; badge: string; text: string; glyph: string }> = {
  error:   { box: "bg-red-400/10 border-red-400",     badge: "bg-red-400",   text: "text-red-300",   glyph: "!" },
  success: { box: "bg-green-400/10 border-green-400", badge: "bg-green-400", text: "text-green-300", glyph: "✓" },
  info:    { box: "bg-brand-400/10 border-brand-400", badge: "bg-brand-400", text: "text-brand-200", glyph: "i" },
};

export function Banner({ tone, children }: { tone: BannerTone; children: string }) {
  const c = BANNER_TONE_CLASSES[tone];
  return (
    <div role="alert" aria-live="polite" className={`flex items-start gap-2.5 rounded-xl border-l-[3px] px-3.5 py-3 mb-4 ${c.box}`}>
      <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black text-[#0B1226] shrink-0 mt-0.5 ${c.badge}`}>{c.glyph}</span>
      <span className={`text-[13px] font-semibold leading-snug flex-1 ${c.text}`}>{children}</span>
    </div>
  );
}

export function FieldError({ children }: { children: string }) {
  return <p role="alert" className="mt-1.5 ml-0.5 text-xs font-semibold text-red-300">{children}</p>;
}

export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <div className="flex items-center gap-1">
        <span className="text-xl font-black tracking-tight">
          <span className="text-brand-300">Gl</span>
          <span className="text-slate-100">oows</span>
        </span>
        <span className="rounded-md px-1.5 py-0.5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-cyan-400">
          <span className="text-white text-[11px] font-black tracking-wide">365</span>
        </span>
        <span className="text-[9px] font-black text-gold">E</span>
      </div>
      <span className="rounded-full px-2 py-0.5 bg-brand-500/15 border border-brand-500/40 text-brand-300 text-[10px] font-extrabold tracking-widest">
        TUTOR
      </span>
    </div>
  );
}

export function ProgressBar({ step, totalSteps, t }: { step: number; totalSteps: number; t: (k: string, o?: any) => string }) {
  // Steps are numbered 2-5 in the product spec (Step 1 is account
  // creation, a separate screen) — percentage is computed off that same
  // 2-5 range so "Step 2 of 5" reads 20%, not a confusing 0%.
  const percent = Math.round(((step - 1) / totalSteps) * 100);
  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold tracking-widest text-slate-500">
          {t("onboardingStepOf", { current: step, total: totalSteps })}
        </span>
        <span className="text-[11px] font-bold text-brand-300">{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function SectionLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <span className="text-[13px] font-bold text-slate-300 tracking-wide">{children}</span>
      {required
        ? <span className="text-[10px] font-extrabold text-red-400">*</span>
        : <span className="text-[10px] font-semibold text-slate-500">(optional)</span>}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3.5 py-2 text-[13px] font-bold border transition-colors min-h-[40px] ${
        active
          ? "border-brand-400 bg-brand-500/15 text-brand-200"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/[0.08]"
      }`}
    >
      {children}
    </button>
  );
}

export function TextField({
  id, label, required, value, onChange, placeholder, type = "text", error, hint, disabled, list, inputMode,
}: {
  id: string; label: string; required?: boolean; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string;
  error?: string | null; hint?: string; disabled?: boolean; list?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="mb-5">
      <SectionLabel required={required}>{label}</SectionLabel>
      <input
        id={id}
        type={type}
        list={list}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-2xl border px-3.5 py-3.5 text-[15px] text-slate-50 placeholder-slate-500 bg-white/5 outline-none transition-colors focus:border-brand-400 focus:bg-brand-500/10 disabled:opacity-50 ${
          error ? "border-red-400" : "border-white/10"
        }`}
      />
      {hint && !error && <p className="mt-1.5 ml-0.5 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 ml-0.5 text-xs font-semibold text-red-300">{error}</p>}
    </div>
  );
}

export function PrimaryButton({
  onClick, disabled, loading, loadingLabel, children, type = "button",
}: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; loadingLabel?: string;
  children: React.ReactNode; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading}
      className="w-full h-[54px] rounded-[18px] font-extrabold text-[15px] tracking-wide text-white bg-gradient-to-r from-[#4F46E5] via-brand-500 to-cyan-400 shadow-lg shadow-brand-600/30 hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
    >
      {loading ? (
        <>
          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          {loadingLabel}
        </>
      ) : children}
    </button>
  );
}

export function SecondaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[54px] px-6 rounded-[18px] font-extrabold text-[15px] text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function TextLink({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[13.5px] font-bold text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 text-center w-full mt-4"
    >
      {children}
    </button>
  );
}
