"use client";

// PATH: apps/web/src/components/Story.tsx
// Mirrors mobile components/Story.tsx — full educational story system:
//   - Horizontal category strip (square gradient cards)
//   - Full-screen story viewer: tap-to-advance, per-story progress bars,
//     like + view tracking, pending/rejected/featured badges, partner CTA
//   - Upload flow: image or short video (<=10s), with progress overlay
//
// Web-specific adaptations from the mobile version:
//   - AsyncStorage -> localStorage (viewed-story tracking)
//   - Modal -> fixed-position overlay div
//   - expo-video -> native <video> + hls.js, loaded only when a video
//     story is actually opened so it never weighs down the rest of the app
//   - ImagePicker -> <input type="file">
//   - Animated.Value progress bar -> timer-driven CSS width transition
//
// Video story playback uses the `hls.js` package (already in package.json).

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { StoryCard, AddStoryCard } from "@/components/StoryCard";
import { StoryDoc } from "@/lib/story";
import { handleStoryAction } from "@/lib/storyActions";
import {
  getCategoryById,
  resolveCategory,
  useStoryCategories,
} from "@/lib/storyCategories";
import { resolveStreamUrl, uploadToStream } from "@/lib/cloudflareStream";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

// ─── Constants ────────────────────────────────────────────────────────────
const IMAGE_DURATION = 5000; // ms each image story stays on screen
const MAX_VIDEO_SEC   = 10;
const VIEWED_KEY      = "gloows_viewed_stories";

// ─── Types ────────────────────────────────────────────────────────────────
interface CategoryGroup {
  categoryId:   string;
  stories:      StoryDoc[];
  hasUnread:    boolean;
  isNew:        boolean;
  previewStory: StoryDoc | undefined;
}
interface UserProfile { name: string; userClass: number | null; }

// ─── Helpers ──────────────────────────────────────────────────────────────
async function fetchUserProfile(uid: string): Promise<UserProfile> {
  for (const col of ["students", "users"]) {
    try {
      const snap = await getDoc(doc(db, col, uid));
      if (snap.exists()) {
        const d = snap.data() as any;
        const firstName = d.firstName || d.first_name || "";
        const lastName  = d.lastName  || d.last_name  || "";
        const name =
          d.name || d.fullName || d.displayName ||
          d.studentName || d.userName ||
          (firstName + (lastName ? " " + lastName : "")).trim() || "";
        const rawClass  = d.class ?? d.grade ?? null;
        const userClass = rawClass !== null ? Number(rawClass) : null;
        if (name && name !== "Student") return { name, userClass };
      }
    } catch { /* ignore */ }
  }
  return { name: auth.currentUser?.displayName || "", userClass: null };
}

function loadViewedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(VIEWED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function markViewed(storyId: string): void {
  try {
    const set = loadViewedSet();
    set.add(storyId);
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}
function isNewStory(story: StoryDoc): boolean {
  if (!story.createdAt) return false;
  const created = story.createdAt?.toDate?.() ?? new Date(story.createdAt);
  return Date.now() - created.getTime() < 24 * 60 * 60 * 1000;
}

// ─── Progress bar (per-story, animates via CSS width transition) ──────────
function ProgressBar({ total, current, durationMs, playing }: {
  total: number; current: number; durationMs: number; playing: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 3, padding: "0 10px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: "rgba(255,255,255,0.3)", overflow: "hidden",
        }}>
          {i < current ? (
            // Already watched — fully filled, static
            <div style={{ height: "100%", borderRadius: 2, background: "#fff", width: "100%" }}/>
          ) : i === current ? (
            // Active bar — animates from empty to full over durationMs
            <div style={{
              height: "100%", borderRadius: 2, background: "#fff",
              width: "100%", transformOrigin: "left",
              transform: "scaleX(0)",
              animation: playing ? `story-progress-fill ${durationMs}ms linear forwards` : "none",
            }}/>
          ) : (
            // Upcoming — empty
            <div style={{ height: "100%", borderRadius: 2, background: "#fff", width: "0%" }}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Video player (HLS via hls.js, native on Safari) ──────────────────────
function StoryVideo({ src, playing, onEnded }: {
  src: string; playing: boolean; onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: any;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari — native HLS support
      video.src = src;
    } else {
      // Chrome/Firefox/Edge — needs hls.js
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
        } else {
          video.src = src; // last-resort fallback
        }
      }).catch(() => { video.src = src; });
    }

    return () => { hls?.destroy(); };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [playing]);

  return (
    <video
      ref={videoRef}
      onEnded={onEnded}
      muted={false}
      playsInline
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 1 }}
    />
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Story() {
  const router = useRouter();
  const categories = useStoryCategories();

  const ownDocsRef      = useRef<StoryDoc[]>([]);
  const approvedDocsRef = useRef<StoryDoc[]>([]);
  const profileCache    = useRef<Record<string, UserProfile>>({});
  const fileInputRef    = useRef<HTMLInputElement>(null);

  const [allStories,    setAllStories]    = useState<StoryDoc[]>([]);
  const [viewedIds,     setViewedIds]     = useState<Set<string>>(new Set());
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Bumped to force fresh onSnapshot subscriptions — see the
  // visibility-regain effect below.
  const [reloadTick,    setReloadTick]    = useState(0);

  // Viewer state
  const [viewerOpen,      setViewerOpen]      = useState(false);
  const [activeCategoryId,setActiveCategoryId]= useState("");
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [liked,           setLiked]           = useState(false);
  const [videoPlaying,    setVideoPlaying]    = useState(true);

  // Upload state
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,    setUploadPct]   = useState(0);
  const [uploadPhase,  setUploadPhase] = useState<"uploading" | "saving" | "done">("uploading");
  const [uploadError,  setUploadError] = useState("");

  useEffect(() => { setViewedIds(loadViewedSet()); }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUserId(u?.uid ?? null));
    return () => unsub();
  }, []);

  const mergeAndSet = useCallback(async (own: StoryDoc[], approved: StoryDoc[]) => {
    const ownIds  = new Set(own.map((d) => d.id));
    const allDocs = [...own, ...approved.filter((d) => !ownIds.has(d.id))];

    const uncachedUids = [...new Set(
      allDocs.map((s) => s.userId).filter((uid) => !profileCache.current[uid])
    )];

    await Promise.all(
      uncachedUids.map(async (uid) => {
        profileCache.current[uid] = await fetchUserProfile(uid);
      })
    );

    for (const s of allDocs) {
      const { name, userClass } = profileCache.current[s.userId] ?? { name: "", userClass: null };
      if (name && name !== "Student") s.userName = name;
      if (userClass !== null) s.userClass = userClass;
    }

    setAllStories(allDocs);
    setStoriesLoaded(true);
  }, []);

  useEffect(() => {
    let unsubOwn: (() => void) | undefined;

    if (currentUserId) {
      unsubOwn = onSnapshot(
        query(collection(db, "stories"), where("userId", "==", currentUserId)),
        (snap) => {
          ownDocsRef.current = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StoryDoc[];
          mergeAndSet(ownDocsRef.current, approvedDocsRef.current);
        },
        () => setStoriesLoaded(true)
      );
    }

    const now = Timestamp.now();
    const unsubApproved = onSnapshot(
      query(
        collection(db, "stories"),
        where("status",    "==", "approved"),
        where("expiresAt", ">",  now),
      ),
      (snap) => {
        approvedDocsRef.current = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StoryDoc[];
        mergeAndSet(ownDocsRef.current, approvedDocsRef.current);
      },
      () => setStoriesLoaded(true)
    );

    return () => { unsubOwn?.(); unsubApproved(); };
  }, [currentUserId, mergeAndSet, reloadTick]);

  // FIX (bug report — "close app, reopen, reels/stories don't load"):
  // onSnapshot listeners normally reconnect on their own after a network
  // hiccup, but a long-lived stream can end up stale after the browser tab
  // sits backgrounded for a while (mobile OS suspending timers/sockets) —
  // it doesn't error, it just stops delivering updates. Tearing down and
  // re-subscribing fresh listeners when the tab becomes visible again is a
  // cheap safety net for exactly that case. Guarded to only fire when the
  // strip looks empty, so this isn't refetching on every ordinary tab
  // switch — only recovering a feed that looks stuck.
  useEffect(() => {
    const handleVisible = () => {
      if (!document.hidden && allStories.length === 0) {
        setReloadTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [allStories.length]);

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const map: Record<string, StoryDoc[]> = {};
    allStories.forEach((story) => {
      const catId = resolveCategory(story.educationalCategory, story.category || (story as any).type);
      if (!map[catId]) map[catId] = [];
      map[catId].push(story);
    });
    return categories
      .filter((cat) => map[cat.id]?.length > 0)
      .map((cat) => {
        const stories   = map[cat.id] ?? [];
        const hasUnread = stories.some((s) => !viewedIds.has(s.id) && s.status === "approved");
        const isNew     = stories.some((s) => isNewStory(s) && s.status === "approved");

        // Card thumbnail = most recent approved story in this category
        // (falls back to any story if nothing's approved yet) — shows real
        // content instead of a flat color card.
        const previewStory = [...stories].sort((a, b) => {
          const aApproved = a.status === "approved" ? 1 : 0;
          const bApproved = b.status === "approved" ? 1 : 0;
          if (aApproved !== bApproved) return bApproved - aApproved;
          const aTime = (a.createdAt as any)?.toDate?.()?.getTime?.() ?? 0;
          const bTime = (b.createdAt as any)?.toDate?.()?.getTime?.() ?? 0;
          return bTime - aTime;
        })[0];

        return { categoryId: cat.id, stories, hasUnread, isNew, previewStory };
      });
  }, [allStories, categories, viewedIds]);

  const activeGroup    = categoryGroups.find((g) => g.categoryId === activeCategoryId);
  const activeStories  = activeGroup?.stories ?? [];
  const activeStory    = activeStories[currentStoryIdx];
  const activeCategory = getCategoryById(activeCategoryId, categories);

  // ── Navigation ────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (currentStoryIdx < activeStories.length - 1) {
      setCurrentStoryIdx((p) => p + 1);
    } else {
      const gi = categoryGroups.findIndex((g) => g.categoryId === activeCategoryId);
      if (gi < categoryGroups.length - 1) {
        setActiveCategoryId(categoryGroups[gi + 1].categoryId);
        setCurrentStoryIdx(0);
      } else {
        setViewerOpen(false);
      }
    }
  }, [currentStoryIdx, activeStories.length, categoryGroups, activeCategoryId]);

  const goPrev = useCallback(() => {
    if (currentStoryIdx > 0) setCurrentStoryIdx((p) => p - 1);
  }, [currentStoryIdx]);

  // Image auto-advance timer
  useEffect(() => {
    if (!viewerOpen || !activeStory || activeStory.type === "video") return;
    const timer = setTimeout(goNext, IMAGE_DURATION);
    return () => clearTimeout(timer);
  }, [viewerOpen, activeStory, currentStoryIdx, goNext]);

  // Mark viewed + bump view count whenever the active story changes
  useEffect(() => {
    if (!viewerOpen || !activeStory) return;
    setLiked(false);
    setVideoPlaying(true);
    markViewed(activeStory.id);
    setViewedIds((prev) => new Set([...prev, activeStory.id]));
    updateDoc(doc(db, "stories", activeStory.id), { views: increment(1) }).catch(() => {});
    // FIX: story.reward (V-Coins for view/click) and story.cta (admin-set
    // call-to-action) were defined in the data model and configurable from
    // the admin panel, but never read by either platform's viewer —
    // handleStoryAction existed in lib/storyActions.ts but nothing called
    // it. Firing the "view" reward here, at the same point views are
    // counted, since that's the natural equivalent of mobile's (also
    // unwired) intended trigger point.
    if (currentUserId && activeStory.reward?.type === "view") {
      handleStoryAction(activeStory, { id: currentUserId }, router.push);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, activeCategoryId, currentStoryIdx]);

  const openViewer = useCallback((categoryId: string) => {
    setActiveCategoryId(categoryId);
    setCurrentStoryIdx(0);
    setViewerOpen(true);
  }, []);
  const closeViewer = useCallback(() => setViewerOpen(false), []);

  const handleLike = useCallback(() => {
    if (!activeStory || liked) return;
    setLiked(true);
    updateDoc(doc(db, "stories", activeStory.id), { likes: increment(1) }).catch(() => {});
  }, [activeStory, liked]);

  // ── Upload ────────────────────────────────────────────────────────────
  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;

    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      // Quick client-side duration check, mirrors mobile's videoMaxDuration cap
      const objectUrl = URL.createObjectURL(file);
      const ok = await new Promise<boolean>((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve(v.duration <= MAX_VIDEO_SEC + 0.5);
        v.onerror = () => resolve(true); // can't check — let server-side decide
        v.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
      if (!ok) {
        setUploadError(`Videos must be ${MAX_VIDEO_SEC} seconds or shorter.`);
        setTimeout(() => setUploadError(""), 3000);
        return;
      }
    }

    setUploadPct(0); setUploadPhase("uploading"); setUploadError(""); setUploading(true);

    try {
      const storyId = Date.now().toString();
      let mediaUrl = "", thumbnailUrl = "";

      if (isVideo) {
        const { playbackUrl, thumbnailUrl: cfThumb } = await uploadToStream(file, setUploadPct);
        mediaUrl = playbackUrl; thumbnailUrl = cfThumb;
      } else {
        const storageRef = ref(getStorage(), `stories/${currentUserId}/${storyId}`);
        mediaUrl = await new Promise<string>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          task.on("state_changed",
            (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
        thumbnailUrl = mediaUrl;
      }

      setUploadPhase("saving");
      const { name: realName, userClass: realClass } = await fetchUserProfile(currentUserId ?? "");
      await setDoc(doc(db, "stories", storyId), {
        userId: currentUserId, userName: realName, userClass: realClass ?? null,
        mediaUrl, thumbnailUrl: thumbnailUrl || mediaUrl,
        type: isVideo ? "video" : "image",
        category: "achievement", educationalCategory: "success",
        title: "", description: "", relatedFeature: "SkillBattle",
        likes: 0, views: 0, status: "pending", isFeatured: false,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      });

      setUploadPhase("done");
      setTimeout(() => setUploading(false), 1200);
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed. Please try again.");
      setUploading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "10px 0" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── Category strip ── */}
      <div style={{ display: "flex", gap: 0, overflowX: "auto", padding: "0 8px" }}>
        <AddStoryCard onClick={handlePickFile} size={100} />

        {!storiesLoaded
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} style={{ marginInline: 5 }}>
                <div style={{
                  width: 100, height: 118, borderRadius: 14,
                  background: "rgba(148,163,184,0.12)",
                }}/>
              </div>
            ))
          : categoryGroups.map((g) => {
              const cat = getCategoryById(g.categoryId, categories);
              return (
                <StoryCard
                  key={g.categoryId}
                  category={cat}
                  count={g.stories.length}
                  hasUnread={g.hasUnread}
                  isNew={g.isNew}
                  onClick={() => openViewer(g.categoryId)}
                  size={100}
                  thumbnailUrl={g.previewStory?.thumbnailUrl || g.previewStory?.mediaUrl}
                  isVideoThumb={g.previewStory?.type === "video"}
                />
              );
            })
        }
      </div>

      {/* ── Story viewer ── */}
      {viewerOpen && activeStory && (
        <div style={{
          position: "fixed", inset: 0, background: "#000", zIndex: 1000,
          display: "flex", flexDirection: "column",
        }}>
          {/* Media layer */}
          <div style={{ position: "absolute", inset: 0 }}>
            <img
              src={activeStory.thumbnailUrl || activeStory.mediaUrl}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
            {activeStory.type === "video" && (
              <StoryVideo
                src={resolveStreamUrl(activeStory.mediaUrl) ?? activeStory.mediaUrl}
                playing={videoPlaying}
                onEnded={goNext}
              />
            )}
            {/* Paused play-icon overlay — mirrors mobile's playBtnWrap/playBtn */}
            {activeStory.type === "video" && !videoPlaying && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 40,
                  background: "rgba(0,0,0,0.58)", border: "2.5px solid rgba(255,255,255,0.85)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: "#fff", fontSize: 30, marginLeft: 6 }}>▶</span>
                </div>
              </div>
            )}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180, background: "rgba(0,0,0,0.38)" }}/>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 260, background: "rgba(0,0,0,0.5)" }}/>
          </div>

          {/* Touch/click layer: left = prev, right = next (image) or play/pause (video) */}
          <div
            style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex" }}
          >
            <div style={{ flex: 35, cursor: "pointer" }} onClick={goPrev} />
            <div
              style={{ flex: 65, cursor: "pointer" }}
              onClick={() => {
                if (activeStory.type === "video") setVideoPlaying((p) => !p);
                else goNext();
              }}
            />
          </div>

          {/* Progress bars */}
          <div style={{ position: "absolute", top: 18, left: 0, right: 0, zIndex: 10 }}>
            <ProgressBar
              total={activeStories.length}
              current={currentStoryIdx}
              durationMs={IMAGE_DURATION}
              playing={activeStory.type !== "video"}
            />
          </div>

          {/* Header */}
          <div style={{
            position: "absolute", top: 34, left: 14, right: 14, zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                {activeCategory?.emoji ?? "📚"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  {activeCategory?.label ?? ""}
                </div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 1 }}>
                  {currentStoryIdx + 1} of {activeStories.length}
                </div>
              </div>
            </div>
            <button
              onClick={closeViewer}
              style={{ background: "none", border: "none", color: "#fff", fontSize: 22, fontWeight: 700, cursor: "pointer", padding: 4 }}
            >✕</button>
          </div>

          {/* Status badges */}
          <div style={{ position: "absolute", top: 82, left: 14, zIndex: 10, display: "flex", gap: 6 }}>
            {activeStory.status === "pending" && (
              <div style={{ background: "#FEF3C7", borderRadius: 20, padding: "4px 10px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>⏳ Pending Approval</span>
              </div>
            )}
            {activeStory.status === "rejected" && (
              <div style={{ background: "#FEE2E2", borderRadius: 20, padding: "4px 10px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#DC2626" }}>✗ Not Approved</span>
              </div>
            )}
            {activeStory.isFeatured && (
              <div style={{ background: "#EC4899", borderRadius: 20, padding: "4px 10px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>★ Featured</span>
              </div>
            )}
          </div>

          {/* Category tag (approved only) */}
          {activeStory.status === "approved" && (
            <div style={{ position: "absolute", top: 82, right: 14, zIndex: 10 }}>
              <div style={{
                background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 10px",
                border: "0.5px solid rgba(255,255,255,0.3)",
              }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>
                  {activeCategory?.emoji} {activeCategory?.label}
                </span>
              </div>
            </div>
          )}

          {/* Info */}
          <div style={{ position: "absolute", bottom: 120, left: 16, right: 80, zIndex: 10 }}>
            {!!activeStory.userName && (
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                by {activeStory.userName}
                {activeStory.userClass ? `  ·  Class ${activeStory.userClass}` : ""}
              </div>
            )}
            {!!activeStory.title && (
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 6, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                {activeStory.title}
              </div>
            )}
            {!!activeStory.description && (
              <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 1.5 }}>
                {activeStory.description}
              </div>
            )}
          </div>

          {/* Partner bar */}
          {activeStory.storyKind === "linked" && !!activeStory.learnMoreUrl && (
            <div style={{
              position: "absolute", bottom: 94, left: 14, right: 14, zIndex: 10,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(0,0,0,0.62)", borderRadius: 14, padding: "10px 14px",
              border: "1px solid rgba(255,215,0,0.35)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                {activeStory.partnerLogoUrl
                  ? <img src={activeStory.partnerLogoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, background: "#fff" }}/>
                  : <span style={{ fontSize: 20 }}>🔗</span>
                }
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeStory.partnerName ?? "Learn More"}
                </span>
              </div>
              <button
                onClick={() => window.open(activeStory.learnMoreUrl, "_blank", "noopener,noreferrer")}
                style={{ background: "#FFD700", border: "none", borderRadius: 20, padding: "7px 14px", marginLeft: 10, cursor: "pointer" }}
              >
                <span style={{ color: "#1a1a1a", fontSize: 12, fontWeight: 800 }}>Learn More →</span>
              </button>
            </div>
          )}

          {/* CTA bar — admin-configured story.cta (text/actionType/link), independent
              of the partner bar above: a story can have either, both, or neither. */}
          {!!activeStory.cta?.link && (
            <div style={{
              position: "absolute", bottom: activeStory.storyKind === "linked" ? 154 : 94,
              left: 14, right: 14, zIndex: 10, display: "flex", justifyContent: "flex-end",
            }}>
              <button
                onClick={() => {
                  if (!currentUserId) return;
                  handleStoryAction(activeStory, { id: currentUserId }, router.push);
                }}
                style={{
                  background: "#6C63FF", border: "none", borderRadius: 20,
                  padding: "9px 18px", cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
                }}
              >
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>
                  {activeStory.cta.text || "Learn More"} →
                </span>
              </button>
            </div>
          )}

          {/* Like + views */}
          <div style={{ position: "absolute", bottom: 110, right: 14, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <button onClick={handleLike} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 26 }}>{liked ? "❤️" : "🤍"}</span>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                {(activeStory.likes ?? 0) + (liked ? 1 : 0)}
              </span>
            </button>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 22 }}>👁</span>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginTop: 2 }}>{activeStory.views ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload overlay ── */}
      {uploading && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 32,
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 340,
            display: "flex", flexDirection: "column", alignItems: "center",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 36, background: "#F3F0FF",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <span style={{ fontSize: 30 }}>
                {uploadError ? "⚠️" : uploadPhase === "done" ? "✅" : uploadPhase === "saving" ? "💾" : "☁️"}
              </span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 6, textAlign: "center" }}>
              {uploadError ? "Upload failed"
                : uploadPhase === "uploading" ? "Uploading story…"
                : uploadPhase === "saving" ? "Saving…"
                : "Submitted! 🎉"}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24, textAlign: "center" }}>
              {uploadError ? uploadError
                : uploadPhase === "uploading" ? "Please keep this tab open"
                : uploadPhase === "saving" ? "Almost done…"
                : "Waiting for admin approval"}
            </div>
            {!uploadError && (
              <>
                <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#E9E7FF", overflow: "hidden", marginBottom: 10 }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    background: uploadPhase === "done" ? "#22C55E" : "#6C63FF",
                    width: uploadPhase === "done" ? "100%" : `${uploadPct}%`,
                    transition: "width 0.25s",
                  }}/>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6C63FF" }}>
                  {uploadPhase === "done" ? "100%" : uploadPhase === "saving" ? "Saving…" : `${uploadPct}%`}
                </div>
              </>
            )}
            {uploadError && (
              <button
                onClick={() => setUploading(false)}
                style={{ marginTop: 4, background: "#6C63FF", border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >Close</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
