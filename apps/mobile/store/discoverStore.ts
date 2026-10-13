import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { auth } from "@/lib/firebase";
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

const INITIAL_DISCOVER_STATE: DiscoverState = {
  searchHistory: [],
  recentResults: [],
  savedCareers: [],
  remainingSearches: null,
};

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

// ─── Per-user storage (data isolation fix) ─────────────────────────────────────
// FIX (Discover per-user data isolation audit): this store used to persist
// under one flat AsyncStorage key ("discover-store") shared by every account
// that ever signed in on the device — User B would see User A's saved
// careers/search history immediately after A logged out, no network call
// needed. Storage now reads/writes under a key suffixed with the CURRENT
// Firebase Auth uid, computed fresh on every access (not baked in once at
// store-creation time, since auth resolves after this module loads).
//
// Deliberately never touches the old unscoped "discover-store" key — no
// read, no write, no migration. That legacy data has no reliable owner (it
// could be any previous user of this device) and must not be adopted by
// whoever happens to be signed in when this ships; it's simply orphaned.
//
// No signed-in user ever falls back to another uid's key: signed-out reads/
// writes go to a fixed "discover-store:signed-out" bucket, never to a real
// uid's key and never to the legacy key.
function scopedStorageKey(baseName: string): string {
  const uid = auth.currentUser?.uid;
  return `${baseName}:${uid ?? "signed-out"}`;
}

const perUserAsyncStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(scopedStorageKey(name)),
  setItem: (name, value) => AsyncStorage.setItem(scopedStorageKey(name), value),
  removeItem: (name) => AsyncStorage.removeItem(scopedStorageKey(name)),
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDiscoverStore = create<DiscoverStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_DISCOVER_STATE,

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
      storage: createJSONStorage(() => perUserAsyncStorage),
      partialize: (state) => ({
        searchHistory: state.searchHistory,
        savedCareers: state.savedCareers,
      }),
      // Hydration is driven explicitly by the auth-change listener in
      // app/_layout.tsx, not automatically on store creation — at module
      // load time the real signed-in uid isn't known yet, so an automatic
      // hydration here would read the wrong (signed-out) bucket. Until the
      // first explicit rehydrate() call, the store simply holds
      // INITIAL_DISCOVER_STATE (empty), which is always safe to show.
      skipHydration: true,
    }
  )
);

// Resets in-memory Discover state to defaults — used by app/_layout.tsx
// BEFORE rehydrating for a newly-signed-in uid, so a user switch can never
// render the previous user's data even for a single frame while the new
// uid's data is still being read from storage.
export function resetDiscoverStateInMemory(): void {
  useDiscoverStore.setState(INITIAL_DISCOVER_STATE);
}
