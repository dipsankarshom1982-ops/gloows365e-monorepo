// PATH: apps/admin/src/pages/AppStructure.tsx
//
// FEATURE CONTROL + APP MODULE RESTRUCTURE — the new unified Admin
// management page for the app's actual hierarchy:
//
//   SUPER MODULE (Home / Dashboard / Learn / Challenge / Menu — the fixed
//                 5-tab bottom nav, apps/mobile/app/(drawer)/(tabs)/_layout.tsx)
//       -> MODULE (a major destination inside Learn/Challenge, e.g. AI Guru)
//           -> FEATURE (a toggleable capability inside that module)
//
// This page does NOT replace the underlying Firestore-backed controls —
// it reads and writes the exact same documents the two existing pages
// already use:
//   - appModules/{id}            (AppModules.tsx)      -> Module-level
//   - featureFlags/homeSection   (FeatureControl.tsx)  -> Home features
//   - featureFlags/aiGuru        (FeatureControl.tsx)  -> AI Guru features
//   - featureFlags/drawerItems   (FeatureControl.tsx)  -> Menu items
// so nothing here is a second, competing system. AppModules.tsx and
// FeatureControl.tsx are left fully intact and still reachable directly
// (/modules, /feature-control) for raw flat management; this page is the
// new primary, hierarchy-first entry point.
//
// AUDIT FINDINGS this page's structure is based on (see the delivered
// audit report for full detail, not repeated here):
//   - Dashboard has no internal modules/features today — shown honestly
//     as "0 modules, 0 features", never invented.
//   - Only AI Guru has real Feature-level flags; the other 11 Learn/
//     Challenge modules show as a bare Module row with no expand arrow.
//   - Learn/Challenge module visibility previously had NO admin control
//     at all (appModules was orphaned) — wired up via learn.tsx/
//     challenge.tsx now reading useAppConfig().modules by these exact ids.
//   - Menu's drawer items are grouped to match the real Drawer's actual
//     on-screen sections (Quick Access / Account / Support / Other).
//
// Tester/admin bypass: unchanged, inherited from the same mechanism these
// documents already drive (users/{uid}.role, read in
// packages/shared-logic/src/context/FeatureFlagsContext.tsx and
// apps/mobile/context/AppConfigContext.tsx) — this page only edits the
// data those already-correct consumers read; it introduces no new access
// control logic of its own.

