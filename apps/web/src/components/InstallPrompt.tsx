"use client";

// PATH: apps/web/src/components/InstallPrompt.tsx
//
// FEATURE (pre-Play-Store tester distribution): a self-contained install
// affordance for the Welcome screen. Renders nothing if the app is already
// installed (no nagging a returning tester) or if the platform truly can't
// install PWAs at all. Otherwise shows:
//
//   - Android / Desktop Chromium: a single "📲 Install App" button wired to
//     the native install prompt via useInstallPrompt().
//   - iOS Safari: there's no install API to call — instead, short numbered
//     steps for Share → Add to Home Screen, since that's the only path.
//
// Visual style matches the existing welcome screen (frosted glass chip on
// the purple gradient background) rather than introducing a new look.

import { useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export default function InstallPrompt() {
  const { platform, canInstall, isInstalled, promptInstall } = useInstallPrompt();
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (isInstalled || justInstalled) {
    return (
      <div style={cardStyle}>
        <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
          ✅ App installed — you're all set!
        </span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") setJustInstalled(true);
  };

  // Android / desktop Chromium with the native prompt ready
  if (canInstall) {
    return (
      <button onClick={handleInstallClick} style={installButtonStyle}>
        📲 Install App for testing
      </button>
    );
  }

  // iOS Safari — no install API exists; show manual steps
  if (platform === "ios") {
    return (
      <div style={{ width: "100%", maxWidth: 360 }}>
        <button
          onClick={() => setShowIOSSteps((v) => !v)}
          style={installButtonStyle}
        >
          📲 Install App for testing
        </button>
        {showIOSSteps && (
          <div style={{ ...cardStyle, marginTop: 10, alignItems: "flex-start", textAlign: "left" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              On iPhone/iPad (Safari):
            </span>
            <ol style={{ margin: 0, paddingLeft: 18, color: "#E0E7FF", fontSize: 12, lineHeight: "20px" }}>
              <li>Tap the <strong>Share</strong> icon (square with an arrow ↑) in the toolbar</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>Tap <strong>"Add"</strong> in the top-right corner</li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  // Chromium browser that hasn't fired beforeinstallprompt yet (e.g. already
  // dismissed earlier this session, or criteria not met) — nothing useful
  // to show; the app still works fine as a regular site.
  return null;
}

// ─── Shared styles — match welcome screen's glass-on-gradient look ───────
const installButtonStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 360,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.35)",
  borderRadius: 25,
  padding: "12px 20px",
  fontSize: 14,
  fontWeight: 700,
  color: "#fff",
  cursor: "pointer",
  transition: "background 0.15s, transform 0.1s",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 360,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 16,
  padding: "12px 16px",
};
