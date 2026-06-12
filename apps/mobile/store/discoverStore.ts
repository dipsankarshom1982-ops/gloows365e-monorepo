import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  DiscoverResult,
  DiscoverHistoryItem,
  SavedCareer,
} from "@/lib/discover/types";

// ─── State shape ──────────────────────────────────────────────────────────────

interface DiscoverState {
  searchHistory: DiscoverHistoryItem[];
  recentResults: DiscoverResult[];   // session-only
  savedCareers: SavedCareer[];
  remainingSearches: number | null;  // null = unlimited (premium)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface DiscoverActions {
  addSearch: (query: string, queryHash: string) => void;
  addResult: (result: DiscoverResult) => void;
  saveCareer: (career: SavedCareer) => void;
  unsaveCareer: (careerId: string) => void;
  setRemaining: (n: number | null) => void;
  clearHistory: () => void;
  isCareerSaved: (careerId: string) => boolean;
  getCachedResult: (queryHash: string) => DiscoverResult | undefined;
}

type DiscoverStore = DiscoverState & DiscoverActions;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDiscoverStore = create<DiscoverStore>()(
  persist(
    (set, get) => ({
      searchHistory: [],
      recentResults: [],
      savedCareers: [],
      remainingSearches: null,

      addSearch: (query, queryHash) =>
        set((state) => {
          const filtered = state.searchHistory.filter(
            (h) => h.queryHash !== queryHash
          );
          return {
            searchHistory: [
              { query, queryHash, searchedAt: Date.now() },
              ...filtered,
            ].slice(0, 20),
          };
        }),

      addResult: (result) =>
        set((state) => {
          const filtered = state.recentResults.filter(
            (r) => r.queryHash !== result.queryHash
          );
          return { recentResults: [result, ...filtered].slice(0, 10) };
        }),

      saveCareer: (career) =>
        set((state) => ({
          savedCareers: [
            career,
            ...state.savedCareers.filter((c) => c.careerId !== career.careerId),
          ],
        })),

      unsaveCareer: (careerId) =>
        set((state) => ({
          savedCareers: state.savedCareers.filter((c) => c.careerId !== careerId),
        })),

      setRemaining: (n) => set({ remainingSearches: n }),

      clearHistory: () => set({ searchHistory: [] }),

      isCareerSaved: (careerId) =>
        get().savedCareers.some((c) => c.careerId === careerId),

      getCachedResult: (queryHash) =>
        get().recentResults.find((r) => r.queryHash === queryHash),
    }),
    {
      name: "discover-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        searchHistory: state.searchHistory,
        savedCareers: state.savedCareers,
      }),
    }
  )
);
