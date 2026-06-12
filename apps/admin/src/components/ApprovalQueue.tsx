import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SafetyBadge from "./SafetyBadge";
import StatusBadge from "./StatusBadge";

export interface ApprovalItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  uploaderName: string;
  createdAt?: { toDate?: () => Date } | string;
  approvalStatus: "pending" | "approved" | "rejected";
  category?: string;
  subtitle?: string;
}

interface Props {
  items: ApprovalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  loading: boolean;
  emptyMessage?: string;
}

export default function ApprovalQueue({ items, onApprove, onReject, loading, emptyMessage }: Props) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason]     = useState("");

  const submitReject = (id: string) => {
    onReject(id, reason);
    setRejectId(null);
    setReason("");
  };

  if (loading) return <div className="text-center text-slate-400 py-16">Loading…</div>;
  if (!items.length) return <div className="text-center text-slate-400 py-16">{emptyMessage ?? "Nothing here."}</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: i * 0.03 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
          >
            {/* Thumbnail */}
            <div className="h-36 bg-slate-800 flex items-center justify-center overflow-hidden">
              {item.thumbnailUrl
                ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                : <span className="text-4xl text-slate-600">🖼️</span>
              }
            </div>

            <div className="p-4 space-y-3">
              <div>
                <p className="text-white font-semibold truncate">{item.title}</p>
                {item.subtitle && <p className="text-slate-400 text-xs truncate">{item.subtitle}</p>}
                <p className="text-slate-500 text-xs mt-0.5">by {item.uploaderName}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge
                  label={item.approvalStatus}
                  variant={item.approvalStatus === "approved" ? "success" : item.approvalStatus === "rejected" ? "error" : "warning"}
                />
                {item.category && <SafetyBadge category={item.category} title={item.title} />}
              </div>

              {item.approvalStatus === "pending" && (
                rejectId === item.id ? (
                  <div className="space-y-2">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Rejection reason…"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => submitReject(item.id)} className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-bold py-1.5 rounded-lg transition-colors">Confirm Reject</button>
                      <button onClick={() => setRejectId(null)} className="text-slate-400 hover:text-white text-xs px-3">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => onApprove(item.id)} className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-bold py-1.5 rounded-lg transition-colors">✓ Approve</button>
                    <button onClick={() => { setRejectId(item.id); setReason(""); }} className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-bold py-1.5 rounded-lg transition-colors">✗ Reject</button>
                  </div>
                )
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