import { doc, getDoc, getDocs, collection, setDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import ToggleSwitch from "../components/ToggleSwitch";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";

// ─── Static hierarchy metadata ──────────────────────────────────────────
// Labels/icons/keys here are copied from the actual consumers (learn.tsx,
// challenge.tsx, FeatureControl.tsx) — not invented. Where a consumer file
// is the source of truth for a key list, its path is noted.

interface FeatureDef { key: string; icon: string; label: string; description: string; isPremium?: boolean; }
interface ModuleDef { key: string; icon: string; label: string; features: FeatureDef[] }

// Learn/Challenge module keys mirror apps/mobile/app/(drawer)/(tabs)/
// learn.tsx and challenge.tsx's own MODULES arrays exactly — these keys
// double as appModules/{key} document ids.
const AIGURU_FEATURES: FeatureDef[] = [
  { key: "ask_aiguru",     icon: "🤖", label: "Ask AI Guru",     description: "Q&A chat with prompt chips" },
  { key: "notebook",       icon: "📓", label: "My AI Notebook",  description: "Saved AI conversations" },
  { key: "dashboard",      icon: "🧠", label: "AI Dashboard",    description: "Personal AI study dashboard" },
  { key: "skillguru",      icon: "🎯", label: "Ask AI SkillGuru", description: "AI skills coach voice/text chat" },
  { key: "photo_solve",    icon: "📸", label: "PhotoSolve AI",   description: "Snap a question photo → instant solution" },
  { key: "exam_simulator", icon: "🎯", label: "Exam Simulator",  description: "AI-generated board-pattern mock tests" },
  { key: "voice_tutor",    icon: "🎙️", label: "Voice Tutor",     description: "Speak doubt in regional language, get answer" },
  { key: "generate",       icon: "✨", label: "Generate Lesson", description: "Create AI-generated lessons" },
  { key: "my_lessons",     icon: "📚", label: "My Lessons",      description: "Saved and completed lessons" },
  { key: "revision_reels", icon: "🎬", label: "Revision Reels",  description: "Video revision reels", isPremium: true },
  { key: "practice_tests", icon: "📝", label: "Practice Tests",  description: "AI practice test generator", isPremium: true },
  { key: "discover",       icon: "🧭", label: "Discover AI",     description: "AI discovery and search" },
  { key: "subscription",   icon: "💎", label: "Subscription / Plans", description: "Show premium upgrade option" },
];

const LEARN_MODULES: ModuleDef[] = [
  { key: "ai-guru",      icon: "🤖", label: "AI Guru",       features: AIGURU_FEATURES },
  { key: "shikshahub",   icon: "🎓", label: "ShikshaHub",    features: [] },
  { key: "knowledgehub", icon: "🧠", label: "Knowledge Hub", features: [] },
  { key: "seekho",       icon: "📖", label: "Seekho",        features: [] },
  { key: "skillboost",   icon: "⚡", label: "SkillBoost",    features: [] },
  { key: "learnfun",     icon: "🎮", label: "Learn Fun",     features: [] },
];

const CHALLENGE_MODULES: ModuleDef[] = [
  { key: "vidyastar",   icon: "⭐", label: "VidyaStar",            features: [] },
  { key: "dsq",         icon: "🔥", label: "Daily Streak Quiz",    features: [] },
  { key: "skillbattle", icon: "🏆", label: "SkillBattle",          features: [] },
  { key: "leaderboard", icon: "🏅", label: "Leaderboard (V-Coins)", features: [] },
  { key: "starboard",   icon: "✨", label: "Starboard",            features: [] },
  { key: "skillboard",  icon: "⚔️", label: "SkillBoard",           features: [] },
];

// Home has no Module layer — its 17 sections sit directly under the Super
// Module (featureFlags/homeSection, same keys FeatureControl.tsx and
// apps/mobile/app/(drawer)/(tabs)/home.tsx's homeSection() calls use).
const HOME_SECTIONS: FeatureDef[] = [
  { key: "stories",           icon: "📖", label: "Stories",              description: "Horizontal story circles" },
  { key: "aiguru",            icon: "🤖", label: "AI Guru Banner",       description: "AI Guru promo card" },
  { key: "daily_streak_quiz", icon: "🔥", label: "Daily Streak Quiz Card", description: "Daily quiz streak promo card" },
  { key: "creator_reels",     icon: "🎬", label: "Short Reels",          description: "Admin-curated short reels" },
  { key: "referral",          icon: "🎁", label: "Referral Card",        description: "Refer & Earn card" },
  { key: "skillshorts",       icon: "⚡", label: "Skill Battle Reels",   description: "Student battle reels from approved posts" },
  { key: "skillbattle",       icon: "⚔️", label: "Skill Battle Preview", description: "Live skill battle cards section" },
  { key: "home_ads",          icon: "📢", label: "Home Ads Carousel",    description: "Banner ads carousel" },
  { key: "vidya_star",        icon: "⭐", label: "VidyaStar Preview",    description: "Top students leaderboard preview" },
  { key: "seekho_preview",    icon: "📚", label: "Seekho Preview",       description: "Course / chapter preview strip" },
  { key: "scholarship_ad",    icon: "🎓", label: "Scholarship Ad",       description: "Scholarship banner ad card" },
  { key: "discover_preview",  icon: "🧭", label: "Discover Preview",     description: "AI Discover section preview" },
  { key: "knowledge_hub",     icon: "🧠", label: "Knowledge Hub",        description: "Knowledge videos section" },
  { key: "learning",          icon: "🎥", label: "Short Learning Reels", description: "Learning reels injected between posts" },
  { key: "feed_posts",        icon: "📝", label: "Feed Posts",           description: "Student photo/video posts in feed" },
  { key: "feed_ads",          icon: "📣", label: "Feed Ads",             description: "Ads injected between feed posts" },
  { key: "glostore_preview",  icon: "🛍️", label: "GloStore Preview",     description: "Affiliate product flash cards" },
];

// Menu's drawer items, grouped to match the real Drawer's actual sections
// (apps/mobile/app/(drawer)/_layout.tsx) — see FeatureControl.tsx's
// DRAWER_ITEMS header comment for why these exact 11 keys, not the old list.
const DRAWER_GROUPS: { group: string; items: FeatureDef[] }[] = [
  { group: "Quick Access", items: [
    { key: "reels",    icon: "🎬", label: "Reels",     description: "Reels feed" },
    { key: "wallet",   icon: "💰", label: "Wallet",    description: "VCoins wallet" },
    { key: "myPrizes", icon: "🎁", label: "My Prizes", description: "Prize claims" },
  ]},
  { group: "Account", items: [
    { key: "myProfile",    icon: "👤", label: "My Profile",   description: "Profile settings" },
    { key: "subscription", icon: "🧾", label: "Subscription", description: "Billing history" },
    { key: "settings",     icon: "⚙️", label: "Settings",     description: "App settings" },
  ]},
  { group: "Support", items: [
    { key: "feedback", icon: "⭐", label: "Feedback",         description: "Feedback & ratings" },
    { key: "about",    icon: "ℹ️", label: "About Gloows365",  description: "About screen" },
    { key: "privacy",  icon: "🔒", label: "Privacy",          description: "Privacy policy" },
  ]},
  { group: "Other", items: [
    { key: "language", icon: "🌐", label: "Language", description: "Language selector" },
    { key: "glostore",  icon: "🛍️", label: "GloStore",  description: "Affiliate product store" },
  ]},
];

type SuperModuleId = "home" | "dashboard" | "learn" | "challenge" | "menu";
const SUPER_MODULES: { id: SuperModuleId; icon: string; label: string }[] = [
  { id: "home",      icon: "🏠", label: "Home" },
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "learn",     icon: "📚", label: "Learn" },
  { id: "challenge", icon: "🎯", label: "Challenge" },
  { id: "menu",      icon: "☰",  label: "Menu" },
];

