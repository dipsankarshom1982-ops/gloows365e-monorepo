"use client";

// PATH: apps/web/src/components/layout/Drawer.tsx
// Exact mirror of mobile app/(drawer)/_layout.tsx drawerContent()
//
// ✅ Profile card: avatar · name · school · class · language · district+state
// ✅ Stats row: VCoins (🪙) · XP (⚡) · Level (🎮) with dividers
// ✅ XP progress bar with label row
// ✅ VCoins annual rank banner (🏆 + rank + View → /wallet)
// ✅ Surprise gift banner
// ✅ Menu: home · wallet · starboard · settings · dashboard · AI Guru
//         learnfun · skillboost · language · skillboard gradient btn
//         (wallet RESTORED to nav — see FIX comment below; still also
//         reachable via the rank banner's "View" button)
// ✅ Active item: accent bg + accent icon/text
// ✅ Logout pinned at bottom

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";
import {
  getFirestore, doc, onSnapshot,
  collection, query, where, getCountFromServer,
} from "firebase/firestore";
import { useStudentProfile, useFeatureFlags } from "@gloows/shared-logic";
import { useAppTranslation } from "@/context/LanguageContext";
import { defaultAvatarForTitle } from "@/lib/avatars";

const XP_PER_LEVEL = 500;
function getLevelFromXP(xp: number) { return Math.floor(xp / XP_PER_LEVEL) + 1; }

const INDIAN_LANGUAGES: Record<string, string> = {
  English: "English", Hindi: "हिन्दी", Bengali: "বাংলা",
  Tamil: "தமிழ்", Telugu: "తెలుగు", Kannada: "ಕನ್ನಡ",
  Malayalam: "മലയാളം", Marathi: "मराठी", Gujarati: "ગુજરાતી",
  Punjabi: "ਪੰਜਾਬੀ", Odia: "ଓଡ଼ିଆ", Urdu: "اردو",
  Assamese: "অসমীয়া", Manipuri: "মণিপুরী",
};

interface Props { open: boolean; onClose: () => void; }

