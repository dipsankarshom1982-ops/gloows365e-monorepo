// PATH: apps/admin/src/lib/navigation.ts
//
// Moderator Authorization audit, Phase 4 — extracted from
// components/Layout.tsx, which previously defined this array inline.
// Pulled out into its own dependency-free data module (no React, no
// react-router, no Firebase) specifically so it can be the single shared
// source both Layout.tsx (sidebar visibility) and lib/routePermissions.ts
// (route-guard access control) import from, without routePermissions.ts —
// a plain, pure-function module used by a security check — needing to
// pull in Layout.tsx's own component-level dependencies (framer-motion,
// react-router-dom, and transitively AuthContext -> lib/firebase, which
// eagerly initializes the real Firebase SDK at import time). That
// transitive weight is exactly what made this data hard to unit-test in
// isolation before this extraction; see
// lib/__tests__/routePermissions.test.ts's header for the full story.
//
// No behavior changes here — this is the exact same data Layout.tsx
// already had, moved verbatim.

export interface NavItem {
  path: string;
  label: string;
  permKey: string;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { section: "OVERVIEW", items: [
    { path: "/",                   label: "📊 Dashboard",          permKey: "dashboard" },
    { path: "/platform-analytics",      label: "📈 Platform Analytics",    permKey: "platform-analytics"      },
    { path: "/user-activity-analytics", label: "🎯 Activity & Retention",  permKey: "user-activity-analytics" },
    { path: "/crash-reports",      label: "🐛 Crash Reports",      permKey: "dashboard" },
  ]},
  { section: "ADS", items: [
    { path: "/ads",                   label: "📢 All Ads",              permKey: "ads" },
    { path: "/ads/new",               label: "➕ Create Ad",            permKey: "ads" },
    { path: "/analytics",             label: "📊 Ad Analytics",         permKey: "analytics" },
    { path: "/affiliate-products",    label: "🛒 Affiliate Products",   permKey: "ads" },
  ]},
  { section: "CONTENT", items: [
    { path: "/banners",          label: "🎯 Banners",          permKey: "banners" },
    { path: "/short-reels",      label: "🎬 Short Reels",      permKey: "short-reels" },
    { path: "/seekho-videos",    label: "📺 Seekho Videos",    permKey: "seekho-videos" },
    { path: "/knowledge-videos", label: "🧠 Knowledge Videos", permKey: "knowledge-videos" },
    { path: "/stories",          label: "📖 Stories",          permKey: "stories" },
    { path: "/partners",         label: "🤝 Partners",         permKey: "partners" },
  ]},
  { section: "CURRICULUM", items: [
    { path: "/courses",  label: "📚 Courses",       permKey: "courses" },
    { path: "/practice", label: "✍️ Practice Sets", permKey: "practice" },
  ]},
  { section: "GAMIFICATION", items: [
    { path: "/contests",         label: "🏁 Contests",         permKey: "contests" },
    { path: "/vidyastar-config", label: "⭐ VidyaStar Config", permKey: "contests" },
    { path: "/starboard-payouts",label: "🏆 Starboard Payouts",permKey: "contests" },
    { path: "/prize-deliveries", label: "📦 Prize Deliveries", permKey: "prize-deliveries" },
    { path: "/quizzes",          label: "🧩 Quizzes",          permKey: "quizzes" },
    { path: "/daily-streak-quiz",label: "🔥 Daily Streak Quiz",permKey: "daily-streak-quiz" },
    { path: "/skill-battles",    label: "⚔️ Skill Battles",    permKey: "skill-battles" },
    { path: "/learnfun",         label: "🎮 LearnFun",         permKey: "learnfun" },
    { path: "/badges",           label: "🏆 Badges & Stars",   permKey: "badges" },
  ]},
  { section: "GLOOWS TUTOR", items: [
    { path: "/tutor-verifications", label: "🎓 Tutor Verifications", permKey: "tutor-verifications" },
    { path: "/tutor-payouts",       label: "💸 Tutor Payouts",       permKey: "tutor-payouts" },
    { path: "/tutor-reviews",       label: "⭐ Tutor Reviews",       permKey: "tutor-reviews" },
    { path: "/payout-settings",     label: "⚙️ Payout Settings",     permKey: "payout-settings" },
    { path: "/shikshahub-analytics", label: "📊 ShikshaHub Analytics", permKey: "shikshahub-analytics" },
  ]},
  { section: "FEEDBACK", items: [
    { path: "/feedback",          label: "💬 Feedback",           permKey: "feedback" },
    { path: "/feedback-features", label: "⭐ Feedback Features",  permKey: "feedback-features" },
  ]},
  { section: "APP CONFIG", items: [
    { path: "/feature-control",    label: "🎛️ Feature Control",   permKey: "modules" },
    { path: "/referrals",          label: "🎁 Referrals",          permKey: "modules" },
    { path: "/modules",            label: "🧩 App Modules",        permKey: "modules" },
    { path: "/subscription-plans", label: "💎 Plans",              permKey: "subscription-plans" },
    { path: "/ai-guru-credits",    label: "🎫 AI Guru Credits",    permKey: "subscription-plans" },
    { path: "/coupons",            label: "🎟️ Coupons",            permKey: "coupons" },
    { path: "/vcoin-rules",        label: "🪙 V-Coin Rules",       permKey: "vcoin-rules" },
    { path: "/vcoin-leaderboard",  label: "🏆 V-Coin Leaderboard", permKey: "vcoin-rules" },
  ]},
  { section: "USERS", items: [
    { path: "/students",       label: "👥 Students",          permKey: "students" },
    { path: "/subscriptions",  label: "💰 Subscriptions",     permKey: "subscriptions" },
    { path: "/refunds",        label: "💳 Refunds",           permKey: "refunds" },
    { path: "/payments",       label: "💰 Payment Management", permKey: "payments" },
    { path: "/ai-usage",       label: "🤖 AI Usage",          permKey: "ai-usage" },
    { path: "/restart-leads",  label: "🎓 Restart Ed. Leads", permKey: "students" },
    { path: "/waitlist",       label: "📋 Waitlist",          permKey: "students" },
  ]},
  { section: "COMPLIANCE", items: [
    { path: "/data-rights", label: "🔐 Data Rights",  permKey: "data-rights" },
    { path: "/grievances",  label: "📮 Grievances",   permKey: "grievances" },
  ]},
  { section: "ADMIN", items: [
    { path: "/admins", label: "👑 Admins", permKey: "admins" },
  ]},
];
