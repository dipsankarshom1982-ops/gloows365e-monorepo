"use client";

// PATH: apps/web/src/app/(app)/settings/change-password/page.tsx
// Mirrors mobile app/change-password.tsx
// Re-authenticates with current password, then updates to the new one.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

type FieldId = "current" | "next" | "confirm";

function Icon({ name, size = 18, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "lock-closed-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <rect x="96" y="208" width="320" height="272" rx="32" stroke={color} strokeWidth={32}/>
        <path d="M176 208v-48a80 80 0 01160 0v48" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="256" cy="320" r="32" fill={color}/>
        <path d="M256 352v48" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "eye-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M255.66 112c-77.94 0-157.89 45.11-220.83 138.78a23.13 23.13 0 000 26.44C97.77 370.89 177.72 416 255.66 416s157.89-45.11 220.83-138.78a23.13 23.13 0 000-26.44C413.55 157.11 333.6 112 255.66 112z" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <circle cx="256" cy="256" r="80" stroke={color} strokeWidth={32}/>
      </svg>
    ),
    "eye-off-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M432 448L80 96" stroke={color} strokeWidth={32} strokeLinecap="round"/>
        <path d="M256 112c77.94 0 157.89 45.11 220.83 138.78a23.13 23.13 0 010 26.44 313.07 313.07 0 01-31.6 41.21M186.5 154.8C144.5 174 105.5 209.5 60.66 277.22a23.13 23.13 0 000 26.44C97.77 370.89 177.72 416 255.66 416c25.74 0 51.3-4.69 75.84-13.39M256 176a80 80 0 0177.13 104.3M177.81 224A80 80 0 00256 336" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "alert-circle-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="256" r="208" stroke={color} strokeWidth={32}/>
        <path d="M256 176v112" stroke={color} strokeWidth={32} strokeLinecap="round"/>
        <circle cx="256" cy="352" r="8" fill={color}/>
      </svg>
    ),
    "save-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M358.62 121.37l32.01 32a8 8 0 010 11.32L184.46 367.78a16 16 0 01-7.4 4.27l-58.21 16.27a4 4 0 01-4.93-4.93l16.27-58.21a16 16 0 014.27-7.4z" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M64 432h384" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "checkmark-circle": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29l-134.4 160a16 16 0 01-12 5.71h-.27a16 16 0 01-11.89-5.3l-57.6-64a16 16 0 1123.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0124.5 20.58z"/>
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

