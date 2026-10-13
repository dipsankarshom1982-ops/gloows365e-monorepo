"use client";

// PATH: apps/web/src/components/layout/BottomNav.tsx
// Navigation restructure — fixed 5-tab bar: Home · Dashboard · Learn ·
// Challenge · Menu. No longer driven by AppConfigContext/appModules (that
// Firestore-configurable module list drove the old Reels/AI Guru/
// ShikshaHub/Skill Battle/VidyaStar tab set); this new tab set is fixed
// by the nav spec, not admin-toggleable. Mirrors the same change made in
// apps/mobile/app/(drawer)/(tabs)/_layout.tsx.
//
// Menu no longer links anywhere — it opens the existing Drawer via the
// onMenuOpen callback the caller passes in (same drawerOpen state
// (app)/layout.tsx already threads through to AppHeader's hamburger).

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    id: "home",
    label: "Home",
    href: "/home",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 11L12 4L20 11V19A1 1 0 0119 20H15V14H9V20H5A1 1 0 014 19V11Z"
          stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" strokeLinejoin="round"
          fill={active ? "rgba(56,189,248,0.12)" : "none"}/>
      </svg>
    ),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: (active: boolean) => {
      const c = active ? "#38bdf8" : "#94a3b8";
      const f = active ? "rgba(56,189,248,0.12)" : "none";
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.8" fill={f}/>
          <rect x="13" y="3" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.8" fill={f}/>
          <rect x="3" y="13" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.8" fill={f}/>
          <rect x="13" y="13" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.8" fill={f}/>
        </svg>
      );
    },
  },
  {
    id: "learn",
    label: "Learn",
    href: "/learn",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 5.5C4 4.67 4.67 4 5.5 4H12V20H5.5C4.67 20 4 19.33 4 18.5V5.5Z"
          stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" strokeLinejoin="round"
          fill={active ? "rgba(56,189,248,0.12)" : "none"}/>
        <path d="M20 5.5C20 4.67 19.33 4 18.5 4H12V20H18.5C19.33 20 20 19.33 20 18.5V5.5Z"
          stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "challenge",
    label: "Challenge",
    href: "/challenge",
    icon: (active: boolean) => {
      const c = active ? "#38bdf8" : "#94a3b8";
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8" fill={active ? "rgba(56,189,248,0.12)" : "none"}/>
          <circle cx="12" cy="12" r="5" stroke={c} strokeWidth="1.8"/>
          <circle cx="12" cy="12" r="1.4" fill={c}/>
        </svg>
      );
    },
  },
];

interface Props {
  onMenuOpen: () => void;
}

export default function BottomNav({ onMenuOpen }: Props) {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link key={tab.id} href={tab.href} className={`nav-tab ${active ? "active" : ""}`}>
            <div className="nav-icon">{tab.icon(active)}</div>
            <span className="nav-label">{tab.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMenuOpen}
        className="nav-tab"
        style={{ background: "none", border: "none", font: "inherit" }}
      >
        <div className="nav-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="nav-label">Menu</span>
      </button>
    </nav>
  );
}
