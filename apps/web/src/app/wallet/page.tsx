// apps/web/src/app/wallet/page.tsx
// V-Coins Wallet on web — uses shared useVCoins hook directly.

"use client";

import { useVCoins } from "@gloows/shared-logic";

export default function WalletPage() {
  const { balance, lifetimeEarned, thisMonthEarned, transactions, loading } = useVCoins();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🪙 V-Coins Wallet</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Balance" value={balance ?? 0} color="indigo" />
        <StatCard label="This Month" value={thisMonthEarned} color="green" />
        <StatCard label="All Time" value={lifetimeEarned} color="amber" />
      </div>

      {/* Transaction list */}
      <h2 className="text-lg font-semibold mb-3 text-slate-300">Recent Transactions</h2>
      <div className="space-y-2">
        {transactions.length === 0 && (
          <p className="text-slate-500 text-center py-8">No transactions yet</p>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex justify-between items-center bg-slate-900 rounded-xl px-4 py-3">
            <div>
              <p className="text-white text-sm font-medium">{tx.reason}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {tx.createdAt?.toDate?.()?.toLocaleDateString?.("en-IN") ?? ""}
              </p>
            </div>
            <span className={`font-bold text-base ${tx.type === "CREDIT" ? "text-green-400" : "text-red-400"}`}>
              {tx.type === "CREDIT" ? "+" : "-"}{tx.amount}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-400",
    green:  "text-green-400",
    amber:  "text-amber-400",
  };
  return (
    <div className="bg-slate-900 rounded-2xl p-4 text-center">
      <p className={`text-2xl font-black ${colors[color]}`}>{value.toLocaleString()}</p>
      <p className="text-slate-400 text-xs mt-1">{label}</p>
    </div>
  );
}