function PasswordField({
  id, label, value, onChange, show, onToggleShow, onFocus,
  isDarkMode, textSec, surfaceBg, borderCol, textMain,
}: {
  id: FieldId; label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void; onFocus: () => void;
  isDarkMode: boolean; textSec: string; surfaceBg: string; borderCol: string; textMain: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: textSec, marginBottom: 6 }}>{label}</div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: surfaceBg, border: `1px solid ${borderCol}`,
        borderRadius: 10, padding: "0 12px", height: 48,
      }}>
        <Icon name="lock-closed-outline" size={18} color={textSec}/>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder="••••••••"
          autoComplete={id === "current" ? "current-password" : "new-password"}
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontSize: 15, fontWeight: 500, color: textMain,
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
        >
          <Icon name={show ? "eye-off-outline" : "eye-outline"} size={18} color={textSec}/>
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState<Record<FieldId, boolean>>({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const toggleShow = (id: FieldId) => setShow((prev) => ({ ...prev, [id]: !prev[id] }));

  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b" : "#f8fafc";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";
  const pageBg    = isDarkMode ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)" : colors.background;

  const validate = (): string | null => {
    if (!current.trim()) return "Please enter your current password.";
    if (next.length < 6) return "New password must be at least 6 characters.";
    if (next !== confirm) return "Passwords do not match.";
    if (next === current) return "New password must be different from the current one.";
    return null;
  };

  const handleChange = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    const user = getAuth().currentUser;
    if (!user?.email) {
      setError("No authenticated user found. Please log in again.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      setSuccess(true);
    } catch (e: any) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else if (e.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else if (e.code === "auth/requires-recent-login") {
        setError("Session expired. Please log out and log in again before changing your password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ background: pageBg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
        <div style={{ width: 100, height: 100, borderRadius: 50, background: accent + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="checkmark-circle" size={64} color={accent}/>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: textMain }}>Password Changed!</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: textSec, textAlign: "center", lineHeight: 1.6 }}>
          Your password has been updated successfully.
        </div>
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 28px", borderRadius: 12, border: "none", cursor: "pointer",
            background: accent, color: "#fff", fontSize: 15, fontWeight: 700,
          }}
        >
          <Icon name="arrow-back" size={20} color="#fff"/>
          Back to Settings
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 40 }}>

      {/* Title */}
      <div style={{ padding: "16px 20px 20px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginBottom: 6 }}>🔑 Change Password</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: textSec, lineHeight: "20px" }}>
          Enter your current password, then set a new one.
        </div>
      </div>

      {/* Form */}
      <div style={{ margin: "0 20px 12px", padding: 16, borderRadius: 16, border: `1px solid ${borderCol}`, background: surfaceBg }}>
        <PasswordField
          id="current" label="Current Password" value={current} onChange={setCurrent}
          show={show.current} onToggleShow={() => toggleShow("current")} onFocus={() => setError("")}
          isDarkMode={isDarkMode} textSec={textSec} surfaceBg={isDarkMode ? "#0f172a" : "#ffffff"} borderCol={borderCol} textMain={textMain}
        />
        <div style={{ height: 1, background: borderCol, margin: "4px 0" }}/>
        <PasswordField
          id="next" label="New Password" value={next} onChange={setNext}
          show={show.next} onToggleShow={() => toggleShow("next")} onFocus={() => setError("")}
          isDarkMode={isDarkMode} textSec={textSec} surfaceBg={isDarkMode ? "#0f172a" : "#ffffff"} borderCol={borderCol} textMain={textMain}
        />
        <PasswordField
          id="confirm" label="Confirm New Password" value={confirm} onChange={setConfirm}
          show={show.confirm} onToggleShow={() => toggleShow("confirm")} onFocus={() => setError("")}
          isDarkMode={isDarkMode} textSec={textSec} surfaceBg={isDarkMode ? "#0f172a" : "#ffffff"} borderCol={borderCol} textMain={textMain}
        />

        {/* Password strength hint */}
        {next.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: next.length >= n * 3
                  ? (next.length >= 10 ? "#22c55e" : next.length >= 6 ? "#f59e0b" : "#ef4444")
                  : borderCol,
              }}/>
            ))}
            <span style={{ fontSize: 11, fontWeight: 600, color: textSec, minWidth: 50 }}>
              {next.length < 6 ? "Too short" : next.length < 10 ? "Fair" : "Strong"}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {!!error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          margin: "0 20px 12px", padding: 12, borderRadius: 10,
          background: "#fee2e2", border: "1px solid #fca5a5",
        }}>
          <Icon name="alert-circle-outline" size={16} color="#dc2626"/>
          <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 500, flex: 1 }}>{error}</span>
        </div>
      )}

      {/* Submit */}
      <div style={{ padding: "0 20px" }}>
        <button
          onClick={handleChange}
          disabled={loading}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 0", borderRadius: 12, border: "none", cursor: loading ? "default" : "pointer",
            background: loading ? accent + "80" : accent, color: "#fff", fontSize: 15, fontWeight: 700,
            marginBottom: 12, opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? (
            <div style={{ width: 18, height: 18, border: "3px solid rgba(255,255,255,0.4)", borderTop: "3px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
          ) : (
            <>
              <Icon name="save-outline" size={20} color="#fff"/>
              Update Password
            </>
          )}
        </button>

        {/* Cancel */}
        <button
          onClick={() => router.back()}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 0", borderRadius: 12, cursor: "pointer",
            background: "transparent", border: `1px solid ${borderCol}`, color: textSec, fontSize: 15, fontWeight: 600,
          }}
        >
          <Icon name="arrow-back" size={18} color={textSec}/>
          Cancel
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