// ─── SVG icons ────────────────────────────────────────────────
function Icon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const s = size;
  const icons: Record<string, JSX.Element> = {
    "home": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M80 212v236a16 16 0 0016 16h133v-160h54v160h133a16 16 0 0016-16V212" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M480 256L266.89 52c-5-5.28-16.69-5.34-21.78 0L16 256" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M400 179.56V64h-48v71.6" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "trophy-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M176 464h160M256 464V336M384 96h36a36 36 0 0135 43.41L432 240a64 64 0 01-62.9 52H384" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M128 96H92a36 36 0 00-35 43.41L80 240a64 64 0 0062.9 52H128" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M256 336c-79.4 0-144-64.6-144-144V88a24 24 0 0124-24h240a24 24 0 0124 24v104c0 79.4-64.6 144-144 144z" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
      </svg>
    ),
    "settings-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M262.29 192.31a64 64 0 1057.4 57.4 64.13 64.13 0 00-57.4-57.4zM416.39 256a154.34 154.34 0 01-1.53 20.79l45.21 35.46a10.81 10.81 0 012.45 13.75l-42.77 74a10.81 10.81 0 01-13.14 4.59l-44.9-18.08a16.11 16.11 0 00-15.17 1.75A164.48 164.48 0 01325 400.8a15.94 15.94 0 00-8.82 12.14l-6.73 47.89a11.08 11.08 0 01-10.68 9.17h-85.54a11.11 11.11 0 01-10.69-8.87l-6.72-47.82a16.07 16.07 0 00-9-12.22 155.3 155.3 0 01-21.46-12.57 16 16 0 00-15.11-1.71l-44.89 18.07a10.81 10.81 0 01-13.14-4.58l-42.77-74a10.8 10.8 0 012.45-13.75l38.21-30a16.05 16.05 0 006-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 00-6.07-13.94l-38.19-30A10.81 10.81 0 0149.48 186l42.77-74a10.81 10.81 0 0113.14-4.59l44.9 18.08a16.1 16.1 0 0015.16-1.75A164.48 164.48 0 01187 111.2a15.94 15.94 0 008.82-12.14l6.73-47.89A11.08 11.08 0 01213.23 42h85.54a11.11 11.11 0 0110.69 8.87l6.72 47.82a16.07 16.07 0 009 12.22 155.3 155.3 0 0121.46 12.57 16 16 0 0015.11 1.71l44.89-18.07a10.81 10.81 0 0113.14 4.58l42.77 74a10.8 10.8 0 01-2.45 13.75l-38.21 30a16.05 16.05 0 00-6.05 13.93c.33 4.14.54 8.3.54 12.47z" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "grid-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <rect x="48" y="48" width="176" height="176" rx="20" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <rect x="288" y="48" width="176" height="176" rx="20" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <rect x="48" y="288" width="176" height="176" rx="20" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <rect x="288" y="288" width="176" height="176" rx="20" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
      </svg>
    ),
    "school-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M256 32L32 160l224 128 224-128L256 32z" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M112 240v112l144 80 144-80V240" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M480 160v144" stroke={color} strokeWidth={32} strokeLinecap="round"/>
        <circle cx="480" cy="320" r="16" fill={color}/>
      </svg>
    ),
    "book-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M256 160c16-63.16 76.43-95.41 208-96a15.94 15.94 0 0116 16v288a16 16 0 01-16 16c-128 0-177.45 25.81-208 64-30.37-38-80-64-208-64a16 16 0 01-16-16V80a15.94 15.94 0 0116-16c131.57.59 192 32.84 208 96z" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M256 160v320" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "flash-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M315.27 33L96 288h176l-35.27 191L480 224H304L315.27 33z" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
      </svg>
    ),
    "globe-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="208" stroke={color} strokeWidth={32}/>
        <path d="M48 256h416M256 48c-58.07 111.26-91 176-91 208s32.93 96.74 91 208M256 48c58.07 111.26 91 176 91 208s-32.93 96.74-91 208" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M48 176h416M48 336h416" stroke={color} strokeWidth={32}/>
      </svg>
    ),
    "log-out-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M304 336v80a32 32 0 01-32 32H96a32 32 0 01-32-32V96a32 32 0 0132-32h176a32 32 0 0132 32v80" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M368 336l80-80-80-80" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M176 256h272" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "chevron-forward": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M184 112l144 144-144 144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "trophy": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill={color}>
        <path d="M399.64 64H112.36L80 176c-1.37 4.82-2 9.76-2 14.72 0 56.79 46.49 103.28 103.28 103.28A144 144 0 00256 448a144 144 0 0074.72-154H176V304a80 80 0 01-80-80c0-1.67.09-3.32.27-5L128 96h256l31.73 123a80.1 80.1 0 01.27 5 80 80 0 01-80 80V294h25.28A144 144 0 00336 448a144 144 0 0074.72-154C467.51 294 514 247.51 514 190.72c0-4.96-.63-9.9-2-14.72zM176 176H96l16-64h64v64zm240 0H336v-64h64l16 64z"/>
        <path d="M160 448h192v32H160zM128 480h256v16H128z"/>
      </svg>
    ),
    "wallet-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M32 144a64 64 0 0164-64h288a32 32 0 0132 32v16" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M32 144v224a64 64 0 0064 64h336a16 16 0 0016-16V240a16 16 0 00-16-16H128a32 32 0 010-64h288" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="368" cy="336" r="24" fill={color}/>
      </svg>
    ),
    "help-circle-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M256 80a176 176 0 10176 176A176 176 0 00256 80z" stroke={color} strokeWidth={32}/>
        <path d="M200 202.29c0-32.84 23.94-61.66 56.79-64.29 33.51-2.69 62.74 18.7 68.85 49.65 6 30.07-9.34 58.21-34.91 71.39C272.16 269.18 257.66 286.34 256 308" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="256" cy="372" r="20" fill={color}/>
      </svg>
    ),
    "cart-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <path d="M164.96 400a24 24 0 1024 24 24 24 0 00-24-24zM376.96 400a24 24 0 1024 24 24 24 0 00-24-24z" fill={color}/>
        <path d="M48 80h64l48.8 246.19A32 32 0 00192 352h198.06a32 32 0 0031.09-24.6l19.2-80.6a16 16 0 00-15.55-19.6H128" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "gift-outline": (
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none">
        <rect x="48" y="192" width="416" height="96" rx="8" stroke={color} strokeWidth={32}/>
        <path d="M96 288v144a32 32 0 0032 32h256a32 32 0 0032-32V288" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M256 192v272" stroke={color} strokeWidth={32}/>
        <path d="M256 192c-20-64-80-96-128-64-32 22-16 64 32 64h96zM256 192c20-64 80-96 128-64 32 22 16 64-32 64h-96z" stroke={color} strokeWidth={24} strokeLinejoin="round"/>
      </svg>
    ),
  };
  return icons[name] ?? <svg width={s} height={s}/>;
}

