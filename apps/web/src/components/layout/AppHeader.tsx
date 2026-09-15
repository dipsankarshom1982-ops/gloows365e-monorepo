"use client";

// PATH: apps/web/src/components/layout/AppHeader.tsx
// Mirrors mobile components/header.tsx exactly.
// ✅ No extra Firestore fetch — profilePic comes from StudentProfileContext
// ✅ Unread notifications listener on users/{uid}/notifications
//
// LEFT:  Hamburger (34×34) · BrandLogo
// RIGHT: VCoins amber pill · Bell with badge · Avatar with indigo ring

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";
import { useTheme } from "@/context/ThemeContext";
import { useVCoins } from "@/hooks/useVCoins";
import { defaultAvatarForTitle } from "@/lib/avatars";

interface Props {
  onMenuOpen: () => void;
  title?: string;
}

// Module-scoped (not per-mount) so the reload() network call happens once
// per app session instead of on every page that renders <AppHeader/>, and so
// a dismissal sticks while navigating between pages. Both reset naturally on
// a full page reload — exactly the "dismissible for this session" behaviour
// the soft-gate reminder is meant to have. Mirrors mobile components/header.tsx.
let emailReloadedThisSession = false;
let verifyBannerDismissed = false;

// ─── Icons — accept a color prop so they react to theme ───────
function MenuIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 512 512" fill="none">
      <path d="M80 160h352M80 256h352M80 352h352"
        stroke={color} strokeWidth={40} strokeLinecap="round" />
    </svg>
  );
}

function BellFilledIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 512 512" fill="#F59E0B">
      <path d="M440.08 341.31c-1.94-2-3.85-4-5.72-5.93-23.56-24.32-35.26-36.4-41.07-87.65a154.87 154.87 0 00-21.3-64.46C353.79 159.31 330 144 304 137.27V128a48 48 0 00-96 0v9.27C182 144 158.21 159.31 139.94 183.27a154.87 154.87 0 00-21.3 64.46c-5.81 51.25-17.51 63.33-41.07 87.65-1.87 1.93-3.78 3.91-5.72 5.93A30 30 0 0094 394h324.1a30 30 0 0021.98-52.69z" />
      <path d="M256 480a80.06 80.06 0 0072.43-46H183.57A80.06 80.06 0 00256 480z" />
    </svg>
  );
}

function BellOutlineIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 512 512" fill="none">
      <path d="M427.68 351.43C402 320 390 304 390 240c0-48.6-34.2-89.4-80-98.9V128a48 48 0 00-96 0v13.1C168.2 150.6 134 191.4 134 240c0 64-12 80-37.68 111.43A16 16 0 00108 376h296a16 16 0 0023.68-24.57z"
        stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M192 376v16a64 64 0 00128 0v-16"
        stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Brand logo ───────────────────────────────────────────────
// FIX (bug report — "script not visible in light theme"): "oows" was
// hardcoded to #F1F5F9 (near-white), readable only on the dark background.
// In light mode the header background is colors.background (white), so the
// text was effectively invisible. login/page.tsx already does this
// correctly with var(--text) — this brings AppHeader (used on every
// authenticated page) in line with that.
function BrandLogo({ textColor }: { textColor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>
        <span style={{ color: "#A5B4FC" }}>Gl</span>
        <span style={{ color: textColor }}>oows</span>
      </span>
      <div style={{
        background: "linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899)",
        borderRadius: 8, padding: "2px 7px",
        display: "flex", alignItems: "center",
      }}>
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 900, letterSpacing: 0.5 }}>365</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 900, color: "#FBBF24", marginBottom: 8, lineHeight: 1 }}>E</span>
    </div>
  );
}

