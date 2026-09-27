"use client";
// PATH: apps/web/src/store/discoverStore.ts
// Web equivalent of mobile's store/discoverStore.ts (Zustand + AsyncStorage).
// Web has no Zustand dependency, so this uses a small React hook backed by
// localStorage — same persisted shape (searchHistory, savedCareers), same
// action names, so call sites read identically to the mobile store.

import { useCallback, useLayoutEffect, useState } from "react";
import { useStudentProfile } from "@gloows/shared-logic";
import type { DiscoverHistoryItem, DiscoverResult, SavedCareer } from "@/lib/discover/types";

// ─── Per-user storage (data isolation fix) ─────────────────────────────────────
// FIX (Discover per-user data isolation audit): these used to be flat
// localStorage keys shared by every account that ever signed in on this
// browser — User B would see User A's saved careers/search history
// immediately after A logged out, no reload needed. Keys are now suffixed
// with the CURRENT Firebase Auth uid; a signed-out visitor reads/writes a
// fixed "signed-out" bucket, never a real uid's key.
//
// Deliberately never reads/writes the old unscoped keys ("discover_
// search_history" / "discover_saved_careers") — no migration. That legacy
// data has no reliable owner (it could belong to any previous user of this
// browser) and must not be adopted by whoever happens to be signed in when
// this ships; it's simply orphaned and ignored.
const HISTORY_BASE_KEY = "discover_search_history";
const SAVED_BASE_KEY = "discover_saved_careers";

function scopedKey(baseKey: string, uid: string | null | undefined): string {
  return `${baseKey}:${uid ?? "signed-out"}`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Session-only cache for recent results (not persisted across reloads,
// matching mobile's recentResults which is partialize-excluded from storage).
// Keyed by uid too — a stale cache hit must never surface a career/result
// another user actually searched for.
const sessionResults = new Map<string, DiscoverResult>();

export function useDiscoverStore() {
  const { user } = useStudentProfile();
  const uid = user?.uid ?? null;

  const [searchHistory, setSearchHistory] = useState<DiscoverHistoryItem[]>([]);
  const [savedCareers, setSavedCareers] = useState<SavedCareer[]>([]);
  const [remainingSearches, setRemainingSearches] = useState<number | null>(null);

  // useLayoutEffect (not useEffect): both localStorage reads below are
  // synchronous, so this can compute and commit the correct user's state
  // BEFORE the browser paints. With a plain useEffect there'd be a real
  // (if brief) window where the DOM still shows the previous user's
  // searchHistory/savedCareers after the uid has already changed — exactly
  // the kind of stale-render this fix exists to prevent.
  useLayoutEffect(() => {
    setSearchHistory(readJSON(scopedKey(HISTORY_BASE_KEY, uid), []));
    setSavedCareers(readJSON(scopedKey(SAVED_BASE_KEY, uid), []));
    // recentResults' session cache is process-wide (see sessionResults
    // above), not per-render state, so nothing to reset here for it —
    // getCachedResult below already re-derives its key from the live uid.
  }, [uid]);

  const addSearch = useCallback((query: string, queryHash: string) => {
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h.queryHash !== queryHash);
      const next = [{ query, queryHash, searchedAt: Date.now() }, ...filtered].slice(0, 20);
      writeJSON(scopedKey(HISTORY_BASE_KEY, uid), next);
      return next;
    });
  }, [uid]);

  const addResult = useCallback((result: DiscoverResult) => {
    sessionResults.set(scopedKey(result.queryHash, uid), result);
  }, [uid]);

  const getCachedResult = useCallback(
    (queryHash: string) => sessionResults.get(scopedKey(queryHash, uid)),
    [uid]
  );

  const saveCareer = useCallback((career: SavedCareer) => {
    setSavedCareers((prev) => {
      const next = [career, ...prev.filter((c) => c.careerId !== career.careerId)];
      writeJSON(scopedKey(SAVED_BASE_KEY, uid), next);
      return next;
    });
  }, [uid]);

  const unsaveCareer = useCallback((careerId: string) => {
    setSavedCareers((prev) => {
      const next = prev.filter((c) => c.careerId !== careerId);
      writeJSON(scopedKey(SAVED_BASE_KEY, uid), next);
      return next;
    });
  }, [uid]);

  const isCareerSaved = useCallback(
    (careerId: string) => savedCareers.some((c) => c.careerId === careerId),
    [savedCareers]
  );

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    writeJSON(scopedKey(HISTORY_BASE_KEY, uid), []);
  }, [uid]);

  const setRemaining = useCallback((n: number | null) => setRemainingSearches(n), []);

  return {
    searchHistory, savedCareers, remainingSearches,
    addSearch, addResult, getCachedResult,
    saveCareer, unsaveCareer, isCareerSaved,
    clearHistory, setRemaining,
  };
}
