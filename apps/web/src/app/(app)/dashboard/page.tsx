"use client";

// PATH: apps/web/src/app/(app)/dashboard/page.tsx
// Linked from Drawer.tsx's nav ("Dashboard"). Simple profile summary card grid.
//
// FIX (bug report — "all updated v-coins must be shown in drawer and
// v-coins page properly"): this page used to fetch users/{uid} by hand and
// read a lowercase `vcoins` field — a field name nothing anywhere in this
// app ever writes (the real fields are vCoinsBalance and vCoins, see
// hooks/useVCoins.ts's FIX comment), so this card always showed 0
// regardless of actual balance. Same issue for `xp`: nothing writes
// users/{uid}.xp — the real field is students/{uid}.LearnFunXP. Switched
// to useVCoins() (same combined-balance hook Wallet/AppHeader/Drawer use)
// and useStudentProfile() (same source every other screen in this app
// already reads name/class/board/photo/XP from), so this page now shows
// the same numbers as everywhere else instead of its own always-zero copy.

import { useStudentProfile } from "@gloows/shared-logic";
import { useVCoins } from "@/hooks/useVCoins";

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <p className="text-gray-500">{title}</p>
      <h2 className="text-2xl font-bold mt-2">{value}</h2>
    </div>
  );
}

export default function DashboardPage() {
  const { user, studentProfile, profileLoading } = useStudentProfile();
  const { balance } = useVCoins();

  if (profileLoading) {
    return <div className="p-6">Loading Dashboard...</div>;
  }

  const name  = studentProfile?.name  || "Student";
  const xp    = (studentProfile as Record<string, unknown> | null | undefined)?.LearnFunXP as number ?? 0;
  const board = studentProfile?.board || "-";

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome {name}</h1>
          <p className="text-gray-500">{user?.email}</p>
        </div>
        <img
          src={studentProfile?.profilePic || "/avatar.png"}
          className="w-16 h-16 rounded-full"
          alt="avatar"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card title="XP" value={xp} />
        <Card title="VCoins" value={balance ?? 0} />
        <Card title="Class" value={studentProfile?.class || "-"} />
        <Card title="Board" value={board} />
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <div className="bg-white rounded-xl shadow p-5">No activities found</div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Achievements</h2>
        <div className="bg-white rounded-xl shadow p-5">Coming Soon</div>
      </div>
    </div>
  );
}
