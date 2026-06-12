type TProps = {
  active?: boolean;
  payload?: { name?: string; color?: string; value?: number }[];
  label?: string;
};

export default function ChartTooltip({ active, payload, label }: TProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm shadow-xl">
      {label && <p className="text-slate-300 font-semibold mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {(p.value ?? 0).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}
