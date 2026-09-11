"use client";

// PATH: apps/web/src/components/InstallDialog.tsx
//
// FEATURE ("Install Gloows365E?" prompt on every visit): replaces the old
// secondary "Install App" button on the welcome screen (removed) with an
// upfront modal shown on page load, site-wide. Mounted once in layout.tsx
// so it appears regardless of which page someone lands on.
//
// Three states, per spec:
//
//   1. Never installed (or installed before, then removed) → Yes/No dialog.
//      "wasEverInstalled" from useInstallPrompt is what lets this case and
//      case 2 below be told apart — see that hook for why a localStorage
//      flag is needed at all (there's no browser API for "uninstalled").
//      - Yes → triggers the real native install flow (Android/desktop), or
//        on iOS, switches the dialog to manual Share→Add-to-Home-Screen
//        steps since Apple allows no programmatic install at all.
//      - No → dismisses for THIS page load only. Per spec ("it will show
//        until they install"), the dialog returns on the next visit — no
//        "don't ask again" persistence for a plain No.
//
//   2. Currently installed (running standalone right now) → informational
//      "Gloows365E is already installed" message, no Yes/No, just an OK
//      that dismisses. Showing a real install prompt here is also
//      structurally impossible — Chromium has no `beforeinstallprompt` to
//      fire for an app that's already installed, so this state isn't just
//      "be polite," it also reflects what's actually possible.
//
//   3. Tapping Yes on Android/desktop and the browser declining to offer a
//      native prompt (canInstall stays false — e.g. some installability
//      criterion isn't met) → dialog just closes for this visit; nothing
//      useful to show instead, and the install button on a future visit
//      will work once whatever criterion was missing is satisfied.
//
// Does NOT render anything until the platform/install-state detection in
// useInstallPrompt has run client-side — avoids a flash of the wrong
// state during hydration (the hook's initial values are SSR-safe defaults
// that don't match "show the dialog").

import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

// Per-page-load dismissal — a sessionStorage flag, not localStorage, so
// saying "No" doesn't follow them forever, matching "it will show until
// they install": each fresh visit (new tab / new session) starts clean,
// but navigating between pages within the same visit won't re-show it
// after a No.
const DISMISSED_THIS_VISIT_KEY = "gloows_install_dialog_dismissed_session";

