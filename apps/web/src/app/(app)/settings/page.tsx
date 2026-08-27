"use client";

// PATH: apps/web/src/app/(app)/settings/page.tsx
// Mirrors mobile app/settings.tsx exactly
// Dark Theme now navigates to /settings/theme (dedicated page)

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";

function Icon({ name, size = 22, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "person-circle-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="208" stroke={color} strokeWidth={32}/>
        <path d="M256 272a80 80 0 100-160 80 80 0 000 160z" stroke={color} strokeWidth={32}/>
        <path d="M96.9 432.8A160 160 0 01256 336a160 160 0 01159.1 96.8" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "globe-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="208" stroke={color} strokeWidth={32}/>
        <path d="M48 256h416M256 48c-58.07 111.26-91 176-91 208s32.93 96.74 91 208M256 48c58.07 111.26 91 176 91 208s-32.93 96.74-91 208" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M48 176h416M48 336h416" stroke={color} strokeWidth={32}/>
      </svg>
    ),
    "moon": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M283.2 512a228.6 228.6 0 01-92.6-19.4A236.7 236.7 0 0119.4 283.2C7.3 226.1 14.6 169.5 39.8 120.4s65.8-89.5 116.1-113.8A36 36 0 01201 34.7a34.9 34.9 0 0113.7 32.2 197.5 197.5 0 0026.6 152.7 197.8 197.8 0 00131 87.7 34.9 34.9 0 0127.8 21.4 36 36 0 01-2.6 45.4 237.4 237.4 0 01-114.3 138z"/>
      </svg>
    ),
    "sunny-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="96" stroke={color} strokeWidth={32} strokeLinecap="round"/>
        <path d="M256 64V32M256 480v-32M64 256H32M480 256h-32M110.1 110.1L87.9 87.9M424.1 424.1l-22.2-22.2M424.1 87.9l-22.2 22.2M110.1 401.9l-22.2 22.2" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "notifications-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M427.68 351.43C402 320 390 304 390 240c0-48.6-34.2-89.4-80-98.9V128a48 48 0 00-96 0v13.1C168.2 150.6 134 191.4 134 240c0 64-12 80-37.68 111.43A16 16 0 00108 376h296a16 16 0 0023.68-24.57z" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M192 376v16a64 64 0 00128 0v-16" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "key-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="218" cy="228" r="114" stroke={color} strokeWidth={32}/>
        <path d="M302 314l182 182M402 380l-56 56" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "lock-closed-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <rect x="96" y="208" width="320" height="272" rx="32" stroke={color} strokeWidth={32}/>
        <path d="M176 208v-48a80 80 0 01160 0v48" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="256" cy="320" r="32" fill={color}/>
        <path d="M256 352v48" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "information-circle-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="208" stroke={color} strokeWidth={32}/>
        <path d="M256 176v16M256 336V240" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "chevron-forward": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M184 112l144 144-144 144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "star-outline": (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          stroke={color} strokeWidth={1.6} strokeLinejoin="round"/>
      </svg>
    ),
    "bug-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <rect x="176" y="128" width="160" height="240" rx="80" stroke={color} strokeWidth={32}/>
        <path d="M256 128V64M208 96l-32-32M304 96l32-32M96 224h80M336 224h80M96 288h80M336 288h80M144 400l48-48M368 400l-48-48" stroke={color} strokeWidth={28} strokeLinecap="round"/>
      </svg>
    ),
    "arrow-back": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M328 400L184 256l144-144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  return icons[name] ?? <svg width={size} height={size}/>;
}

