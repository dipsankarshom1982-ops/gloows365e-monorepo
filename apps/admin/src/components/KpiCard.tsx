import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface Props {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  color: string;
  format?: "number" | "percent";
}

export default function KpiCard({ label, value, suffix = "", icon, color, format = "number" }: Props) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) =>
    format === "percent" ? `${(v * 100).toFixed(1)}%` : `${Math.round(v).toLocaleString("en-IN")}${suffix}`
  );
  const prevRef = useRef(0);

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.2, ease: "easeOut" });
    prevRef.current = value;
    return controls.stop;
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${color}`}>LIVE</span>
      </div>
      <motion.p className="text-3xl font-black text-white tabular-nums">{rounded}</motion.p>
      <p className="text-slate-400 text-sm font-medium">{label}</p>
    </motion.div>
  );
}
