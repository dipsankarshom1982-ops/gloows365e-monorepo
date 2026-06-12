const VARIANTS: Record<string, string> = {
  success: "bg-green-500/20 text-green-400",
  warning: "bg-amber-500/20 text-amber-400",
  error:   "bg-red-500/20 text-red-400",
  info:    "bg-indigo-500/20 text-indigo-400",
  purple:  "bg-purple-500/20 text-purple-400",
  default: "bg-slate-700 text-slate-300",
};

interface Props {
  label: string;
  variant?: keyof typeof VARIANTS;
}

export default function StatusBadge({ label, variant = "default" }: Props) {
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${VARIANTS[variant] ?? VARIANTS.default}`}>
      {label}
    </span>
  );
}