function ToggleSwitch({ value, onChange, accentColor }: {
  value: boolean; onChange: () => void; accentColor: string;
}) {
  return (
    <button
      onClick={onChange}
      aria-pressed={value}
      style={{
        width: 50, height: 28, borderRadius: 14,
        background: value ? accentColor + "88" : "#334155",
        border: "none", cursor: "pointer",
        position: "relative", flexShrink: 0,
        transition: "background 0.2s", padding: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: value ? 25 : 3,
        width: 22, height: 22, borderRadius: "50%",
        background: value ? accentColor : "#64748b",
        transition: "left 0.2s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }}/>
    </button>
  );
}

function SettingItem({
  icon, accentColor, title, description,
  isToggle, toggleValue, onToggle, onClick, isDark,
}: {
  icon: string; accentColor: string; title: string; description: string;
  isToggle?: boolean; toggleValue?: boolean; onToggle?: () => void;
  onClick?: () => void; isDark: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const surfaceBg = isDark ? "#1e293b" : "#f8fafc";
  const borderCol = isDark ? "#334155" : "#e2e8f0";
  const textMain  = isDark ? "#f1f5f9" : "#1e293b";
  const textSec   = isDark ? "#94a3b8" : "#64748b";

  return (
    <div
      onClick={isToggle ? undefined : onClick}
      onMouseEnter={() => { if (!isToggle) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", borderRadius: 16,
        border: `1px solid ${hovered ? accentColor + "60" : borderCol}`,
        background: hovered && !isToggle ? (isDark ? "#263348" : "#f1f5f9") : surfaceBg,
        cursor: isToggle ? "default" : "pointer",
        transition: "all 0.15s", gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: accentColor + "1a",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginRight: 14,
        }}>
          <Icon name={icon} size={22} color={accentColor}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textMain, marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {description}
          </div>
        </div>
      </div>
      {isToggle
        ? <ToggleSwitch value={toggleValue!} onChange={onToggle!} accentColor={accentColor}/>
        : <Icon name="chevron-forward" size={20} color={textSec}/>
      }
    </div>
  );
}

export default function SettingsPage() {
  const { isDarkMode, colors } = useTheme();
  const { studentProfile } = useStudentProfile();
  const router = useRouter();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  useEffect(() => {
    setNotificationsEnabled(localStorage.getItem("@notifications_enabled") === "true");
  }, []);

  const toggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem("@notifications_enabled", String(next));
  };

  const language  = studentProfile?.preferredLanguage || "English";
  const pageBg    = isDarkMode ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)" : colors.background;
  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b" : "#f8fafc";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";

  const items = [
    { id: "profile",       title: "Profile Settings",  description: "Edit your name, photo, school & more",           icon: "person-circle-outline",      accentColor: "#6366f1", route: "/settings/profile" },
    { id: "language",      title: "Language",           description: `Change language — currently ${language}`,         icon: "globe-outline",               accentColor: "#0ea5e9", route: "/settings/language" },
    { id: "theme",         title: "Dark Theme",         description: isDarkMode ? "🌙 Dark — tap to change"  : "☀️ Light — tap to change", icon: isDarkMode ? "moon" : "sunny-outline", accentColor: "#f59e0b", route: "/settings/theme" },
    { id: "notifications", title: "Notifications",      description: "Receive push notifications",                       icon: "notifications-outline",       accentColor: "#10b981", isToggle: true, toggleValue: notificationsEnabled, onToggle: toggleNotifications },
    { id: "password",      title: "Change Password",    description: "Update your account password",                     icon: "key-outline",                 accentColor: "#8b5cf6", route: "/settings/change-password" },
    { id: "privacy",       title: "Privacy",            description: "Manage your privacy settings",                     icon: "lock-closed-outline",         accentColor: "#ef4444", route: "/settings/privacy" },
    { id: "about",         title: "About",              description: "Learn more about GLOOWS365E",                      icon: "information-circle-outline",  accentColor: "#64748b", route: "/settings/about" },
    { id: "feedback",      title: "Feedback & Ratings", description: "Rate features & share your suggestions",           icon: "star-outline",                accentColor: "#f59e0b", route: "/settings/feedback" },
    { id: "report-bug",    title: "Report a Bug",       description: "Tell us what went wrong",                          icon: "bug-outline",                 accentColor: "#ef4444", route: "/settings/report-bug" },
  ] as const;

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 80 }}>

      {/* Title */}
      <div style={{ padding: "16px 20px 4px" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: accent, marginBottom: 4 }}>⚙️ Settings</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: textSec }}>Customize your experience</div>
      </div>

      {/* Language pill */}
      <div style={{ padding: "8px 20px 4px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 20, border: "1px solid #6366f1", background: isDarkMode ? "rgba(99,102,241,0.15)" : "#ede9fe" }}>
          <Icon name="globe-outline" size={14} color="#6366f1"/>
          <span style={{ color: "#6366f1", fontSize: 13, fontWeight: 700 }}>{language}</span>
          <button onClick={() => router.push("/settings/language")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <span style={{ color: "#6366f1", fontSize: 12, fontWeight: 600, textDecoration: "underline" }}>Change</span>
          </button>
        </div>
      </div>

      {/* Settings list */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <SettingItem
            key={item.id}
            icon={item.icon}
            accentColor={item.accentColor}
            title={item.title}
            description={item.description}
            isToggle={"isToggle" in item ? item.isToggle : false}
            toggleValue={"toggleValue" in item ? item.toggleValue : undefined}
            onToggle={"onToggle" in item ? item.onToggle : undefined}
            onClick={"route" in item ? () => router.push(item.route) : undefined}
            isDark={isDarkMode}
          />
        ))}
      </div>

      {/* Theme indicator */}
      <div style={{ margin: "4px 20px 16px", padding: 16, borderRadius: 14, border: `1px solid ${isDarkMode ? "#3730a3" : "#c7d2fe"}`, background: isDarkMode ? "linear-gradient(135deg, #1e1b4b, #1e293b)" : "linear-gradient(135deg, #f0f4ff, #e8eeff)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: textSec }}>Current Theme:</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: isDarkMode ? "#818cf8" : "#4f46e5" }}>{isDarkMode ? "🌙 Dark" : "☀️ Light"}</span>
      </div>

      {/* Go Back */}
      <div style={{ padding: "0 20px" }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "14px 0", borderRadius: 14, cursor: "pointer", background: surfaceBg, border: `1px solid ${borderCol}` }}>
          <Icon name="arrow-back" size={20} color={isDarkMode ? "#f1f5f9" : "#1e293b"}/>
          <span style={{ fontSize: 15, fontWeight: 700, color: isDarkMode ? "#f1f5f9" : "#1e293b" }}>Go Back</span>
        </button>
      </div>
    </div>
  );
}