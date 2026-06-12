// apps/web/src/app/page.tsx
// Landing / home page for web users
// Students see their dashboard; guests see a marketing page

"use client";

import { useStudentProfile } from "@gloows/shared-logic";
import Link from "next/link";

export default function HomePage() {
  const { user, authLoading } = useStudentProfile();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-500" />
      </div>
    );
  }

  if (user) {
    // Logged-in students go straight to dashboard
    return <StudentDashboard />;
  }

  return <LandingPage />;
}

function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* Brand logo — matches mobile app */}
        <div className="flex items-baseline gap-0 text-5xl font-black mb-6">
          <span className="text-indigo-400">Gl</span>
          <span className="text-white">oows</span>
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 text-transparent bg-clip-text mx-1 text-3xl px-2 py-0.5 border border-indigo-400/40 rounded-full">
            365
          </span>
          <span className="text-amber-400 text-3xl">E</span>
        </div>

        <p className="text-slate-300 text-xl max-w-lg mb-8">
          AI-powered learning for every Indian student. Study smarter with Vidya AI Guru.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/login"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/ai-guru"
            className="border border-indigo-500 hover:bg-indigo-500/10 text-indigo-300 font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Try AI Guru
          </Link>
        </div>

        {/* Download app CTA */}
        <p className="mt-12 text-slate-500 text-sm">
          Best on mobile →{" "}
          <a href="#download" className="text-indigo-400 hover:underline">
            Download the app
          </a>
        </p>
      </section>
    </main>
  );
}

function StudentDashboard() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Welcome back!</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard href="/ai-guru" title="AI Guru" description="Ask questions, get instant answers" emoji="🤖" />
        <DashboardCard href="/seekho" title="Seekho" description="Study chapters and lessons" emoji="📚" />
        <DashboardCard href="/skill-battle" title="Skill Battle" description="Compete with students across India" emoji="⚔️" />
        <DashboardCard href="/wallet" title="V-Coins Wallet" description="Your rewards and transactions" emoji="🪙" />
        <DashboardCard href="/leaderboard" title="Leaderboard" description="See where you rank" emoji="🏆" />
        <DashboardCard href="/reels" title="Short Reels" description="Quick educational videos" emoji="🎬" />
      </div>
    </main>
  );
}

function DashboardCard({ href, title, description, emoji }: {
  href: string; title: string; description: string; emoji: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-2xl p-5 transition-colors cursor-pointer">
        <div className="text-3xl mb-3">{emoji}</div>
        <h2 className="text-white font-semibold text-lg">{title}</h2>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </div>
    </Link>
  );
}