// ─── Drawer item ──────────────────────────────────────────────
function DrawerItem({ iconName, label, active, onClick }: {
  iconName: string; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`drawer-item${active ? " active" : ""}`}
      style={{ fontWeight: active ? 700 : 500 }}
    >
      <Icon name={iconName} size={20} color={active ? "#38bdf8" : "#94a3b8"} />
      {label}
    </button>
  );
}

// ─── Language item ────────────────────────────────────────────
function LanguageItem({ language, onClick, label }: { language: string; onClick: () => void; label: string }) {
  const nativeName = INDIAN_LANGUAGES[language] ?? language;
  return (
    <button onClick={onClick} className="drawer-item" style={{ gap: 10 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: "rgba(56,189,248,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="globe-outline" size={18} color="#38bdf8"/>
      </div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#38bdf8", marginTop: 1 }}>
          {nativeName} · {language}
        </div>
      </div>
      <Icon name="chevron-forward" size={16} color="#475569"/>
    </button>
  );
}

// ─── SkillBoard gradient button ───────────────────────────────
function SkillBoardItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div style={{ padding: "6px 16px" }}>
      <button
        onClick={onClick}
        style={{
          width: "100%", border: "none", cursor: "pointer", borderRadius: 14,
          background: "linear-gradient(90deg, #92400e, #d97706, #fbbf24)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          boxShadow: "0 4px 12px rgba(217,119,6,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="trophy" size={22} color="#fff"/>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>{label}</span>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: 8, padding: "4px 8px",
        }}>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>⭐ TOP</span>
        </div>
      </button>
    </div>
  );
}

// ─── Daily Streak Quiz item ───────────────────────────────────
// Flame + quiz icon combo, "NEW" badge — mirrors mobile
// app/(drawer)/_layout.tsx's DailyStreakQuizDrawerItem exactly.
function DailyStreakQuizItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="drawer-item"
      style={{
        gap: 8, border: "1px solid rgba(249,115,22,0.3)", borderRadius: 12,
        margin: "4px 16px", width: "calc(100% - 32px)",
      }}
    >
      <span style={{ position: "relative", width: 24, display: "flex", justifyContent: "center" }}>
        <Icon name="help-circle-outline" size={20} color="#f97316" />
        <span style={{ position: "absolute", bottom: -6, fontSize: 11 }}>🔥</span>
      </span>
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      <span
        style={{
          background: "#f97316", borderRadius: 6, padding: "2px 6px",
          color: "#fff", fontSize: 9, fontWeight: 800,
        }}
      >
        NEW
      </span>
    </button>
  );
}