// ─── VCoins badge ─────────────────────────────────────────────
function VCoinsBadge({ onClick }: { onClick: () => void }) {
  const { balance } = useVCoins();

  if (balance === null) {
    return (
      <div style={{
        width: 72, height: 28, borderRadius: 20,
        background: "rgba(245,158,11,0.3)",
        animation: "vcoin-pulse 1.4s ease-in-out infinite",
        flexShrink: 0,
      }} />
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "5px 10px", borderRadius: 20, border: "none",
        background: "linear-gradient(90deg, #F59E0B, #D97706)",
        cursor: "pointer", flexShrink: 0,
      }}
    >
      {/* bitcoin icon */}
      <svg width={13} height={13} viewBox="0 0 512 512" fill="#fff">
        <path d="M408.05 168.12c-2.62-34.72-32.57-46.52-70.5-49.65V64h-33.9v53.17c-8.9 0-17.93.17-26.93.35V64h-33.9v54.47c-7.36.16-14.58.31-21.63.31v-.16h-46.77l-7.4 36.24s25.09-1.08 24.74-.5c13.79 0 16.25 7.44 16.93 13.9v137.48c-.78 5.44-3.71 13.88-16.93 13.9.64.54-24.74-.51-24.74-.51l-6.43 40.12h46.42c8.66 0 17.17.18 25.53.26V416h33.9v-56.24c9.33.18 18.36.27 27.16.27V416h33.9v-56.36c57.35-3.22 97.47-17.57 102.44-70.94 4.08-43.51-16.42-62.97-49.16-70.58zm-162 182c0-12.4.02-71.36 0-83.76 6.63-.36 60.51-4.72 61.22 41.7C308.07 354.92 246.1 349.77 246.05 350.12zm-.05-126.93V205.32c5.33-.18 50.76-4.49 51.47 38.87 0 41.28-51.47 38.47-51.47 38.47z" />
      </svg>
      <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>
        {Math.floor(balance).toLocaleString("en-IN")}
      </span>
      <svg width={11} height={11} viewBox="0 0 512 512" fill="none">
        <path d="M184 112l144 144-144 144" stroke="rgba(255,255,255,0.75)" strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ─── Main header ──────────────────────────────────────────────
export default function AppHeader({ onMenuOpen, title }: Props) {
  const router = useRouter();
  const { user, studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified ?? true);
  const [bannerDismissed, setBannerDismissed] = useState(verifyBannerDismissed);

  // Soft-gate reminder — never blocks navigation or feature access, just
  // nudges. Firebase's client SDK doesn't push emailVerified changes to the
  // User object on its own, so a reload() is needed to notice a
  // verification click that happened elsewhere; done once per session.
  useEffect(() => {
    if (!user || emailReloadedThisSession) return;
    emailReloadedThisSession = true;
    user.reload()
      .then(() => setEmailVerified(user.emailVerified))
      .catch(() => { /* ignore — keep cached value */ });
  }, [user]);

  // Unread notifications listener
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setUnreadCount(0); return; }
    const db = getFirestore();
    const q  = query(
      collection(db, "notifications", uid, "items"),
      where("read", "==", false)
    );
    return onSnapshot(q, (snap) => setUnreadCount(snap.size), () => {});
  }, [user]);

  // Profile pic — directly from context, no extra fetch needed.
  // FIX (bug report — avatar problem): this used to fall back to
  // `https://i.pravatar.cc/100?u=<uid>` — a random third-party cartoon
  // avatar with zero relation to the actual student — whenever no photo
  // had been uploaded yet. Registration now collects a Title (Mr/Ms/Mrs),
  // so we fall back to the matching silhouette avatar instead.
  const studentTitle = (studentProfile as Record<string, unknown> | null | undefined)?.title as string | undefined;
  const avatarSrc = studentProfile?.profilePic || defaultAvatarForTitle(studentTitle);
  const hasUnread = unreadCount > 0;

  // Mirrors mobile header.tsx's exact per-theme colors
  const menuIconColor = isDarkMode ? "#C7D2FE" : "#4F46E5";
  const bellColor      = isDarkMode ? "#94A3B8" : "#64748B";
  const iconBg          = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const iconBgSoft       = isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
  const titleColor       = isDarkMode ? "#e2e8f0" : colors.text;

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: colors.background,
        borderBottom: `1px solid ${isDarkMode ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.15)"}`,
        transition: "background 0.2s, border-color 0.2s",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px", height: 56,
        }}>

          {/* ── LEFT ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={onMenuOpen}
              aria-label="Open menu"
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: iconBg,
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <MenuIcon color={menuIconColor} />
            </button>
            {title
              ? <span style={{ fontSize: 17, fontWeight: 700, color: titleColor }}>{title}</span>
              : <BrandLogo textColor={titleColor} />
            }
          </div>

          {/* ── RIGHT ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* VCoins */}
            <VCoinsBadge onClick={() => router.push("/wallet")} />

            {/* Bell */}
            <button
              onClick={() => router.push("/notifications")}
              aria-label="Notifications"
              style={{
                position: "relative",
                width: 34, height: 34, borderRadius: 10,
                background: iconBgSoft,
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {hasUnread ? <BellFilledIcon /> : <BellOutlineIcon color={bellColor} />}
              {hasUnread && (
                <div style={{
                  position: "absolute", top: 2, right: 2,
                  background: "#EF4444", borderRadius: 8,
                  minWidth: 15, height: 15,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 3px",
                  border: `1.5px solid ${colors.background}`,
                }}>
                  <span style={{ color: "#fff", fontSize: 8, fontWeight: 900, lineHeight: 1 }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </div>
              )}
            </button>

            {/* Avatar — routes to /mypost, matching mobile's handleProfilePress exactly */}
            <button
              onClick={() => router.push("/mypost")}
              aria-label="Profile"
              style={{
                background: "none",
                border: "2px solid #6366F1",
                borderRadius: "50%",
                cursor: "pointer", padding: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <img
                src={avatarSrc}
                alt="Profile"
                style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", display: "block" }}
              />
            </button>

          </div>
        </div>

        {/* Soft-gate email verification reminder — dismissible for this
            session, never blocks navigation. Hidden automatically for Google
            sign-ups (their email is already verified). */}
        {!emailVerified && !bannerDismissed && (
          <div
            onClick={() => router.push("/settings/profile")}
            style={{
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              margin: "0 12px 8px", padding: "8px 12px", borderRadius: 10,
              background: isDarkMode ? "rgba(245,158,11,0.14)" : "rgba(245,158,11,0.12)",
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>📧</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#F59E0B", lineHeight: "15px" }}>
              Please ask your parent to verify the email we sent — tap to resend
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); verifyBannerDismissed = true; setBannerDismissed(true); }}
              aria-label="Dismiss"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#F59E0B", fontSize: 16, lineHeight: 1, padding: 4, flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        )}
      </header>

      <style>{`
        @keyframes vcoin-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </>
  );
}