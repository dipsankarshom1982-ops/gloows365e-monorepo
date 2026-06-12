const ALLOWED = ["education","scholarship","exam","course","skill","olympiad"];
const BLOCKED  = ["gambling","betting","crypto","dating","adult","casino","violent","loan","fake"];

interface Props { category: string; title?: string }

export default function SafetyBadge({ category, title = "" }: Props) {
  const text = `${category} ${title}`.toLowerCase();
  const blocked = BLOCKED.some((kw) => text.includes(kw));
  const allowed = ALLOWED.includes(category);

  if (blocked) return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
      🚫 Blocked
    </span>
  );
  if (allowed) return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/30">
      ✅ Safe
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
      ⚠️ Review
    </span>
  );
}
