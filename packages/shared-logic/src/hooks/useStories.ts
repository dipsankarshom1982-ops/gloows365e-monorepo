"use client";

// PATH: packages/shared-logic/src/hooks/useStories.ts
// The "brain" of the stories strip, extracted from mobile components/Story.tsx:
//   - own stories listener (any status) for the signed-in user
//   - approved + non-expired listener (status=="approved", expiresAt > now —
//     uses the existing composite index)
//   - merge + dedupe (own wins)
//   - author name/class enrichment with per-uid profile caching
//   - grouping by category with hasUnread / isNew computation
//
// Platform-specific concerns stay OUT of this hook:
//   - viewed-story persistence (AsyncStorage on mobile, localStorage on web)
//     → pass the current Set of viewed ids in; the hook only computes with it
//   - category display metadata (emoji/label/gradient from lib/storyCategories)
//     → the hook groups by raw categoryId; the UI maps id → visuals

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

// Loose story shape — mirrors lib/story StoryDoc without importing mobile code.
export interface SharedStoryDoc {
  id: string;
  userId: string;
  type?: "image" | "video";
  mediaUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  status?: string;
  isFeatured?: boolean;
  storyKind?: string;
  learnMoreUrl?: string;
  partnerName?: string;
  partnerLogoUrl?: string;
  likes?: number;
  views?: number;
  educationalCategory?: string;
  category?: string;
  createdAt?: any;
  expiresAt?: any;
  userName?: string;
  userClass?: number | null;
  [key: string]: any;
}

export interface StoryCategoryGroup {
  categoryId: string;
  stories: SharedStoryDoc[];
  hasUnread: boolean;
  isNew: boolean;
}

interface UserProfile {
  name: string;
  userClass: number | null;
}

export function resolveStoryCategory(
  educationalCategory?: string,
  fallback?: string
): string {
  return educationalCategory || fallback || "general";
}

export function isNewStory(story: SharedStoryDoc): boolean {
  if (!story.createdAt) return false;
  const created =
    typeof story.createdAt?.toDate === "function"
      ? story.createdAt.toDate()
      : new Date(story.createdAt);
  return Date.now() - created.getTime() < 24 * 60 * 60 * 1000;
}

async function fetchUserProfile(uid: string): Promise<UserProfile> {
  const db = getFirestore();
  for (const col of ["students", "users"]) {
    try {
      const snap = await getDoc(doc(db, col, uid));
      if (snap.exists()) {
        const d = snap.data() as any;
        const firstName = d.firstName || d.first_name || "";
        const lastName = d.lastName || d.last_name || "";
        const name =
          d.name ||
          d.fullName ||
          d.displayName ||
          d.studentName ||
          d.userName ||
          (firstName + (lastName ? " " + lastName : "")).trim() ||
          "";
        const rawClass = d.class ?? d.grade ?? null;
        const userClass = rawClass !== null ? Number(rawClass) : null;
        if (name && name !== "Student") return { name, userClass };
      }
    } catch {
      /* ignore */
    }
  }
  return { name: "", userClass: null };
}

export function useStories(uid: string | null, viewedIds: Set<string>) {
  const ownDocsRef = useRef<SharedStoryDoc[]>([]);
  const approvedDocsRef = useRef<SharedStoryDoc[]>([]);
  const profileCache = useRef<Record<string, UserProfile>>({});

  const [allStories, setAllStories] = useState<SharedStoryDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const mergeAndSet = useCallback(
    async (own: SharedStoryDoc[], approved: SharedStoryDoc[]) => {
      const ownIds = new Set(own.map((d) => d.id));
      const allDocs = [...own, ...approved.filter((d) => !ownIds.has(d.id))];

      // Enrich author names — fetch only uncached profiles (single pass)
      const uncachedUids = [
        ...new Set(
          allDocs.map((s) => s.userId).filter((u) => u && !profileCache.current[u])
        ),
      ];
      await Promise.all(
        uncachedUids.map(async (u) => {
          profileCache.current[u] = await fetchUserProfile(u);
        })
      );
      for (const s of allDocs) {
        const { name, userClass } =
          profileCache.current[s.userId] ?? { name: "", userClass: null };
        if (name && name !== "Student") s.userName = name;
        if (userClass !== null) s.userClass = userClass;
      }

      setAllStories(allDocs);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    const db = getFirestore();
    let unsubOwn: (() => void) | undefined;

    if (uid) {
      unsubOwn = onSnapshot(
        query(collection(db, "stories"), where("userId", "==", uid)),
        (snap) => {
          ownDocsRef.current = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as SharedStoryDoc[];
          mergeAndSet(ownDocsRef.current, approvedDocsRef.current);
        },
        () => setLoading(false)
      );
    }

    const unsubApproved = onSnapshot(
      query(
        collection(db, "stories"),
        where("status", "==", "approved"),
        where("expiresAt", ">", Timestamp.now())
      ),
      (snap) => {
        approvedDocsRef.current = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as SharedStoryDoc[];
        mergeAndSet(ownDocsRef.current, approvedDocsRef.current);
      },
      () => setLoading(false)
    );

    return () => {
      unsubOwn?.();
      unsubApproved();
    };
  }, [uid, mergeAndSet]);

  const groups = useMemo<StoryCategoryGroup[]>(() => {
    const map: Record<string, SharedStoryDoc[]> = {};
    allStories.forEach((story) => {
      const catId = resolveStoryCategory(
        story.educationalCategory,
        story.category || (story.type as any)
      );
      (map[catId] ??= []).push(story);
    });
    return Object.keys(map).map((categoryId) => {
      const stories = map[categoryId];
      return {
        categoryId,
        stories,
        hasUnread: stories.some(
          (s) => !viewedIds.has(s.id) && s.status === "approved"
        ),
        isNew: stories.some((s) => isNewStory(s) && s.status === "approved"),
      };
    });
  }, [allStories, viewedIds]);

  return { allStories, groups, loading };
}
