"use client";
// PATH: apps/web/src/store/discoverStore.ts
// Web equivalent of mobile's store/discoverStore.ts (Zustand + AsyncStorage).
// Web has no Zustand dependency, so this uses a small React hook backed by
// localStorage — same persisted shape (searchHistory, savedCareers), same
// action names, so call sites read identically to the mobile store.

import { useCallback, useEffect, useState } from "react";
import type { DiscoverHistoryItem, DiscoverResult, SavedCareer } from "@/lib/discover/types";

const HISTORY_KEY = "discover_search_history";
const SAVED_KEY = "discover_saved_careers";

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
const sessionResults = new Map<string, DiscoverResult>();

export function useDiscoverStore() {
  const [searchHistory, setSearchHistory] = useState<DiscoverHistoryItem[]>([]);
  const [savedCareers, setSavedCareers] = useState<SavedCareer[]>([]);
  const [remainingSearches, setRemainingSearches] = useState<number | null>(null);

  useEffect(() => {
    setSearchHistory(readJSON(HISTORY_KEY, []));
    setSavedCareers(readJSON(SAVED_KEY, []));
  }, []);

  const addSearch = useCallback((query: string, queryHash: string) => {
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h.queryHash !== queryHash);
      const next = [{ query, queryHash, searchedAt: Date.now() }, ...filtered].slice(0, 20);
      writeJSON(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const addResult = useCallback((result: DiscoverResult) => {
    sessionResults.set(result.queryHash, result);
  }, []);

  const getCachedResult = useCallback((queryHash: string) => sessionResults.get(queryHash), []);

  const saveCareer = useCallback((career: SavedCareer) => {
    setSavedCareers((prev) => {
      const next = [career, ...prev.filter((c) => c.careerId !== career.careerId)];
      writeJSON(SAVED_KEY, next);
      return next;
    });
  }, []);

  const unsaveCareer = useCallback((careerId: string) => {
    setSavedCareers((prev) => {
      const next = prev.filter((c) => c.careerId !== careerId);
      writeJSON(SAVED_KEY, next);
      return next;
    });
  }, []);

  const isCareerSaved = useCallback(
    (careerId: string) => savedCareers.some((c) => c.careerId === careerId),
    [savedCareers]
  );

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    writeJSON(HISTORY_KEY, []);
  }, []);

  const setRemaining = useCallback((n: number | null) => setRemainingSearches(n), []);

  return {
    searchHistory, savedCareers, remainingSearches,
    addSearch, addResult, getCachedResult,
    saveCareer, unsaveCareer, isCareerSaved,
    clearHistory, setRemaining,
  };
}