// ─── GloStore gradient button ───────────────────────────────
// Admin-curated affiliate products (books, stationery, kits). Same
// treatment as the SkillBoard pill — its own gradient so it stands out
// as a distinct, monetized surface — but in an orange/"shop" theme.
function GloStoreItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div style={{ padding: "6px 16px" }}>
      <button
        onClick={onClick}
        style={{
          width: "100%", border: "none", cursor: "pointer", borderRadius: 14,
          background: "linear-gradient(90deg, #7c2d12, #ea580c, #fb923c)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          boxShadow: "0 4px 12px rgba(234,88,12,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="cart-outline" size={22} color="#fff"/>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>{label}</span>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: 8, padding: "4px 8px",
        }}>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>🛍️ SHOP</span>
        </div>
      </button>
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────
export default function Drawer({ open, onClose }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const { studentProfile, user, profileLoading } = useStudentProfile();
  const { drawerItem } = useFeatureFlags();
  const { t }          = useAppTranslation();

  const [vCoinRank,     setVCoinRank]     = useState<number | null>(null);
  const [giftAvailable, setGiftAvailable] = useState(false);
  const [giftClaimed,   setGiftClaimed]   = useState(false);
  // FIX (bug report — "all updated v-coins must be shown in drawer and
  // v-coins page properly"): this used to read ONLY users/{uid}.vCoins
  // (the field claimVCoinReward / Daily Streak Quiz writes), so any coins
  // earned through the app's other reward pipeline — reels, videos,
  // contests, the registration welcome bonus, all of which write
  // vCoinsBalance via services/vCoinsService.ts's creditVCoins() — never
  // showed up here. hooks/useVCoins.ts (Wallet page, AppHeader) now sums
  // both fields too; doing the same sum here keeps the drawer's number in
  // sync with the wallet page instead of showing a different total.
  const [vCoins, setVCoins] = useState(0);
  // Distinguishes "genuinely 0 coins" from "listener hasn't delivered a
  // snapshot yet" — needed by the visibility-regain recovery below, since
  // `vCoins === 0` alone can't tell those two apart.
  const [vCoinsLoaded, setVCoinsLoaded] = useState(false);
  // Bumped to force a fresh onSnapshot subscription — see the
  // visibility-regain effect below.
  const [vCoinsReloadTick, setVCoinsReloadTick] = useState(0);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setVCoins((data.vCoinsBalance ?? 0) + (data.vCoins ?? 0));
      setVCoinsLoaded(true);
      const gift = data.surpriseGift;
      if (gift?.available && gift.year === currentYear) {
        setGiftAvailable(true);
        setGiftClaimed(!!gift.claimed);
      } else {
        setGiftAvailable(false);
        setGiftClaimed(false);
      }
    });
  }, [user, currentYear, vCoinsReloadTick]);

  // FIX (bug report — "close app, reopen — v-coins don't load", same class
  // of issue as reels/stories/useVCoins): this onSnapshot listener stays
  // subscribed for as long as the app is mounted, including while the
  // drawer itself is closed. If the browser tab sits backgrounded for a
  // while, the underlying connection can go stale without erroring — it
  // just stops delivering updates. Re-subscribing fresh when the tab
  // becomes visible again recovers a stuck listener; guarded to only fire
  // if a snapshot never came through in the first place, so this doesn't
  // refetch on every ordinary tab switch.
  useEffect(() => {
    const handleVisible = () => {
      if (!document.hidden && !vCoinsLoaded) {
        setVCoinsReloadTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [vCoinsLoaded]);

  useEffect(() => {
    if (!user || !studentProfile) return;
    const db        = getFirestore();
    const yearField = `vCoinsYear_${currentYear}`;
    const score     = (studentProfile as Record<string, unknown>)[yearField] as number ?? 0;
    getCountFromServer(
      query(collection(db, "users"), where(`vCoinsYear_${currentYear}`, ">", score))
    )
      .then((r) => setVCoinRank(r.data().count + 1))
      .catch(() => setVCoinRank(null));
  }, [studentProfile, user, currentYear]);

  const name     = studentProfile?.name               || user?.email?.split("@")[0] || t("student");
  const school   = studentProfile?.school             || t("yourSchool");
  const cls      = studentProfile?.class              || "";
  const language = studentProfile?.preferredLanguage  || "English";
  const district = studentProfile?.location?.district || "";
  const state    = studentProfile?.location?.state    || "";
  const pic      = studentProfile?.profilePic         || null;
  // FIX (bug report — avatar problem): same fallback fix as AppHeader.tsx —
  // registration now collects a Title (Mr/Ms/Mrs); use it instead of a
  // random pravatar.cc image that has nothing to do with the student.
  const studentTitle = (studentProfile as Record<string, unknown> | null | undefined)?.title as string | undefined;
  const learnXP  = (studentProfile?.LearnFunXP as number) ?? 0;
  const level    = getLevelFromXP(learnXP);
  const xpInLevel = learnXP % XP_PER_LEVEL;
  const xpPct    = Math.min((xpInLevel / XP_PER_LEVEL) * 100, 100);

  const handleLogout = async () => {
    const auth = getAuth();
    if (auth.currentUser?.email) localStorage.setItem("lastEmail", auth.currentUser.email);
    await signOut(auth);
    router.replace("/login");
    onClose();
  };

  const navTo    = (href: string) => { router.push(href); onClose(); };
  const isActive = (href: string) => pathname === href;

  return (
    <>
      <div onClick={onClose} className={`drawer-overlay${open ? " open" : ""}`} />

      <div className={`drawer-panel${open ? " open" : ""}`}>
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* ═══ PROFILE CARD ════════════════════════════════ */}
          <div className="profile-card">
            {profileLoading ? (
              <div style={{
                width: 40, height: 40,
                border: "3px solid #818cf8", borderTopColor: "transparent",
                borderRadius: "50%", animation: "spin 0.8s linear infinite",
              }}/>
            ) : (
              <>
                <img
                  src={pic || defaultAvatarForTitle(studentTitle)}
                  alt="avatar"
                  style={{
                    width: 70, height: 70, borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid rgba(255,255,255,0.3)", marginBottom: 4,
                  }}
                />
                <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{name}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ color: "#c7d2fe", fontSize: 12 }}>🏫 {school}</span>
                  {cls ? <span style={{ color: "#c7d2fe", fontSize: 12 }}>📚 Class {cls}</span> : null}
                  <span style={{ color: "#c7d2fe", fontSize: 12 }}>🗣️ {language}</span>
                  {district && state
                    ? <span style={{ color: "#c7d2fe", fontSize: 12 }}>📍 {district}, {state}</span>
                    : null}
                </div>

                {/* Stats */}
                <div className="stats-row">
                  <div className="stat-box">
                    <span style={{ fontSize: 18 }}>🪙</span>
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{vCoins}</span>
                    <span style={{ color: "#a5b4fc", fontSize: 10, fontWeight: 600 }}>{t("vCoins")}</span>
                  </div>
                  <div className="stat-divider"/>
                  <div className="stat-box">
                    <span style={{ fontSize: 18 }}>⚡</span>
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{learnXP}</span>
                    <span style={{ color: "#a5b4fc", fontSize: 10, fontWeight: 600 }}>{t("xp")}</span>
                  </div>
                  <div className="stat-divider"/>
                  <div className="stat-box">
                    <span style={{ fontSize: 18 }}>🎮</span>
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Lv {level}</span>
                    <span style={{ color: "#a5b4fc", fontSize: 10, fontWeight: 600 }}>{t("level")}</span>
                  </div>
                </div>

                {/* XP bar */}
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0 2px" }}>
                  <span style={{ color: "#c7d2fe", fontSize: 10, fontWeight: 600 }}>{t("xpToNextLevel")}</span>
                  <span style={{ color: "#c7d2fe", fontSize: 10, fontWeight: 600 }}>{xpInLevel}/{XP_PER_LEVEL}</span>
                </div>
                <div className="xp-bar-bg">
                  <div className="xp-bar-fill" style={{ width: `${xpPct}%` }}/>
                </div>

                {/* Rank banner */}
                <div className="rank-banner">
                  <span style={{ fontSize: 24 }}>🏆</span>
                  <div>
                    <div style={{ color: "#fde68a", fontSize: 11, fontWeight: 600 }}>{t("vCoinsRank")} {currentYear}</div>
                    <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>
                      {vCoinRank !== null ? `#${vCoinRank}` : "—"}
                    </div>
                  </div>
                  <button
                    onClick={() => navTo("/wallet")}
                    style={{
                      marginLeft: "auto", background: "rgba(255,255,255,0.15)",
                      border: "none", borderRadius: 8, padding: "4px 10px",
                      color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                  >{t("view")}</button>
                </div>

                {/* Surprise gift */}
                {giftAvailable && (
                  <button
                    onClick={() => navTo("/wallet")}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", textAlign: "left",
                      background: giftClaimed ? "#4B5563" : "#d97706",
                      border: "none", borderRadius: 12,
                      padding: "10px 14px", cursor: "pointer", marginTop: 6,
                    }}
                  >
                    <span style={{ fontSize: 22 }}>🎁</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>
                        {giftClaimed ? t("giftClaimed") : t("surpriseGiftWaiting")}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
                        {giftClaimed ? t("giftClaimedDesc") : t("tapToClaimReward")}
                      </div>
                    </div>
                    {!giftClaimed && <Icon name="chevron-forward" size={18} color="#fff"/>}
                  </button>
                )}
              </>
            )}
          </div>

          {/* ═══ MENU ════════════════════════════════════════ */}
          <div style={{ paddingTop: 8, paddingBottom: 12 }}>
            {drawerItem("home") && (
              <DrawerItem iconName="home" label={t("home")}
                active={isActive("/home")} onClick={() => navTo("/home")}/>
            )}
            {/* FIX (bug report — "wallet not showing in drawer"): wallet
                was intentionally removed from this menu in favor of the
                rank banner's "View" button above, but that's easy to miss
                and isn't obviously a wallet entry point. Restored as a
                proper nav item — rendered unconditionally (not gated by
                drawerItem(), unlike the other entries below) since it's a
                core money-related screen students should always be able to
                reach directly, not something admin toggles off. */}
            <DrawerItem iconName="wallet-outline" label={t("wallet") || "Wallet"}
              active={isActive("/wallet")} onClick={() => navTo("/wallet")}/>
            {drawerItem("starboard") && (
              <DrawerItem iconName="trophy-outline" label={t("starboard")}
                active={isActive("/starboard")} onClick={() => navTo("/starboard")}/>
            )}
            {drawerItem("myPrizes") && (
              <DrawerItem iconName="gift-outline" label="My Prizes"
                active={isActive("/my-prizes")} onClick={() => navTo("/my-prizes")}/>
            )}
            {drawerItem("dailyStreakQuiz") && (
              <DailyStreakQuizItem label="Daily Streak Quiz" onClick={() => navTo("/daily-streak-quiz")}/>
            )}
            {drawerItem("settings") && (
              <DrawerItem iconName="settings-outline" label={t("settings")}
                active={isActive("/settings")} onClick={() => navTo("/settings")}/>
            )}
            {drawerItem("dashboard") && (
              <DrawerItem iconName="grid-outline" label={t("dashboard")}
                active={isActive("/dashboard")} onClick={() => navTo("/dashboard")}/>
            )}
            {drawerItem("aiguru") && (
              <DrawerItem iconName="school-outline" label={t("aiGuru")}
                active={isActive("/ai-guru")} onClick={() => navTo("/ai-guru")}/>
            )}
            {drawerItem("learnfun") && (
              <DrawerItem iconName="book-outline" label={t("learnfun")}
                active={isActive("/learnfun")} onClick={() => navTo("/learnfun")}/>
            )}
            {drawerItem("skillboost") && (
              <DrawerItem iconName="flash-outline" label={t("skillBoost")}
                active={isActive("/skillboost")} onClick={() => navTo("/skillboost")}/>
            )}
            {drawerItem("language") && (
              <LanguageItem language={language} onClick={() => navTo("/settings")} label={t("language")}/>
            )}
            {drawerItem("skillboard") && (
              <SkillBoardItem onClick={() => navTo("/skillboard")} label={t("skillBoard")}/>
            )}
            {drawerItem("glostore") && (
              <GloStoreItem onClick={() => navTo("/glostore")} label={t("gloStore") || "GloStore"}/>
            )}
          </div>
        </div>

        {/* ═══ LOGOUT ══════════════════════════════════════ */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "15px 20px", width: "100%",
            background: "rgba(248,113,113,0.08)",
            border: "none", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#1e293b",
            cursor: "pointer",
          }}
        >
          <Icon name="log-out-outline" size={20} color="#F87171"/>
          <span style={{ color: "#F87171", fontSize: 16, fontWeight: 600 }}>{t("logout")}</span>
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}