export default function InstallDialog() {
  const { platform, canInstall, isInstalled, wasEverInstalled, promptInstall } = useInstallPrompt();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  // FIX (race condition): on Android/desktop, `canInstall` only flips true
  // once the browser fires `beforeinstallprompt`, which can take a moment
  // (or never happen if installability criteria aren't met). Without this
  // grace period, the dialog could render with a Yes button that silently
  // does nothing if tapped immediately. iOS never fires that event at all
  // (it always shows manual steps instead), so it skips this wait.
  const [waitedForPrompt, setWaitedForPrompt] = useState(false);

  useEffect(() => {
    setReady(true);
    try {
      setDismissed(window.sessionStorage.getItem(DISMISSED_THIS_VISIT_KEY) === "true");
    } catch {
      /* sessionStorage unavailable — just don't persist the dismissal */
    }
  }, []);

  useEffect(() => {
    if (platform === "ios") { setWaitedForPrompt(true); return; }
    if (canInstall) { setWaitedForPrompt(true); return; }
    const timer = setTimeout(() => setWaitedForPrompt(true), 1500);
    return () => clearTimeout(timer);
  }, [platform, canInstall]);

  if (!ready || dismissed || !waitedForPrompt) return null;

  // iOS truly cannot detect "installed" via a standard API the way
  // Chromium can — detectStandalone() in the hook does cover it via the
  // non-standard navigator.standalone flag, so isInstalled is still
  // trustworthy here.
  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISSED_THIS_VISIT_KEY, "true");
    } catch {
      /* ignore */
    }
  };

  const handleYes = async () => {
    if (platform === "ios") {
      setShowIOSSteps(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      setJustInstalled(true);
    } else {
      // "dismissed" (closed the native dialog) or "unavailable" (browser
      // didn't have a prompt ready) — either way, nothing more to show.
      handleDismiss();
    }
  };

  // ── State: currently installed — informational only ──────────────
  if (isInstalled && !justInstalled) {
    return (
      <DialogShell onClose={handleDismiss}>
        <div style={iconCircleStyle}>✅</div>
        <h2 style={titleStyle}>Gloows365E is already installed</h2>
        <p style={bodyStyle}>You're all set — open it from your home screen or app list anytime.</p>
        <button onClick={handleDismiss} style={primaryButtonStyle}>OK</button>
      </DialogShell>
    );
  }

  // ── State: just installed (post-Yes confirmation) ─────────────────
  if (justInstalled) {
    return (
      <DialogShell onClose={handleDismiss}>
        <div style={iconCircleStyle}>🎉</div>
        <h2 style={titleStyle}>Gloows365E installed!</h2>
        <p style={bodyStyle}>You can now open it directly from your home screen or app list.</p>
        <button onClick={handleDismiss} style={primaryButtonStyle}>OK</button>
      </DialogShell>
    );
  }

  // ── State: iOS manual steps (after tapping Yes) ───────────────────
  if (showIOSSteps) {
    return (
      <DialogShell onClose={handleDismiss}>
        <div style={iconCircleStyle}>📲</div>
        <h2 style={titleStyle}>Install Gloows365E</h2>
        <ol style={stepsListStyle}>
          <li>Tap the <strong>Share</strong> icon (square with an arrow ↑) in the toolbar</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Tap <strong>"Add"</strong> in the top-right corner</li>
        </ol>
        <button onClick={handleDismiss} style={primaryButtonStyle}>Got it</button>
      </DialogShell>
    );
  }

  // ── State: platform can't install at all, OR install genuinely isn't
  //     available right now (waited through the grace period above and
  //     the browser still has no beforeinstallprompt to offer — some
  //     installability criterion isn't met). Showing "Install
  //     Gloows365E?" with a Yes button that can't do anything is more
  //     confusing than just letting them browse normally, which
  //     returning null already does. ─────────────────────────────────
  if (platform === "unsupported" || (platform !== "ios" && !canInstall)) return null;

  // ── State: Yes/No install prompt (never installed, or installed
  //     before and since removed — wasEverInstalled doesn't change this
  //     branch's UI, both cases get the same prompt, per spec) ────────
  return (
    <DialogShell onClose={handleDismiss}>
      <div style={iconCircleStyle}>📲</div>
      <h2 style={titleStyle}>Install Gloows365E?</h2>
      <p style={bodyStyle}>
        {wasEverInstalled
          ? "Add it back to your home screen for faster access and offline support."
          : "Add it to your home screen for faster access, offline support, and a full-screen app experience."}
      </p>
      <div style={buttonRowStyle}>
        <button onClick={handleDismiss} style={secondaryButtonStyle}>No</button>
        <button onClick={handleYes} style={primaryButtonStyle}>Yes</button>
      </div>
    </DialogShell>
  );
}

// ─── Shared shell ───────────────────────────────────────────────
function DialogShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1e293b", borderRadius: 20, padding: "28px 24px",
          width: "100%", maxWidth: 340,
          display: "flex", flexDirection: "column", alignItems: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────
const iconCircleStyle: React.CSSProperties = {
  width: 64, height: 64, borderRadius: "50%",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 30, marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  color: "#f1f5f9", fontSize: 19, fontWeight: 800, textAlign: "center",
  margin: 0, marginBottom: 8,
};

const bodyStyle: React.CSSProperties = {
  color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 1.5,
  margin: 0, marginBottom: 22,
};

const stepsListStyle: React.CSSProperties = {
  color: "#cbd5e1", fontSize: 13, lineHeight: 1.8, textAlign: "left",
  width: "100%", paddingLeft: 20, marginTop: 0, marginBottom: 22,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex", gap: 10, width: "100%",
};

const primaryButtonStyle: React.CSSProperties = {
  flex: 1, padding: "13px 0", borderRadius: 14, border: "none",
  background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1, padding: "13px 0", borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
  color: "#94a3b8", fontSize: 15, fontWeight: 700, cursor: "pointer",
};