interface AppModuleDoc { isEnabled: boolean; isComingSoon?: boolean; }

export default function AppStructure() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canManage = isAdmin || isSuperAdmin;

  const [loading, setLoading]         = useState(true);
  const [appModules, setAppModules]   = useState<Record<string, AppModuleDoc>>({});
  const [homeFlags, setHomeFlags]     = useState<Record<string, boolean>>({});
  const [aiFlags, setAiFlags]         = useState<Record<string, boolean>>({});
  const [drawerFlags, setDrawerFlags] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [search, setSearch]           = useState("");

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "appModules")),
      getDoc(doc(db, "featureFlags", "homeSection")),
      getDoc(doc(db, "featureFlags", "aiGuru")),
      getDoc(doc(db, "featureFlags", "drawerItems")),
    ]).then(([modulesSnap, homeSnap, aiSnap, drawerSnap]) => {
      const modules: Record<string, AppModuleDoc> = {};
      modulesSnap.docs.forEach((d) => { modules[d.id] = d.data() as AppModuleDoc; });
      setAppModules(modules);
      if (homeSnap.exists())   setHomeFlags(homeSnap.data() as Record<string, boolean>);
      if (aiSnap.exists())     setAiFlags(aiSnap.data() as Record<string, boolean>);
      if (drawerSnap.exists()) setDrawerFlags(drawerSnap.data() as Record<string, boolean>);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // isEnabled defaults to true when no doc/key exists yet — matches every
  // real consumer's own default (never hide something Admin hasn't
  // explicitly configured).
  const isModuleEnabled = (id: string) => appModules[id]?.isEnabled !== false;
  const isFlagEnabled   = (flags: Record<string, boolean>, key: string) => flags[key] ?? true;

  const toggleModule = async (id: string, label: string) => {
    if (!canManage) return;
    const next = !isModuleEnabled(id);
    setAppModules((prev) => ({ ...prev, [id]: { ...prev[id], isEnabled: next } }));
    // merge:true — creates the doc on first-ever toggle if Admin never
    // configured this module before (see header comment); never
    // overwrites isComingSoon or any other existing field.
    await setDoc(doc(db, "appModules", id), { name: label, isEnabled: next }, { merge: true });
  };

  const toggleFlag = async (
    docName: "homeSection" | "aiGuru" | "drawerItems",
    flags: Record<string, boolean>,
    setFlags: (f: Record<string, boolean>) => void,
    key: string
  ) => {
    if (!canManage) return;
    const next = !isFlagEnabled(flags, key);
    setFlags({ ...flags, [key]: next });
    await setDoc(doc(db, "featureFlags", docName), { [key]: next }, { merge: true });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Search — auto-expands any Super Module/Module containing a match ──
  const q = search.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);

  const learnModuleMatches = (m: ModuleDef) => matches(m.label) || m.features.some((f) => matches(f.label));
  const challengeModuleMatches = (m: ModuleDef) => matches(m.label);

  const superModuleCounts = useMemo(() => {
    const learnFeatureCount = LEARN_MODULES.reduce((n, m) => n + m.features.length, 0);
    return {
      home:      { modules: 0, features: HOME_SECTIONS.length },
      dashboard: { modules: 0, features: 0 },
      learn:     { modules: LEARN_MODULES.length, features: learnFeatureCount },
      challenge: { modules: CHALLENGE_MODULES.length, features: 0 },
      menu:      { modules: 0, features: DRAWER_GROUPS.reduce((n, g) => n + g.items.length, 0) },
    };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-32 text-slate-400">Loading app structure…</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">📐 App Structure & Feature Control</h1>
          <p className="text-slate-400 text-sm mt-1">
            Super Module → Module → Feature — the app's actual navigation hierarchy, in one place.
          </p>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search Super Modules, Modules, or Features…"
        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
      />

      <div className="space-y-4">
        {SUPER_MODULES.map((sm) => {
          const counts = superModuleCounts[sm.id];
          const isOpen = expanded.has(sm.id) || !!q;
          return (
            <div key={sm.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleExpanded(sm.id)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{sm.icon}</span>
                  <div>
                    <p className="text-white font-black">{sm.label}</p>
                    <p className="text-slate-500 text-xs">
                      {counts.modules > 0 ? `${counts.modules} modules · ` : ""}{counts.features} features
                    </p>
                  </div>
                </div>
                <span className="text-slate-500 text-lg">{isOpen ? "▾" : "▸"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-800 p-4 space-y-3">
                  {sm.id === "home" && (
                    <FeatureGrid
                      items={HOME_SECTIONS.filter((f) => matches(f.label))}
                      flags={homeFlags}
                      canManage={canManage}
                      onToggle={(key) => toggleFlag("homeSection", homeFlags, setHomeFlags, key)}
                    />
                  )}

                  {sm.id === "dashboard" && (
                    <p className="text-slate-500 text-sm py-4 text-center">
                      No configurable modules or features exist for Dashboard yet — it's a single, self-contained screen.
                    </p>
                  )}

                  {sm.id === "learn" && (
                    <div className="space-y-2">
                      {LEARN_MODULES.filter(learnModuleMatches).map((m) => (
                        <ModuleRow
                          key={m.key}
                          mod={m}
                          enabled={isModuleEnabled(m.key)}
                          canManage={canManage}
                          onToggleModule={() => toggleModule(m.key, m.label)}
                          expanded={expanded.has(`learn:${m.key}`) || !!q}
                          onExpand={() => toggleExpanded(`learn:${m.key}`)}
                          featureFlags={aiFlags}
                          onToggleFeature={(key) => toggleFlag("aiGuru", aiFlags, setAiFlags, key)}
                          featureFilter={matches}
                        />
                      ))}
                    </div>
                  )}

                  {sm.id === "challenge" && (
                    <div className="space-y-2">
                      {CHALLENGE_MODULES.filter(challengeModuleMatches).map((m) => (
                        <ModuleRow
                          key={m.key}
                          mod={m}
                          enabled={isModuleEnabled(m.key)}
                          canManage={canManage}
                          onToggleModule={() => toggleModule(m.key, m.label)}
                          expanded={false}
                          onExpand={() => {}}
                          featureFlags={{}}
                          onToggleFeature={() => {}}
                          featureFilter={matches}
                        />
                      ))}
                    </div>
                  )}

                  {sm.id === "menu" && (
                    <div className="space-y-5">
                      {DRAWER_GROUPS.map((g) => {
                        const filtered = g.items.filter((f) => matches(f.label));
                        if (q && filtered.length === 0) return null;
                        return (
                          <div key={g.group}>
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2">{g.group}</p>
                            <FeatureGrid
                              items={filtered}
                              flags={drawerFlags}
                              canManage={canManage}
                              onToggle={(key) => toggleFlag("drawerItems", drawerFlags, setDrawerFlags, key)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!canManage && (
        <p className="text-slate-500 text-xs text-center">Admin access required to change these settings — showing current state only.</p>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function FeatureGrid({ items, flags, canManage, onToggle }: {
  items: FeatureDef[];
  flags: Record<string, boolean>;
  canManage: boolean;
  onToggle: (key: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-slate-500 text-sm py-2 text-center">No matching features.</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {items.map((f) => (
        <div key={f.key} className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0">{f.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-semibold truncate">{f.label}</p>
                {f.isPremium && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded shrink-0">PREMIUM</span>
                )}
              </div>
              <p className="text-slate-500 text-xs truncate">{f.description}</p>
            </div>
          </div>
          <ToggleSwitch value={flags[f.key] ?? true} onChange={() => onToggle(f.key)} disabled={!canManage} />
        </div>
      ))}
    </div>
  );
}

function ModuleRow({
  mod, enabled, canManage, onToggleModule, expanded, onExpand, featureFlags, onToggleFeature, featureFilter,
}: {
  mod: ModuleDef;
  enabled: boolean;
  canManage: boolean;
  onToggleModule: () => void;
  expanded: boolean;
  onExpand: () => void;
  featureFlags: Record<string, boolean>;
  onToggleFeature: (key: string) => void;
  featureFilter: (label: string) => boolean;
}) {
  const hasFeatures = mod.features.length > 0;
  return (
    <div className={`rounded-xl border transition-all ${enabled ? "bg-slate-950 border-slate-800" : "bg-slate-950/50 border-slate-800/60 opacity-60"}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={hasFeatures ? onExpand : undefined}
          disabled={!hasFeatures}
          className={`flex items-center gap-3 min-w-0 text-left ${hasFeatures ? "cursor-pointer" : "cursor-default"}`}
        >
          <span className="text-xl shrink-0">{mod.icon}</span>
          <div className="min-w-0">
            <p className="text-white text-sm font-bold">{mod.label}</p>
            <p className="text-slate-500 text-xs">{hasFeatures ? `${mod.features.length} features` : "0 features"}</p>
          </div>
          {hasFeatures && <span className="text-slate-500 text-sm ml-1">{expanded ? "▾" : "▸"}</span>}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${enabled ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 bg-slate-800"}`}>
            {enabled ? "● ENABLED" : "○ DISABLED"}
          </span>
          <ToggleSwitch value={enabled} onChange={onToggleModule} disabled={!canManage} />
        </div>
      </div>
      {hasFeatures && expanded && (
        <div className="border-t border-slate-800 p-3">
          <FeatureGrid
            items={mod.features.filter((f) => featureFilter(f.label))}
            flags={featureFlags}
            canManage={canManage}
            onToggle={onToggleFeature}
          />
        </div>
      )}
    </div>
  );
}
