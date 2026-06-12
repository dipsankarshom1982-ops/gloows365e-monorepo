import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import type { Ad } from "@/lib/ads/types";

// ── Callables ─────────────────────────────────────────────────────────────────

const getAdsCF     = httpsCallable<
  { module: string; classLevel?: string; adType?: string; limit?: number },
  { ads: Ad[] }
>(functions, "getAds");

const recordEventCF = httpsCallable<
  { adId: string; event: string; module: string; sessionId: string; classLevel?: string },
  { success: boolean }
>(functions, "recordAdEvent");

const claimRewardCF = httpsCallable<
  { adId: string; sessionId: string },
  { success: boolean; coins: number; message: string }
>(functions, "claimAdReward");

// ── Session ID (stable per app launch) ────────────────────────────────────────

const SESSION_ID = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAdsForModule(
  module: string,
  classLevel = "all",
  adType?: string,
  limit = 5
): Promise<Ad[]> {
  try {
    const res = await getAdsCF({ module, classLevel, adType, limit });
    return res.data.ads ?? [];
  } catch (e) {
    console.warn("[AdService] getAds failed:", e);
    return [];
  }
}

export async function recordImpression(adId: string, module: string, classLevel = "all"): Promise<void> {
  try {
    await recordEventCF({ adId, event: "impression", module, sessionId: SESSION_ID, classLevel });
  } catch { /* non-blocking */ }
}

export async function recordClick(adId: string, module: string): Promise<void> {
  try {
    await recordEventCF({ adId, event: "click", module, sessionId: SESSION_ID });
  } catch { /* non-blocking */ }
}

export async function recordWatchStart(adId: string, module: string): Promise<void> {
  try {
    await recordEventCF({ adId, event: "watch_start", module, sessionId: SESSION_ID });
  } catch { /* non-blocking */ }
}

export async function recordWatchComplete(adId: string, module: string): Promise<void> {
  try {
    await recordEventCF({ adId, event: "watch_complete", module, sessionId: SESSION_ID });
  } catch { /* non-blocking */ }
}

export async function claimReward(adId: string): Promise<{ coins: number; message: string }> {
  const res = await claimRewardCF({ adId, sessionId: SESSION_ID });
  return { coins: res.data.coins, message: res.data.message };
}

export { SESSION_ID };
