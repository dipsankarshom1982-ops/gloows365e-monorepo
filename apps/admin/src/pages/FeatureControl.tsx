// PATH: admin-web/src/pages/FeatureControl.tsx

import { doc, getDoc, setDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import ToggleSwitch from "../components/ToggleSwitch";
import { db } from "../lib/firebase";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Section  { key: string; icon: string; label: string; description: string; locked?: boolean; }
interface AiFeature{ key: string; icon: string; label: string; description: string; isPremium?: boolean; }

// ─── Home page sections ────────────────────────────────────────────────────────
const HOME_SECTIONS: Section[] = [
  { key: "stories",          icon: "📖", label: "Stories ✅ LAUNCH",        description: "Horizontal story circles — LIVE DAY 1" },
  { key: "aiguru",           icon: "🤖", label: "AI Guru Banner ✅ LAUNCH",  description: "AI Guru promo card — LIVE DAY 1" },
  { key: "creator_reels",    icon: "🎬", label: "Short Reels ✅ LAUNCH",     description: "Admin-curated short reels — LIVE DAY 1" },
  { key: "referral",         icon: "🎁", label: "Referral Card ✅ LAUNCH",   description: "Refer & Earn card — LIVE DAY 1" },
  { key: "skillshorts",      icon: "⚡", label: "Skill Battle Reels",        description: "Student battle reels from approved posts" },
  { key: "skillbattle",      icon: "⚔️", label: "Skill Battle Preview",      description: "Live skill battle cards section" },
  { key: "home_ads",         icon: "📢", label: "Home Ads Carousel",         description: "Banner ads carousel" },
  { key: "vidya_star",       icon: "⭐", label: "VidyaStar Preview",         description: "Top students leaderboard preview" },
  { key: "seekho_preview",   icon: "📚", label: "Seekho Preview",            description: "Course / chapter preview strip" },
  { key: "scholarship_ad",   icon: "🎓", label: "Scholarship Ad",            description: "Scholarship banner ad card" },
  { key: "discover_preview", icon: "🧭", label: "Discover Preview",          description: "AI Discover section preview" },
  { key: "knowledge_hub",    icon: "🧠", label: "Knowledge Hub",             description: "Knowledge videos section" },
  { key: "learning",         icon: "🎥", label: "Short Learning Reels",      description: "Learning reels injected between posts" },
  { key: "feed_posts",       icon: "📝", label: "Feed Posts",                description: "Student photo/video posts in feed" },
  { key: "feed_ads",         icon: "📣", label: "Feed Ads",                  description: "Ads injected between feed posts" },
];

// ─── AI Guru features ──────────────────────────────────────────────────────────
// ─── 🚀 LAUNCH FEATURES — these 6 go live on day 1 ───────────────────────────
const LAUNCH_HOME_KEYS   = ["stories", "aiguru", "creator_reels", "referral"];
const LAUNCH_AI_KEYS     = ["ask_aiguru", "notebook"];
const LAUNCH_DRAWER_KEYS = ["home", "wallet", "leaderboard", "language", "settings"];

const AIGURU_FEATURES: AiFeature[] = [
  // ── Launch day features ──
  { key: "ask_aiguru",     icon: "🤖",  label: "Ask AI Guru ✅ LAUNCH",   description: "Q&A chat with prompt chips — LIVE DAY 1" },
  { key: "notebook",       icon: "📓",  label: "My AI Notebook ✅ LAUNCH", description: "Saved AI conversations — LIVE DAY 1" },
  // ── Post-launch features ──
  { key: "dashboard",      icon: "🧠",  label: "AI Dashboard",             description: "Personal AI study dashboard" },
  { key: "vidyaguru",      icon: "🧑‍🏫", label: "VidyaGuru Chat",           description: "AI tutor voice/text chat" },
  { key: "photo_solve",    icon: "📸",  label: "PhotoSolve AI",             description: "Snap a question photo → instant solution" },
  { key: "exam_simulator", icon: "🎯",  label: "Exam Simulator",            description: "AI-generated board-pattern mock tests" },
  { key: "voice_tutor",    icon: "🎙️",  label: "Voice Tutor",               description: "Speak doubt in regional language, get answer" },
  { key: "generate",       icon: "✨",  label: "Generate Lesson",           description: "Create AI-generated lessons" },
  { key: "my_lessons",     icon: "📚",  label: "My Lessons",                description: "Saved and completed lessons" },
  { key: "revision_reels", icon: "🎬",  label: "Revision Reels",            description: "Video revision reels", isPremium: true },
  { key: "practice_tests", icon: "📝",  label: "Practice Tests",            description: "AI practice test generator", isPremium: true },
  { key: "discover",       icon: "🧭",  label: "Discover AI",               description: "AI discovery and search" },
  { key: "subscription",   icon: "💎",  label: "Subscription / Plans",      description: "Show premium upgrade option" },
];

// ─── Drawer menu items ─────────────────────────────────────────────────────────
const DRAWER_ITEMS: Section[] = [
  { key: "home",        icon: "🏠", label: "Home",         description: "Home tab link",                  locked: true },
  { key: "leaderboard", icon: "🏆", label: "Leaderboard",  description: "Pan India leaderboard" },
  { key: "wallet",      icon: "💰", label: "Wallet",       description: "VCoins wallet" },
  { key: "settings",    icon: "⚙️", label: "Settings",     description: "App settings" },
  { key: "dashboard",   icon: "📊", label: "Dashboard",    description: "Student dashboard" },
  { key: "aiguru",      icon: "🤖", label: "AI Guru",      description: "AI Guru main screen" },
  { key: "learnfun",    icon: "📖", label: "LearnFun",     description: "LearnFun gamification screen" },
  { key: "language",    icon: "🌐", label: "Language",     description: "Language selector" },
  { key: "skillboard",  icon: "⚔️", label: "Skill Board",  description: "Skill battle leaderboard" },
];

// ─── Defaults ──────────────────────────────────────────────────────────────────
const defaultHomeFlags   = Object.fromEntries(HOME_SECTIONS.map((s)   => [s.key, true]));
const defaultAiFlags     = Object.fromEntries(AIGURU_FEATURES.map((f) => [f.key, true]));
const defaultDrawerFlags = Object.fromEntries(DRAWER_ITEMS.map((d)    => [d.key, true]));

// ─── Reusable section card ─────────────────────────────────────────────────────
function SectionCard({ item, enabled, onToggle }: {
  item: Section | AiFeature;
  enabled: boolean;
  onToggle: () => void;
}) {
  const locked = (item as Section).locked;
  return (
    <div className={`rounded-xl border p-4 transition-all ${
      enabled ? "bg-slate-900 border-slate-700" : "bg-slate-950 border-slate-800 opacity-60"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{item.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className={`font-bold text-sm ${enabled ? "text-white" : "text-slate-500"}`}>
                {item.label}
              </p>
              {locked && (
                <span className="text-[10px] bg-slate-700 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                  ALWAYS ON
                </span>
              )}
              {"isPremium" in item && item.isPremium && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">
                  PREMIUM
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs">{item.description}</p>
          </div>
        </div>
        <ToggleSwitch value={enabled} onChange={locked ? () => {} : onToggle} />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function FeatureControl() {
  const [homeFlags,   setHomeFlags]   = useState<Record<string, boolean>>(defaultHomeFlags);
  const [aiFlags,     setAiFlags]     = useState<Record<string, boolean>>(defaultAiFlags);
  const [drawerFlags, setDrawerFlags] = useState<Record<string, boolean>>(defaultDrawerFlags);
  const [loading, setSaving_l] = useState(true);
  const [saving,  setSaving]   = useState(false);
  const [saved,   setSaved]    = useState(false);

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, "featureFlags", "homeSection")),
      getDoc(doc(db, "featureFlags", "aiGuru")),
      getDoc(doc(db, "featureFlags", "drawerItems")),
    ]).then(([homeSnap, aiSnap, drawerSnap]) => {
      if (homeSnap.exists())   setHomeFlags({   ...defaultHomeFlags,   ...homeSnap.data()   });
      if (aiSnap.exists())     setAiFlags({     ...defaultAiFlags,     ...aiSnap.data()     });
      if (drawerSnap.exists()) setDrawerFlags({ ...defaultDrawerFlags, ...drawerSnap.data() });
      setSaving_l(false);
    }).catch(() => setSaving_l(false));
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await Promise.all([
        setDoc(doc(db, "featureFlags", "homeSection"), homeFlags),
        setDoc(doc(db, "featureFlags", "aiGuru"),      aiFlags),
        setDoc(doc(db, "featureFlags", "drawerItems"), drawerFlags),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert("Save failed: " + (err?.message ?? "Check Firestore rules are deployed."));
    } finally {
      setSaving(false);
    }
  };

  const homeEnabledCount   = HOME_SECTIONS.filter((s) => homeFlags[s.key]).length;
  const aiEnabledCount     = AIGURU_FEATURES.filter((f) => aiFlags[f.key]).length;
  const drawerEnabledCount = DRAWER_ITEMS.filter((d) => drawerFlags[d.key]).length;

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-slate-400">Loading feature flags…</div>
  );

  const SaveBtn = ({ className = "" }) => (
    <button onClick={save} disabled={saving}
      className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
        saved ? "bg-green-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
      } ${className}`}>
      {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Changes"}
    </button>
  );

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">🎛️ Feature Control</h1>
          <p className="text-slate-400 text-sm mt-1">
            Toggle home sections, drawer items, and AI Guru features on/off in real-time.
          </p>
        </div>
        <SaveBtn />
      </div>

      {/* ── 🚀 Launch Features ──────────────────────────────────────────────── */}
      <section className="border border-emerald-500/40 rounded-2xl p-5 bg-emerald-950/20">
        <div className="flex items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-black text-emerald-400">🚀 Launch Day Features</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              These 6 features go live on Day 1. Everything else can be toggled post-launch.
            </p>
          </div>
          <button
            onClick={() => {
              const newHome = { ...homeFlags };
              LAUNCH_HOME_KEYS.forEach((k) => (newHome[k] = true));
              setHomeFlags(newHome);
              const newAi = { ...aiFlags };
              LAUNCH_AI_KEYS.forEach((k) => (newAi[k] = true));
              setAiFlags(newAi);
              const newDrawer = { ...drawerFlags };
              LAUNCH_DRAWER_KEYS.forEach((k) => (newDrawer[k] = true));
              setDrawerFlags(newDrawer);
            }}
            className="ml-auto text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors"
          >
            ✅ Enable All Launch Features
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "📖 Stories",        key: "stories",      flags: homeFlags,   setter: setHomeFlags   },
            { label: "🤖 AI Guru Banner",  key: "aiguru",       flags: homeFlags,   setter: setHomeFlags   },
            { label: "🎬 Short Reels",     key: "creator_reels",flags: homeFlags,   setter: setHomeFlags   },
            { label: "🎁 Referral Card",   key: "referral",     flags: homeFlags,   setter: setHomeFlags   },
            { label: "🤖 Ask AI Guru",     key: "ask_aiguru",   flags: aiFlags,     setter: setAiFlags     },
            { label: "📓 AI Notebook",     key: "notebook",     flags: aiFlags,     setter: setAiFlags     },
          ].map((f) => (
            <div key={f.key} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${f.flags[f.key] ? "border-emerald-500/50 bg-emerald-900/20" : "border-slate-700 bg-slate-800/40"}`}>
              <span className="text-sm font-bold text-white">{f.label}</span>
              <ToggleSwitch
                enabled={f.flags[f.key] ?? true}
                onToggle={() => f.setter((prev: Record<string,boolean>) => ({ ...prev, [f.key]: !prev[f.key] }))}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Drawer Items ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-black text-white">☰ Drawer Menu Items</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {drawerEnabledCount} of {DRAWER_ITEMS.length} items enabled
            </p>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setDrawerFlags(Object.fromEntries(DRAWER_ITEMS.map((d) => [d.key, true])))}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
              Enable All
            </button>
            <button onClick={() => setDrawerFlags(Object.fromEntries(DRAWER_ITEMS.map((d) => [d.key, d.locked ? true : false])))}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
              Disable All
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {DRAWER_ITEMS.map((item, i) => (
            <motion.div key={item.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <SectionCard
                item={item}
                enabled={drawerFlags[item.key] ?? true}
                onToggle={() => setDrawerFlags((p) => ({ ...p, [item.key]: !p[item.key] }))}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Home Page Sections ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-black text-white">🏠 Home Page Sections</h2>
            <p className="text-slate-500 text-xs mt-0.5">{homeEnabledCount} of {HOME_SECTIONS.length} sections enabled</p>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setHomeFlags(Object.fromEntries(HOME_SECTIONS.map((s) => [s.key, true])))}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">Enable All</button>
            <button onClick={() => setHomeFlags(Object.fromEntries(HOME_SECTIONS.map((s) => [s.key, false])))}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">Disable All</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {HOME_SECTIONS.map((section, i) => (
            <motion.div key={section.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <SectionCard
                item={section}
                enabled={homeFlags[section.key] ?? true}
                onToggle={() => setHomeFlags((p) => ({ ...p, [section.key]: !p[section.key] }))}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── AI Guru Features ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-black text-white">🤖 AI Guru Features</h2>
            <p className="text-slate-500 text-xs mt-0.5">{aiEnabledCount} of {AIGURU_FEATURES.length} features enabled</p>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setAiFlags(Object.fromEntries(AIGURU_FEATURES.map((f) => [f.key, true])))}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">Enable All</button>
            <button onClick={() => setAiFlags(Object.fromEntries(AIGURU_FEATURES.map((f) => [f.key, false])))}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">Disable All</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {AIGURU_FEATURES.map((feature, i) => (
            <motion.div key={feature.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <SectionCard
                item={feature}
                enabled={aiFlags[feature.key] ?? true}
                onToggle={() => setAiFlags((p) => ({ ...p, [feature.key]: !p[feature.key] }))}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Sticky bottom save bar */}
      <div className="sticky bottom-0 bg-slate-950/90 backdrop-blur border-t border-slate-800 -mx-8 px-8 py-4 flex items-center justify-between">
        <p className="text-slate-400 text-sm">
          {drawerEnabledCount} drawer items · {homeEnabledCount} home sections · {aiEnabledCount} AI features
        </p>
        <SaveBtn />
      </div>

    </div>
  );
}
