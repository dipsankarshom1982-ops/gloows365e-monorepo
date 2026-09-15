"use client";

// PATH: apps/web/src/components/layout/BottomNav.tsx
// Tab set + order now driven by AppConfigContext (appModules collection) —
// mirrors apps/mobile/app/(drawer)/(tabs)/_layout.tsx's behavior exactly,
// so disabling a module in admin's App Modules page hides it here too.
// Full tab definitions (icon/label/href) stay hardcoded since web uses
// hand-drawn SVGs keyed by id, not the Firestore "icon" string field —
// only which ids are shown, and in what order, comes from config.
// Home moved off the bar — replaced by Reels (Instagram-style vertical
// feed at /reels, same page as before, just now also in the tab bar).
// Home stays reachable via the drawer's permanent "Home" entry.
// Skill Battle → crossed swords icon (distinct from VidyaStar star)
// VidyaStar    → solid gold star (unchanged)

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppConfig } from "@/context/AppConfigContext";

const TABS = [
  {
    id: "reels",
    label: "Reels",
    href: "/reels",
    // Vertical "phone screen" with a play triangle — reads as short
    // vertical video, distinct from Seekho's horizontal rect+play+underline.
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="2" width="12" height="20" rx="3"
          stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8"
          fill={active ? "rgba(56,189,248,0.12)" : "none"}/>
        <path d="M10.5 8.5L15 12L10.5 15.5V8.5Z" fill={active ? "#38bdf8" : "#94a3b8"}/>
      </svg>
    ),
  },
  {
    id: "ai-guru",
    label: "AI Guru",
    href: "/ai-guru",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9"
          stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8"
          fill={active ? "rgba(56,189,248,0.12)" : "none"}/>
        <path d="M9 9.5C9 8.12 10.12 7 11.5 7H12.5C13.88 7 15 8.12 15 9.5C15 10.5 14.3 11.35 13.33 11.75L12 12.5V14"
          stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="12" cy="16.5" r="0.8" fill={active ? "#38bdf8" : "#94a3b8"}/>
      </svg>
    ),
  },
  {
    id: "shikshahub",
    label: "ShikshaHub",
    href: "/shikshahub",
    // Mortarboard/graduation-cap glyph — reads as "tutors/education
    // marketplace", distinct from AI Guru's circular brain icon and from
    // Seekho's former rect+play+underline (curriculum player) shape.
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 4L2 9L12 14L22 9L12 4Z"
          stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" strokeLinejoin="round"
          fill={active ? "rgba(56,189,248,0.12)" : "none"}/>
        <path d="M6 11.5V16C6 16 8.5 18 12 18C15.5 18 18 16 18 16V11.5"
          stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 9V15" stroke={active ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "skillbattle",
    label: "Skill Battle",
    href: "/battle",
    // Crossed swords — clearly "battle", nothing like a star
    icon: (active: boolean) => {
      const c = active ? "#38bdf8" : "#94a3b8";
      const f = active ? "rgba(56,189,248,0.15)" : "none";
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          {/* Background circle when active */}
          {active && <circle cx="12" cy="12" r="10" fill={f}/>}
          {/* Sword 1: top-left to bottom-right */}
          <line x1="5" y1="5" x2="16" y2="16"
            stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
          {/* Blade tip guard on sword 1 */}
          <line x1="5" y1="8" x2="5" y2="5"
            stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="5" y1="5" x2="8" y2="5"
            stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
          {/* Crossguard sword 1 */}
          <line x1="8.5" y1="8.5" x2="11" y2="6"
            stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
          {/* Sword 2: top-right to bottom-left */}
          <line x1="19" y1="5" x2="8" y2="16"
            stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
          {/* Blade tip guard on sword 2 */}
          <line x1="19" y1="8" x2="19" y2="5"
            stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="19" y1="5" x2="16" y2="5"
            stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
          {/* Crossguard sword 2 */}
          <line x1="15.5" y1="8.5" x2="13" y2="6"
            stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
          {/* Handle 1 */}
          <line x1="16" y1="16" x2="19" y2="19"
            stroke={c} strokeWidth="2.2" strokeLinecap="round"/>
          {/* Handle 2 */}
          <line x1="8" y1="16" x2="5" y2="19"
            stroke={c} strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      );
    },
  },
  {
    id: "vidyastar",
    label: "VidyaStar",
    href: "/vidyastar",
    // Gold star — unchanged, clearly different from swords
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          fill={active ? "#fbbf24" : "none"}
          stroke={active ? "#fbbf24" : "#94a3b8"}
          strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { modules, configLoading } = useAppConfig();

  // modules is already filtered to enabled-only (or all, for testers/admins)
  // and ordered by `order` — see AppConfigContext. While it's still loading,
  // show every tab in its default order rather than flashing an empty bar.
  const tabOrder = configLoading || modules.length === 0
    ? TABS.map((t) => t.id)
    : modules.map((m) => m.id);

  const tabMap = Object.fromEntries(TABS.map((t) => [t.id, t]));
  const visibleTabs = tabOrder
    .map((id) => tabMap[id])
    .filter((t): t is typeof TABS[number] => !!t);

  return (
    <nav className="bottom-nav">
      {visibleTabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link key={tab.id} href={tab.href} className={`nav-tab ${active ? "active" : ""}`}>
            <div className="nav-icon">{tab.icon(active)}</div>
            <span className="nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}