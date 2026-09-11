"use client";

// PATH: apps/web/src/hooks/useInstallPrompt.ts
//
// FEATURE (install dialog on every visit — "Install Gloows365E?"): gives
// any component the platform-correct install affordance, plus the state
// needed to drive an upfront Yes/No dialog shown on page load rather than
// a secondary button:
//
//   - Android Chrome / Edge / Samsung Internet: the browser fires
//     `beforeinstallprompt`. We capture it, suppress the browser's own mini
//     UI, and expose `promptInstall()` so a component can show its own
//     dialog and trigger the native prompt on tap.
//   - iOS Safari: NEVER fires `beforeinstallprompt` — there's no
//     programmatic install API at all. The only path is the user manually
//     doing Share → "Add to Home Screen". We detect iOS Safari and expose
//     `platform: "ios"` so the dialog can show those steps instead of a
//     Yes button that would otherwise silently do nothing.
//   - Already installed (running in standalone / fullscreen display mode):
//     `isInstalled` is true.
//   - Previously installed, since uninstalled: there's no browser API for
//     this at all — once uninstalled, `display-mode: standalone` simply
//     reverts to false, indistinguishable from "never installed." So this
//     hook sets a localStorage flag the moment `appinstalled` fires, and
//     never clears it. `wasEverInstalled` reflects that flag regardless of
//     current install state, which is what lets the dialog tell "never
//     installed" apart from "installed once, then removed" — both end up
//     needing the install prompt again, but it's the distinction your spec
//     asked for, and it's also just useful data to keep around.
//
// Returns:
//   platform         — "android" | "ios" | "desktop" | "unsupported"
//   canInstall       — true once a native prompt is ready to fire (Chromium only)
//   isInstalled      — true if CURRENTLY running as an installed PWA
//   wasEverInstalled — true if this browser/device installed it at some point
//                      (persists across uninstall — see localStorage note above)
//   promptInstall    — call from a Yes button; resolves to the user's choice

import { useEffect, useState, useCallback } from "react";

type Platform = "android" | "ios" | "desktop" | "unsupported";

const EVER_INSTALLED_KEY = "gloows_pwa_ever_installed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UseInstallPromptReturn {
  platform: Platform;
  canInstall: boolean;
  isInstalled: boolean;
  wasEverInstalled: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) return "ios";
  // iPadOS 13+ reports as "Mac" in UA but has touch support
  const isIpadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (isIpadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneDisplay = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  // iOS Safari's own (non-standard) flag for "launched from home screen"
  const isIOSStandalone = (window.navigator as any).standalone === true;
  return Boolean(isStandaloneDisplay || isIOSStandalone);
}

function readEverInstalled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EVER_INSTALLED_KEY) === "true";
  } catch {
    return false;
  }
}

function markEverInstalled(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EVER_INSTALLED_KEY, "true");
  } catch {
    /* ignore storage errors */
  }
}

export function useInstallPrompt(): UseInstallPromptReturn {
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [isInstalled, setIsInstalled] = useState(false);
  const [wasEverInstalled, setWasEverInstalled] = useState(false);
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    const standalone = detectStandalone();
    setIsInstalled(standalone);
    // Currently running standalone necessarily means it was installed at
    // some point — cover that case even if the appinstalled event was
    // somehow missed (e.g. installed in a previous app version).
    if (standalone) markEverInstalled();
    setWasEverInstalled(readEverInstalled() || standalone);

    const onBeforeInstallPrompt = (e: Event) => {
      // Stops the browser's own mini-infobar so we control the UI instead.
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredEvent(null);
      markEverInstalled();
      setWasEverInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredEvent) return "unavailable";
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    if (outcome === "accepted") {
      markEverInstalled();
      setWasEverInstalled(true);
    }
    return outcome;
  }, [deferredEvent]);

  return {
    platform,
    canInstall: deferredEvent !== null,
    isInstalled,
    wasEverInstalled,
    promptInstall,
  };
}

