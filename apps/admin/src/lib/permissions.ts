export interface PermissionModule {
  key: string;
  label: string;
  section: string;
}

export const ALL_PERMISSIONS: PermissionModule[] = [
  { key: "dashboard",           label: "📊 Dashboard",           section: "Overview"      },
  { key: "platform-analytics",      label: "📈 Platform Analytics",   section: "Overview" },
  { key: "user-activity-analytics", label: "🎯 Activity & Retention", section: "Overview" },
  { key: "ads",                 label: "📢 Ads",                 section: "Ads"           },
  { key: "analytics",           label: "📊 Ad Analytics",        section: "Ads"           },
  { key: "banners",             label: "🎯 Banners",             section: "Content"       },
  { key: "short-reels",         label: "🎬 Short Reels",         section: "Content"       }, // 🆕
  { key: "seekho-videos",       label: "📺 Seekho Videos",       section: "Content"       },
  { key: "knowledge-videos",    label: "🧠 Knowledge Videos",    section: "Content"       },
  { key: "stories",             label: "📖 Stories",             section: "Content"       },
  { key: "partners",            label: "🤝 Partners",            section: "Content"       },
  { key: "courses",             label: "📚 Courses",             section: "Curriculum"    },
  { key: "practice",            label: "✍️ Practice Sets",       section: "Curriculum"    },
  { key: "contests",            label: "🏁 Contests",            section: "Gamification"  },
  { key: "prize-deliveries",    label: "📦 Prize Deliveries",    section: "Gamification"  },
  { key: "quizzes",             label: "🧩 Quizzes",             section: "Gamification"  },
  { key: "daily-streak-quiz",   label: "🔥 Daily Streak Quiz",   section: "Gamification"  },
  { key: "skill-battles",       label: "⚔️ Skill Battles",       section: "Gamification"  },
  { key: "learnfun",            label: "🎮 LearnFun",            section: "Gamification"  },
  { key: "badges",              label: "🏆 Badges & Stars",      section: "Gamification"  },
  { key: "modules",             label: "🧩 App Modules",         section: "App Config"    },
  { key: "subscription-plans",  label: "💎 Plans",               section: "App Config"    },
  { key: "coupons",             label: "🎟️ Coupons",             section: "App Config"    },
  { key: "vcoin-rules",         label: "🪙 V-Coin Rules",        section: "App Config"    },
  { key: "feedback-features",   label: "⭐ Feedback Features",   section: "Feedback"      },
  { key: "feedback",            label: "💬 Feedback",            section: "Feedback"      },
  { key: "students",            label: "👥 Students",            section: "Users"         },
  { key: "subscriptions",       label: "💰 Subscriptions",       section: "Users"         },
  { key: "refunds",             label: "💳 Refunds",             section: "Users"         },
  { key: "payments",            label: "💰 Payment Management",  section: "Users"         },
  { key: "ai-usage",            label: "🤖 AI Usage",            section: "Users"         },
  { key: "data-rights",         label: "🔐 Data Rights",         section: "Compliance"    },
  { key: "grievances",          label: "📮 Grievances",          section: "Compliance"    },
  { key: "tutor-verifications", label: "🎓 Tutor Verifications", section: "Gloows Tutor"  },
  { key: "tutor-payouts",       label: "💸 Tutor Payouts",       section: "Gloows Tutor"  },
  { key: "tutor-reviews",       label: "⭐ Tutor Reviews",       section: "Gloows Tutor"  },
  { key: "payout-settings",     label: "⚙️ Payout Settings",     section: "Gloows Tutor"  },
  { key: "shikshahub-analytics", label: "📊 ShikshaHub Analytics", section: "Gloows Tutor"  },
];

export const PERMISSION_SECTIONS = Array.from(
  new Set(ALL_PERMISSIONS.map((p) => p.section))
).map((section) => ({
  section,
  items: ALL_PERMISSIONS.filter((p) => p.section === section),
}));

export function hasPermission(
  isSuperAdmin: boolean,
  permissions: string[],
  key: string
): boolean {
  if (isSuperAdmin) return true;
  // Real-money-reversal action — same superAdmin-only treatment as
  // "admins" (role/claim management). This is UI nav visibility only, not
  // a real security boundary — see Admins.tsx's Task 6 comment on the
  // wider gap this doesn't close (a moderator with "refunds" excluded
  // from their permissions array can still call processRefund directly if
  // they somehow had the admin claim — the Cloud Function itself is
  // gated on the admin claim, matching every other real-money admin
  // action in this codebase, not on this permission key).
  //
  // "payments" is different: searchPaymentOrders/getPaymentDetail (backing
  // Payment Management) check request.auth.token.superAdmin specifically,
  // not just the admin claim — so unlike "refunds" above, this key's
  // superAdmin-only treatment IS backed by a real, unbypassable backend
  // boundary, not just nav visibility. Kept in this same hardcoded list
  // for UI consistency with "refunds"/"admins", not because it needs to be.
  if (key === "admins" || key === "refunds" || key === "payments") return false;
  return permissions.includes(key) || permissions.includes("all");
}
