import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function DrawerPanel({ open, onClose, title, subtitle, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-[520px] bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
          >
            <div className="flex items-start justify-between p-5 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-white font-bold text-lg">{title}</h2>
                {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none transition-colors mt-0.5">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
