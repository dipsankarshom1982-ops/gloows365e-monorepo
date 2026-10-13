// apps/tutor/src/components/ui.tsx
// Minimal set of primitives actually needed by Phase 1a's screens, built
// against @gloows/tutor-ui's shared tokens via the Tailwind theme mapping
// in tailwind.config.ts (brand/slate/bg/surface color classes below all
// trace back to packages/tutor-ui/src/tokens.ts). Not a full design
// system — grows as later phases need more, per the approved plan's
// "shared tokens, platform-specific components" decision.

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const base = "w-full rounded-lg px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = variant === "primary"
    ? "bg-brand-600 hover:bg-brand-700 text-white"
    : "bg-surface2 hover:bg-slate-600 text-slate-100 border border-slate-600";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block mb-4">
      {label && <span className="block text-xs font-semibold text-slate-400 mb-1.5">{label}</span>}
      <input
        className={`w-full rounded-lg bg-surface border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 ${className}`}
        {...props}
      />
    </label>
  );
}

export function Textarea({ label, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block mb-4">
      {label && <span className="block text-xs font-semibold text-slate-400 mb-1.5">{label}</span>}
      <textarea
        rows={4}
        className={`w-full rounded-lg bg-surface border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none ${className}`}
        {...props}
      />
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-surface border border-slate-700 p-5 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones: Record<string, string> = {
    default: "bg-slate-700 text-slate-300",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger:  "bg-danger/15 text-danger",
  };
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="text-4xl mb-3 opacity-40">🎓</div>
      <p className="text-slate-300 font-semibold">{title}</p>
      {subtitle && <p className="text-slate-500 text-sm mt-1 max-w-xs">{subtitle}</p>}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-brand-500 animate-spin" />
    </div>
  );
}
