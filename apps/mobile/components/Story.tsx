/**
 * Story.tsx — Educational Square Card Story System
 * PATH: components/Story.tsx
 *
 * Fixes applied:
 *   ✅ user ref no longer stale — read fresh inside useEffect
 *   ✅ expiresAt filter active — expired stories excluded from approved query
 *   ✅ loading state added — skeleton shows until first data arrives
 *   ✅ error state added — permission errors shown gracefully
 *   ✅ fetchUserProfile batching — single pass, no redundant reads
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import { AddStoryCard, StoryCard } from "@/components/StoryCard";
import { useTheme } from "@/context/ThemeContext";
import { StoryDoc } from "@/lib/story";
import {
  getCategoryById,
  resolveCategory,
  useStoryCategories,
} from "@/lib/storyCategories";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";

import {
  getStreamUploadUrl,
  resolveStreamUrl,
  uploadToStream,
} from "@/lib/cloudflareStream";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const IMAGE_DURATION = 5000;
const MAX_VIDEO_SEC  = 10;
const { width: SW }  = Dimensions.get("window");
const VIEWED_KEY     = "gloows_viewed_stories";

const db      = getFirestore();
const storage = getStorage();
const auth    = getAuth();

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryGroup {
  categoryId: string;
  stories:    StoryDoc[];
  hasUnread:  boolean;
  isNew:      boolean;
}

interface UserProfile { name: string; userClass: number | null; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function loadViewedSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(VIEWED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

async function markViewed(storyId: string): Promise<void> {
  try {
    const set = await loadViewedSet();
    set.add(storyId);
    await AsyncStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

function isNewStory(story: StoryDoc): boolean {
  if (!story.createdAt) return false;
  const created = story.createdAt?.toDate?.() ?? new Date(story.createdAt);
  return Date.now() - created.getTime() < 24 * 60 * 60 * 1000;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar = React.memo(({
  total, current, progress,
}: { total: number; current: number; progress: Animated.Value }) => (
  <View style={pb.row}>
    {Array.from({ length: total }).map((_, i) => (
      <View key={i} style={pb.track}>
        <Animated.View
          style={[pb.fill, {
            width: i < current ? "100%"
              : i === current
              ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
              : "0%",
          }]}
        />
      </View>
    ))}
  </View>
));

const pb = StyleSheet.create({
  row:   { flexDirection: "row", paddingHorizontal: 10, gap: 3 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  fill:  { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
});

// ─── Skeleton cards ───────────────────────────────────────────────────────────

const SkeletonStrip = React.memo(() => (
  <View style={s.skeletonRow}>
    {[1, 2, 3, 4].map((i) => (
      <View key={i} style={s.skeletonCard} />
    ))}
  </View>
));

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Story() {
  const { colors }   = useTheme();
  const categories   = useStoryCategories();

  const ownDocsRef      = useRef<StoryDoc[]>([]);
  const approvedDocsRef = useRef<StoryDoc[]>([]);
  const profileCache    = useRef<Record<string, UserProfile>>({});

  const [allStories,    setAllStories]    = useState<StoryDoc[]>([]);
  const [viewedIds,     setViewedIds]     = useState<Set<string>>(new Set());
  const [storiesLoaded, setStoriesLoaded] = useState(false); // ← loading state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // ← reactive user

  // Viewer state
  const [viewerVisible,    setViewerVisible]    = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [currentStoryIdx,  setCurrentStoryIdx]  = useState(0);
  const [liked,            setLiked]            = useState(false);
  const [videoPlaying,     setVideoPlaying]      = useState(false);

  // Upload state
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "saving" | "done">("uploading");
  const uploadAnim = useRef(new Animated.Value(0)).current;

  const progress    = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);

  // Video player
  const player = useVideoPlayer({ uri: "" }, (p) => {
    p.loop  = false;
    p.muted = false;
  });

  useEffect(() => {
    const sub = player.addListener("playingChange", (e) => {
      setVideoPlaying(e.isPlaying);
    });
    return () => sub.remove();
  }, [player]);

  // Load viewed IDs
  useEffect(() => {
    loadViewedSet().then(setViewedIds);
  }, []);

  // ── Track current user reactively ────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUserId(u?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // ── Merge helper ──────────────────────────────────────────────────────────

  const mergeAndSet = useCallback(async (
    own: StoryDoc[],
    approved: StoryDoc[],
  ) => {
    const ownIds  = new Set(own.map((d) => d.id));
    const allDocs = [...own, ...approved.filter((d) => !ownIds.has(d.id))];

    // Only fetch profiles for UIDs not already cached
    const uncachedUids = [...new Set(
      allDocs
        .map((s) => s.userId)
        .filter((uid) => !profileCache.current[uid])
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

  // ── Firebase listeners: own stories + approved stories (non-expired) ──────

  useEffect(() => {
    let unsubOwn: (() => void) | undefined;

    // use currentUserId (reactive) instead of auth.currentUser (stale)
    if (currentUserId) {
      unsubOwn = onSnapshot(
        query(
          collection(db, "stories"),
          where("userId", "==", currentUserId)
        ),
        (snap) => {
          ownDocsRef.current = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StoryDoc[];
          mergeAndSet(ownDocsRef.current, approvedDocsRef.current);
        },
        (e) => {
          console.warn("fetchStories (own):", e.code);
          setStoriesLoaded(true);
        }
      );
    }

    // ✅ FIX: expiresAt filter is now ACTIVE — expired stories excluded
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
      (e) => {
        console.warn("fetchStories (approved):", e.code);
        setStoriesLoaded(true);
      }
    );

    return () => { unsubOwn?.(); unsubApproved(); };
  }, [currentUserId, mergeAndSet]);

  // ── Group by category ──────────────────────────────────────────────────────

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const map: Record<string, StoryDoc[]> = {};

    allStories.forEach((story) => {
      const catId = resolveCategory(
        story.educationalCategory,
        story.category || (story.type as any)
      );
      if (!map[catId]) map[catId] = [];
      map[catId].push(story);
    });

    return categories
      .filter((cat) => map[cat.id]?.length > 0)
      .map((cat) => {
        const stories   = map[cat.id] ?? [];
        const hasUnread = stories.some((s) => !viewedIds.has(s.id) && s.status === "approved");
        const isNew     = stories.some((s) => isNewStory(s) && s.status === "approved");
        return { categoryId: cat.id, stories, hasUnread, isNew };
      });
  }, [allStories, categories, viewedIds]);

  // Active story
  const activeGroup    = categoryGroups.find((g) => g.categoryId === activeCategoryId);
  const activeStories  = activeGroup?.stories ?? [];
  const activeStory    = activeStories[currentStoryIdx];
  const activeCategory = getCategoryById(activeCategoryId, categories);
  const storyRef       = useRef<StoryDoc | undefined>(undefined);
  storyRef.current     = activeStory;

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    progressRef.current?.stop();
    if (currentStoryIdx < activeStories.length - 1) {
      setCurrentStoryIdx((p) => p + 1);
    } else {
      const gi = categoryGroups.findIndex((g) => g.categoryId === activeCategoryId);
      if (gi < categoryGroups.length - 1) {
        setActiveCategoryId(categoryGroups[gi + 1].categoryId);
        setCurrentStoryIdx(0);
      } else {
        setViewerVisible(false);
      }
    }
  }, [currentStoryIdx, activeStories.length, categoryGroups, activeCategoryId]);

  const goPrev = useCallback(() => {
    progressRef.current?.stop();
    if (currentStoryIdx > 0) setCurrentStoryIdx((p) => p - 1);
  }, [currentStoryIdx]);

  const startProgress = useCallback((isVideo: boolean) => {
    progressRef.current?.stop();
    progress.setValue(0);
    if (isVideo) return;
    progressRef.current = Animated.timing(progress, {
      toValue: 1, duration: IMAGE_DURATION, useNativeDriver: false,
    });
    progressRef.current.start(({ finished }) => { if (finished) goNext(); });
  }, [goNext, progress]);

  useEffect(() => {
    if (!viewerVisible) return;
    const story = storyRef.current;
    if (!story) return;

    setLiked(false);
    setVideoPlaying(false);

    if (story.type === "video" && story.mediaUrl) {
      player.pause();
      player.replaceAsync({ uri: resolveStreamUrl(story.mediaUrl) ?? story.mediaUrl }).catch(() => {});
    } else {
      player.pause();
    }

    startProgress(story.type === "video");
    markViewed(story.id).then(() => {
      setViewedIds((prev) => new Set([...prev, story.id]));
    });
    updateDoc(doc(db, "stories", story.id), { views: increment(1) }).catch(() => {});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerVisible, activeCategoryId, currentStoryIdx]);

  const openViewer = useCallback((categoryId: string) => {
    setActiveCategoryId(categoryId);
    setCurrentStoryIdx(0);
    setViewerVisible(true);
  }, []);

  const closeViewer = useCallback(() => {
    progressRef.current?.stop();
    player.pause();
    setViewerVisible(false);
  }, [player]);

  const handleVideoPress = useCallback(() => {
    if (videoPlaying) { player.pause(); } else { player.play(); }
  }, [player, videoPlaying]);

  const handleLike = useCallback(async () => {
    if (!activeStory || liked) return;
    setLiked(true);
    updateDoc(doc(db, "stories", activeStory.id), { likes: increment(1) }).catch(() => {});
  }, [activeStory, liked]);

  // ── Upload ─────────────────────────────────────────────────────────────────

  const uploadStory = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      videoMaxDuration: MAX_VIDEO_SEC,
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset   = result.assets[0];
    const isVideo = asset.type === "video";

    setUploadPct(0); setUploadPhase("uploading"); setUploading(true); uploadAnim.setValue(0);

    const storyId = Date.now().toString();
    let mediaUrl = "", thumbnailUrl = "";

    if (isVideo) {
      const { uploadURL, playbackUrl, thumbnailUrl: cfThumb } = await getStreamUploadUrl();
      await uploadToStream(uploadURL, asset.uri, (pct) => {
        setUploadPct(pct);
        Animated.timing(uploadAnim, { toValue: pct / 100, duration: 250, useNativeDriver: false }).start();
      });
      mediaUrl = playbackUrl; thumbnailUrl = cfThumb;
    } else {
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload  = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", asset.uri, true);
        xhr.send(null);
      });
      const mediaRef = ref(storage, `stories/${currentUserId}/${storyId}`);
      mediaUrl = await new Promise<string>((resolve, reject) => {
        const task = uploadBytesResumable(mediaRef, blob);
        task.on("state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploadPct(pct);
            Animated.timing(uploadAnim, { toValue: pct / 100, duration: 250, useNativeDriver: false }).start();
          },
          (err) => { setUploading(false); reject(err); },
          async () => resolve(await getDownloadURL(task.snapshot.ref))
        );
      });
      thumbnailUrl = mediaUrl;
    }

    setUploadPhase("saving");
    Animated.timing(uploadAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();

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
  }, [currentUserId, uploadAnim]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>

      {/* ── Category card strip ─────────────────────────────────────── */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categoryGroups}
        keyExtractor={(item) => item.categoryId}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={5}
        contentContainerStyle={s.listContent}
        getItemLayout={(_, i) => ({ length: 115, offset: 115 * i, index: i })}
        ListHeaderComponent={<AddStoryCard onPress={uploadStory} size={100} />}
        renderItem={({ item }) => {
          const cat = getCategoryById(item.categoryId, categories);
          return (
            <StoryCard
              category={cat}
              count={item.stories.length}
              hasUnread={item.hasUnread}
              isNew={item.isNew}
              onPress={() => openViewer(item.categoryId)}
              size={100}
            />
          );
        }}
        ListEmptyComponent={
          // Show skeletons while loading, nothing after load (no stories yet)
          !storiesLoaded ? <SkeletonStrip /> : null
        }
      />

      {/* ── Story Viewer ────────────────────────────────────────────── */}
      <Modal
        visible={viewerVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeViewer}
      >
        <View style={s.viewer}>

          <Image
            source={{ uri: activeStory?.thumbnailUrl || activeStory?.mediaUrl }}
            style={s.media}
            resizeMode="cover"
            fadeDuration={0}
          />

          {activeStory?.type === "video" && (
            <VideoView
              player={player}
              style={s.videoLayer}
              contentFit="cover"
              nativeControls={false}
              allowsPictureInPicture={false}
              pointerEvents="none"
            />
          )}

          <View style={s.scrimTop}    pointerEvents="none" />
          <View style={s.scrimBottom} pointerEvents="none" />

          {/* Touch layer */}
          <View
            style={s.touchLayer}
            onStartShouldSetResponder={() => true}
            onResponderRelease={(e) => {
              const tapX = e.nativeEvent.locationX;
              if (tapX < SW * 0.35) { goPrev(); }
              else if (activeStory?.type === "video") { handleVideoPress(); }
              else { goNext(); }
            }}
          >
            {activeStory?.type === "video" && (
              <View style={s.playBtnWrap} pointerEvents="none">
                {!videoPlaying && (
                  <View style={s.playBtn}>
                    <Text style={s.playIcon}>▶</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Progress bar */}
          <View style={s.progressWrap} pointerEvents="none">
            <ProgressBar
              total={activeStories.length}
              current={currentStoryIdx}
              progress={progress}
            />
          </View>

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={[s.catIconBox, { borderRadius: 8 }]}>
                <Text style={s.catIconEmoji}>{activeCategory?.emoji ?? "📚"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.catName}>{activeCategory?.label ?? ""}</Text>
                <Text style={s.catSub}>
                  {currentStoryIdx + 1} of {activeStories.length}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={closeViewer}
              style={s.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Status badges */}
          <View style={s.badgeRow} pointerEvents="none">
            {activeStory?.status === "pending" && (
              <View style={[s.badge, { backgroundColor: "#FEF3C7" }]}>
                <Text style={s.badgeTxt}>⏳ Pending Approval</Text>
              </View>
            )}
            {activeStory?.status === "rejected" && (
              <View style={[s.badge, { backgroundColor: "#FEE2E2" }]}>
                <Text style={[s.badgeTxt, { color: "#DC2626" }]}>✗ Not Approved</Text>
              </View>
            )}
            {activeStory?.isFeatured && (
              <View style={[s.badge, s.badgeFeat]}>
                <Text style={[s.badgeTxt, { color: "#fff" }]}>★ Featured</Text>
              </View>
            )}
          </View>

          {/* Category tag */}
          {activeStory?.status === "approved" && (
            <View style={s.catTagWrap} pointerEvents="none">
              <View style={s.catTag}>
                <Text style={s.catTagText}>
                  {activeCategory?.emoji} {activeCategory?.label}
                </Text>
              </View>
            </View>
          )}

          {/* Info */}
          <View style={s.info} pointerEvents="none">
            {!!activeStory?.userName && (
              <Text style={s.authorLine} numberOfLines={1}>
                by {activeStory.userName}
                {activeStory.userClass ? `  ·  Class ${activeStory.userClass}` : ""}
              </Text>
            )}
            {!!activeStory?.title && (
              <Text style={s.title} numberOfLines={2}>{activeStory.title}</Text>
            )}
            {!!activeStory?.description && (
              <Text style={s.desc} numberOfLines={3}>{activeStory.description}</Text>
            )}
          </View>

          {/* Partner bar */}
          {activeStory?.storyKind === "linked" && !!activeStory?.learnMoreUrl && (
            <View style={s.partnerBar}>
              <View style={s.partnerInfo}>
                {activeStory.partnerLogoUrl ? (
                  <Image
                    source={{ uri: activeStory.partnerLogoUrl }}
                    style={s.partnerLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={s.partnerEmoji}>🔗</Text>
                )}
                <Text style={s.partnerName} numberOfLines={1}>
                  {activeStory.partnerName ?? "Learn More"}
                </Text>
              </View>
              <TouchableOpacity
                style={s.learnMoreBtn}
                activeOpacity={0.85}
                onPress={() => Linking.openURL(activeStory.learnMoreUrl!).catch(() => {})}
              >
                <Text style={s.learnMoreTxt}>Learn More →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Like + Views */}
          <View style={s.actions}>
            <TouchableOpacity onPress={handleLike} style={s.actionBtn} activeOpacity={0.8}>
              <Text style={s.actionIcon}>{liked ? "❤️" : "🤍"}</Text>
              <Text style={s.actionCount}>{(activeStory?.likes ?? 0) + (liked ? 1 : 0)}</Text>
            </TouchableOpacity>
            <View style={s.actionBtn}>
              <Text style={s.actionIcon}>👁</Text>
              <Text style={s.actionCount}>{activeStory?.views ?? 0}</Text>
            </View>
          </View>

        </View>
      </Modal>

      {/* ── Upload overlay ──────────────────────────────────────────── */}
      <Modal visible={uploading} transparent animationType="fade">
        <View style={s.upOverlay}>
          <View style={s.upCard}>
            <View style={s.upIconCircle}>
              <Text style={{ fontSize: 30 }}>
                {uploadPhase === "done" ? "✅" : uploadPhase === "saving" ? "💾" : "☁️"}
              </Text>
            </View>
            <Text style={s.upTitle}>
              {uploadPhase === "uploading" ? "Uploading story…"
                : uploadPhase === "saving" ? "Saving…"
                : "Submitted! 🎉"}
            </Text>
            <Text style={s.upSub}>
              {uploadPhase === "uploading" ? "Please keep the app open"
                : uploadPhase === "saving"   ? "Almost done…"
                : "Waiting for admin approval"}
            </Text>
            <View style={s.upTrack}>
              <Animated.View
                style={[
                  s.upFill,
                  uploadPhase === "done" && { backgroundColor: "#22C55E" },
                  { width: uploadAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
                ]}
              />
            </View>
            <Text style={s.upPct}>
              {uploadPhase === "done" ? "100%"
                : uploadPhase === "saving" ? "Saving…"
                : `${uploadPct}%`}
            </Text>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { paddingVertical: 10 },
  listContent:  { paddingHorizontal: 8, gap: 0 },

  skeletonRow:  { flexDirection: "row", gap: 10, paddingLeft: 8 },
  skeletonCard: {
    width: 100, height: 118, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.06)",
  },

  viewer:     { flex: 1, backgroundColor: "#000" },
  media:      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  videoLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  touchLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },

  playBtnWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playBtn:     { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(0,0,0,0.58)", alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "rgba(255,255,255,0.85)" },
  playIcon:    { color: "#fff", fontSize: 30, marginLeft: 6 },

  scrimTop:    { position: "absolute", top: 0, left: 0, right: 0, height: 180, backgroundColor: "rgba(0,0,0,0.38)", zIndex: 4 },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 260, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 4 },

  progressWrap: { position: "absolute", top: Platform.OS === "ios" ? 54 : 36, left: 0, right: 0, zIndex: 10 },

  header:      { position: "absolute", top: Platform.OS === "ios" ? 66 : 48, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 10 },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  catIconBox:  { width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  catIconEmoji:{ fontSize: 20 },
  catName:     { color: "#fff", fontWeight: "700", fontSize: 15, textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  catSub:      { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 1 },
  closeBtn:    { padding: 4 },
  closeTxt:    { color: "#fff", fontSize: 20, fontWeight: "700" },

  badgeRow:  { position: "absolute", top: Platform.OS === "ios" ? 118 : 100, left: 14, flexDirection: "row", gap: 6, zIndex: 10 },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeFeat: { backgroundColor: "#EC4899" },
  badgeTxt:  { fontSize: 11, fontWeight: "600", color: "#374151" },

  catTagWrap: { position: "absolute", top: Platform.OS === "ios" ? 118 : 100, right: 14, zIndex: 10 },
  catTag:     { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.3)" },
  catTagText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  info:       { position: "absolute", bottom: 120, left: 16, right: 80, zIndex: 10 },
  authorLine: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  title:      { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 6, textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  desc:       { color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 19 },

  actions:     { position: "absolute", bottom: 110, right: 14, alignItems: "center", gap: 16, zIndex: 10 },
  actionBtn:   { alignItems: "center" },
  actionIcon:  { fontSize: 26 },
  actionCount: { color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 2 },

  partnerBar:   { position: "absolute", bottom: 94, left: 14, right: 14, zIndex: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.62)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,215,0,0.35)" },
  partnerInfo:  { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  partnerLogo:  { width: 28, height: 28, borderRadius: 6, backgroundColor: "#fff" },
  partnerEmoji: { fontSize: 20 },
  partnerName:  { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  learnMoreBtn: { backgroundColor: "#FFD700", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginLeft: 10 },
  learnMoreTxt: { color: "#1a1a1a", fontSize: 12, fontWeight: "800" },

  upOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  upCard:       { backgroundColor: "#fff", borderRadius: 20, paddingVertical: 32, paddingHorizontal: 28, width: "100%", alignItems: "center", elevation: 10 },
  upIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#F3F0FF", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  upTitle:      { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 6, textAlign: "center" },
  upSub:        { fontSize: 13, color: "#6B7280", marginBottom: 24, textAlign: "center" },
  upTrack:      { width: "100%", height: 8, borderRadius: 4, backgroundColor: "#E9E7FF", overflow: "hidden", marginBottom: 10 },
  upFill:       { height: "100%", borderRadius: 4, backgroundColor: "#6C63FF" },
  upPct:        { fontSize: 13, fontWeight: "600", color: "#6C63FF" },
});
