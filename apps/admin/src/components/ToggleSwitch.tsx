interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function ToggleSwitch({ value, onChange, label, disabled }: Props) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${value ? "bg-indigo-600" : "bg-slate-700"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-6" : ""}`} />
      </button>
      {label && <span className="text-slate-300 text-sm font-medium">{label}</span>}
    </label>
  );
}
