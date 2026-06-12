"use client";

// PATH: packages/shared-logic/src/hooks/useHomeFeed.ts
// Extracted from mobile home.tsx fetchPosts(): calls the getHomeFeed Cloud
// Function and keeps only photo/video posts — identical on both platforms.

import { useCallback, useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

export interface HomeFeedPost {
  id?: string;
  postType?: string;
  title?: string;
  caption?: string;
  thumbnail?: string;
  mediaUrl?: string;
  imageUrl?: string;
  userName?: string;
  views?: number;
  likes?: number;
  [key: string]: any;
}

export function useHomeFeed() {
  const [posts, setPosts] = useState<HomeFeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const getHomeFeed = httpsCallable<
        { classLevel?: string },
        { banners: unknown[]; posts: HomeFeedPost[] }
      >(getFunctions(), "getHomeFeed");
      const { data } = await getHomeFeed({});
      setPosts(
        data.posts.filter(
          (p) => p.postType === "photo" || p.postType === "video"
        )
      );
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { posts, loading, refetch };
}
