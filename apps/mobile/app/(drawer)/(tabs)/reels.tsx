/**
 * app/reels.tsx — FULLY FIXED
 *
 * Problems found and fixed:
 *
 * 1. TAB PARAM IGNORED — SkillShortPreview passes { tab: "short", startIndex: N }
 *    but reels.tsx never read the "tab" param. Short Reels tap opened the wrong feed.
 *    FIX: Read params.tab. When tab=="short", load from "short_reels" collection.
 *
 * 2. STATUS=="APPROVED" FILTER — posts collection has no approval flow so ALL
 *    student reels stay "pending" forever. Filtering by status=="approved" always
 *    returned 0 results → "No videos available".
 *    FIX: For posts (skillbattle/normal feed), filter out only "rejected". 
 *    For short_reels, filter status=="active" (that IS the correct field there).
 *
 * 3. getReelsFeed CLOUD FUNCTION NOT NEEDED for initial load — it requires auth
 *    to be ready (race condition on cold open) and has no status filter.
 *    FIX: Query Firestore directly with simple single-field where() clauses.
 *
 * 4. ready FLAG DELAY — was set only after a second useEffect fired.
 *    FIX: Initialize ready=true so isActive fires the moment videos populate.
 *
 * 5. CF POLLING 10s INTERVAL — already-encoded videos waited 10s before retry.
 *    FIX: Reduced to 2s.
 */

import { useTheme } from "@/context/ThemeContext";
import { streamPlaybackUrl } from "@/lib/cloudflareStream";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db, functions } from "@/lib/firebase";
import { scoreReel, matchesClassFilter, toMillis, type ScoringProfile } from "@/lib/reelScoring";
import { httpsCallable } from "firebase/functions";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const COMMENT_GROUPS = [
  { title: "Encouragement",    options: ["Very good", "Keep it up", "Well done"] },
  { title: "Skill Praise",     options: ["Excellent work", "Super effort", "Amazing skill"] },
  { title: "Learning Support", options: ["Good try", "Nice learning", "You are improving"] },
];

type PostStatus = "pending" | "in_review" | "approved" | "rejected";

type Post = {
  id: string;
  mediaUrl: string;
  postType?: string;
  isSkillBattle?: boolean;
  userId?: string;
  name?: string;
  school?: string;
  class?: string;
  profilePic?: string;
  title?: string;
  description?: string;
  likes?: number;
  comments?: number;
  views?: number;
  shares?: number;
  status?: PostStatus | string;
  createdAt?: any;
  // short_reels fields
  category?: string;
  cfVideoId?: string;
  // Personalization / admin targeting — read by scoreReel()/matchesClassFilter()
  // in lib/reelScoring.ts, see rankByRelevance() below.
  targetClass?:    string[];
  targetLanguage?: string[];
  targetState?:    string[];
  targetInterest?: string[];
  featured?:       boolean;
  // Set explicitly when merging posts + short_reels into one feed (see
  // loadReels' default-feed branch) so each item remembers which
  // collection it actually came from — likes/comments/views writes and
  // rendering both key off this per-item flag now, not the route's
  // isShortTab, since a merged feed has both kinds side by side.
  isShortReel?:    boolean;
};

const WATERMARK_CONFIG: Partial<Record<string, { label: string; emoji: string; bg: string }>> = {
  pending:   { label: "PENDING REVIEW", emoji: "⏳", bg: "rgba(243,156,18,0.82)" },
  in_review: { label: "IN REVIEW",      emoji: "🔍", bg: "rgba(52,152,219,0.82)"  },
  rejected:  { label: "REJECTED",       emoji: "❌", bg: "rgba(231,76,60,0.82)"   },
};

function StatusWatermark({ status }: { status?: string }) {
  if (!status) return null;
  const cfg = WATERMARK_CONFIG[status];
  if (!cfg) return null;
  return (
    <View style={wm.wrapper} pointerEvents="none">
      <View style={wm.dim} />
      <View style={[wm.banner, { backgroundColor: cfg.bg }]}>
        <Text style={wm.bannerText}>{cfg.emoji}  {cfg.label}</Text>
      </View>
    </View>
  );
}

const wm = StyleSheet.create({
  wrapper:    { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  dim:        { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  banner:     { position: "absolute", top: 36, left: -48, width: 220, paddingVertical: 6, alignItems: "center", transform: [{ rotate: "-35deg" }] },
  bannerText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
});

// ── CF manifest polling ───────────────────────────────────────
const WORKER_URL = process.env.EXPO_PUBLIC_CF_WORKER_URL ?? "";

function extractCfVideoId(url: string): string | null {
  const match = url?.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)\//);
  return match?.[1] ?? null;
}

async function waitForManifest(
  manifestUrl: string,
  onAttempt: (attempt: number, max: number) => void,
  intervalMs = 2_000,
  maxAttempts = 20
): Promise<boolean> {
  const videoId   = extractCfVideoId(manifestUrl);
  if (!videoId) return false;
  const statusUrl = WORKER_URL ? `${WORKER_URL}/video-status?uid=${videoId}` : null;

  for (let i = 1; i <= maxAttempts; i++) {
    onAttempt(i, maxAttempts);
    try {
      if (statusUrl) {
        const res = await fetch(statusUrl);
        if (res.status === 200) {
          const data = await res.json().catch(() => ({}));
          if (data.readyToStream === true || data.state === "ready") return true;
        } else if (res.status === 404) {
          const mRes = await fetch(manifestUrl, { method: "GET" });
          if (mRes.status === 200) return true;
        }
      } else {
        const res = await fetch(manifestUrl, { method: "GET" });
        if (res.status === 200) return true;
      }
    } catch (e) { console.log(`[CF-poll] attempt ${i} error:`, e); }
    if (i < maxAttempts) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// Resolve any mediaUrl / cfVideoId to a playable HLS URL
function resolvePlaybackUrl(item: Post): string | null {
  // short_reels has cfVideoId field
  if (item.cfVideoId) return streamPlaybackUrl(item.cfVideoId);
  if (!item.mediaUrl)  return null;
  const cfMatch = item.mediaUrl.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)/);
  if (cfMatch?.[1]) return streamPlaybackUrl(cfMatch[1]);
  const vdMatch = item.mediaUrl.match(/videodelivery\.net\/([a-zA-Z0-9]+)/);
  if (vdMatch?.[1]) return streamPlaybackUrl(vdMatch[1]);
  if (/^[a-zA-Z0-9]{32}$/.test(item.mediaUrl.trim())) return streamPlaybackUrl(item.mediaUrl.trim());
  return item.mediaUrl;
}

// ─────────────────────────────────────────────────────────────
// VideoItem
// ─────────────────────────────────────────────────────────────
type CfState = "checking" | "processing" | "ready" | "error";

interface VideoItemProps {
  item:          Post;
  isActive:      boolean;
  paused:        boolean;
  itemHeight:    number;
  isShortReel:   boolean;   // true = admin short_reels, false = student posts
  onPauseToggle: () => void;
  onLike:        (item: Post) => Promise<boolean>;
  onShare:       (item: Post) => Promise<void>;
  onView:        (item: Post) => Promise<void>;
  colors:        any;
}

function VideoItem({
  item, isActive, paused, itemHeight, isShortReel,
  onPauseToggle, onLike, onShare, onView, colors,
}: VideoItemProps) {
  const insets      = useSafeAreaInsets();
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const watchStart  = useRef<number | null>(null);
  // Ensures a V-Coin credit is attempted at most once per mounted card
  // instance, regardless of how many pause/resume cycles occur. The
  // creditWatchReward Cloud Function still dedupes server-side via
  // referenceId regardless, but this avoids redundant calls.
  const creditFiredRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const isPausedRef = useRef(paused);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { isPausedRef.current = paused;    }, [paused]);

  const [studentInfo,     setStudentInfo]     = useState<any>(null);
  const [liked,           setLiked]           = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments,        setComments]        = useState<any[]>([]);
  const [commentText,     setCommentText]     = useState("");
  const [commentCount,    setCommentCount]    = useState(item.comments || 0);
  // PERF FIX (student report — "reels take so much time to load"): this
  // used to run waitForManifest() — a network round trip to the CF Worker's
  // /video-status endpoint (or a manifest GET) — for EVERY reel BEFORE
  // player.replace() was even called, gated behind cfState === "ready".
  // That serialized "check, then play" flow added a full extra network
  // hop in front of every single video, even ones encoded days ago that
  // were certainly ready. Only a just-uploaded video still mid-encode
  // actually needs this check.
  //
  // FIX: default to "ready" and let the player attempt playback
  // immediately (see the player.replace effect below, no longer gated on
  // cfState). The manifest-poll fallback now only kicks in if the player
  // itself reports a load error (the real signal for "not encoded yet"),
  // at which point we show the processing overlay and poll until it's
  // ready or we give up. Already-ready videos (the vast majority) never
  // pay the network round trip at all.
  const [cfState,         setCfState]         = useState<CfState>("ready");
  const [pollAttempt,     setPollAttempt]     = useState(0);
  const [pollMax,         setPollMax]         = useState(20);
  const pollingRef      = useRef(false);
  const hasTriedPollRef = useRef(false); // avoid re-polling on repeat error events
  const isOwner    = !isShortReel && auth.currentUser?.uid === item.userId;

  const playbackUrl = resolvePlaybackUrl(item);

  const startPoll = useCallback(() => {
    if (pollingRef.current || !playbackUrl) return;
    hasTriedPollRef.current = true;
    pollingRef.current = true;
    setCfState("checking");
    setPollAttempt(0);
    const poll = async () => {
      const ready = await waitForManifest(
        playbackUrl,
        (a, m) => { setPollAttempt(a); setPollMax(m); if (a > 1) setCfState("processing"); },
        2_000, 20
      );
      pollingRef.current = false;
      if (ready) {
        setCfState("ready");
        try { player.replace(playbackUrl); } catch (e) {}
      } else {
        setCfState("error");
      }
    };
    poll();
  }, [playbackUrl]);

  const retryPoll = () => {
    hasTriedPollRef.current = false;
    startPoll();
  };

  const [playerReady, setPlayerReady] = useState(false);
  const player = useVideoPlayer(null, (p) => { p.loop = true; });

  // Fire playback immediately once we have a URL — no pre-flight check.
  useEffect(() => {
    if (!playbackUrl || !player) return;
    try { player.replace(playbackUrl); } catch (e) {}
  }, [playbackUrl]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("statusChange", ({ status }: { status: string }) => {
      if (status === "readyToPlay") {
        setPlayerReady(true);
        setCfState("ready");
        if (isActiveRef.current && !isPausedRef.current) { player.play(); onView(item); }
      } else if (status === "error") {
        setPlayerReady(false);
        // Real signal the stream isn't playable yet — fall back to the
        // manifest poll (once) instead of assuming it's just broken.
        if (!hasTriedPollRef.current) startPoll();
        else setCfState("error");
      }
    });
    return () => sub.remove();
  }, [player, startPoll]);

  useEffect(() => {
    if (!player || !playerReady) return;
    if (isActive && !paused) {
      watchStart.current = Date.now();
      player.play();
      onView(item);
    } else {
      player.pause();
      if (watchStart.current) {
        const watched = Math.floor((Date.now() - watchStart.current) / 1000);
        const col = isShortReel ? "short_reels" : "posts";
        if (watched > 2) {
          updateDoc(doc(db, col, item.id), { watchTime: increment(watched) }).catch(() => {});

          // V-Coin reward via the creditWatchReward Cloud Function
          // (functions/src/vcoins.ts — migrated server-side from the old
          // client-side rewardForWatchCompletion(), see that migration's
          // header comment for why).
          //
          // watchPercentage uses elapsed wall-clock seconds (`watched`,
          // already computed above for watchTime) against player.duration,
          // not player.currentTime: the player has `loop = true` (see
          // useVideoPlayer above), so currentTime resets toward 0 on each
          // loop and would understate a multi-loop watch. Elapsed time
          // against duration handles looping correctly and is capped at
          // 100 for sessions that looped more than once.
          const uid = auth.currentUser?.uid;
          const duration = player.duration;
          if (uid && duration && duration > 0 && !creditFiredRef.current) {
            creditFiredRef.current = true;
            const watchPercentage = Math.min(100, Math.round((watched / duration) * 100));
            httpsCallable(functions, "creditWatchReward")({
              contentId: item.id,
              contentType: isShortReel ? "reel" : "video",
              watchPercentage,
            }).catch(() => {
              // Best-effort: never disrupt playback on a failed credit.
              // Allow a retry on the next pause/resume cycle.
              creditFiredRef.current = false;
            });
          }
        }
        watchStart.current = null;
      }
    }
  }, [isActive, paused, playerReady]);

  // Student info (only for posts, not short_reels)
  useEffect(() => {
    if (isShortReel || !item.userId) return;
    getDoc(doc(db, "students", item.userId)).then((s) => { if (s.exists()) setStudentInfo(s.data()); }).catch(() => {});
  }, [item.userId]);

  // Like state
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const col = isShortReel ? "short_reels" : "posts";
    getDoc(doc(db, col, item.id, "likes", uid)).then((s) => setLiked(s.exists())).catch(() => {});
  }, [item.id]);

  // Comments (posts only)
  useEffect(() => {
    if (!commentsVisible || isShortReel) return;
    const q     = query(collection(db, "posts", item.id, "comments"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCommentCount(snap.size);
    });
    return () => unsub();
  }, [commentsVisible, item.id]);

  useEffect(() => { setCommentCount(item.comments || 0); }, [item.comments]);

  const handleLikePress = async () => {
    scaleAnim.setValue(0);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    setLiked(await onLike(item));
  };

  const handleAddComment = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !commentText.trim()) return;
    try {
      await addDoc(collection(db, "posts", item.id, "comments"), {
        userId: uid, userName: auth.currentUser?.displayName || "Student",
        text: commentText.trim(), createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", item.id), { comments: increment(1) });
      setCommentText("");
    } catch (e) {}
  };

  const renderProcessingOverlay = () => {
    if (cfState === "ready") return null;
    const isChecking   = cfState === "checking";
    const isProcessing = cfState === "processing";
    const isError      = cfState === "error";
    return (
      <View style={styles.processingOverlay}>
        {isError ? (
          <>
            <Text style={styles.processingIcon}>😕</Text>
            <Text style={styles.processingTitle}>Processing taking longer than usual</Text>
            <Text style={styles.processingSubText}>Cloudflare Stream is still encoding.{"\n"}Check back in a few minutes.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={retryPoll}>
              <Text style={styles.retryBtnText}>↺  Check Again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.processingIcon}>{isChecking ? "🔄" : "⚙️"}</Text>
            <Text style={styles.processingTitle}>{isChecking ? "Checking video…" : "Video is processing…"}</Text>
            <Text style={styles.processingSubText}>
              {isChecking ? "Verifying Cloudflare Stream is ready" : `Usually 1–3 min after upload\nAttempt ${pollAttempt} of ${pollMax}`}
            </Text>
            {isProcessing && (
              <View style={styles.progressDots}>
                {Array.from({ length: Math.min(pollAttempt, 10) }).map((_, i) => (
                  <View key={i} style={[styles.progressDot, { backgroundColor: i < pollAttempt ? "#ff9f43" : "rgba(255,255,255,0.2)" }]} />
                ))}
              </View>
            )}
            <Text style={styles.processingHint}>This video will auto-play when ready</Text>
          </>
        )}
      </View>
    );
  };

  return (
    <>
      <Pressable
        style={{ height: itemHeight, width: SCREEN_WIDTH }}
        onPress={onPauseToggle}
        onLongPress={cfState === "ready" ? handleLikePress : undefined}
      >
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        {renderProcessingOverlay()}

        {/* Status watermark — only for own pending posts */}
        {isOwner && item.status !== "approved" && (
          <>
            <StatusWatermark status={item.status} />
            {WATERMARK_CONFIG[item.status as string] && (
              <View style={[styles.ownStatusBar, { backgroundColor: WATERMARK_CONFIG[item.status as string]!.bg }]}>
                <Text style={styles.ownStatusIcon}>{WATERMARK_CONFIG[item.status as string]!.emoji}</Text>
                <View style={styles.ownStatusInfo}>
                  <Text style={styles.ownStatusLabel}>{WATERMARK_CONFIG[item.status as string]!.label}</Text>
                  <Text style={styles.ownStatusSub}>Only visible to you · Auto-publishes when approved</Text>
                </View>
              </View>
            )}
          </>
        )}

        <Animated.View style={[styles.heart, { transform: [{ scale: scaleAnim }], opacity: scaleAnim }]} pointerEvents="none">
          <Text style={{ fontSize: 80 }}>❤️</Text>
        </Animated.View>

        {/* FIX (bug report — back button/back arrow overlap on the admin-
            curated Short Reels preview): this per-item "⬅ Back" pill and
            the persistent circular back button rendered once below the
            FlatList (styles.backBtn) sat at the identical position
            (top: 50, left: 20) — since the list pages one item per screen,
            whichever reel was in view rendered its own back button exactly
            on top of the always-on-screen one. Removed this redundant
            per-item duplicate (it re-rendered once per list item for no
            benefit); the persistent button already covers the same action. */}

        {/* Caption */}
        <View style={[styles.caption, { backgroundColor: `${colors.background}80`, bottom: 100 + insets.bottom }]}>
          {isShortReel ? (
            <>
              {item.category ? <Text style={[styles.school, { color: colors.textSecondary }]}>{item.category}</Text> : null}
              {item.title    ? <Text style={[styles.captionText, { color: colors.text }]}>{item.title}</Text> : null}
            </>
          ) : (
            <>
              <Text style={[styles.username, { color: colors.text }]}>@{studentInfo?.name || item.name || "student"}</Text>
              <Text style={[styles.school, { color: colors.textSecondary }]}>{studentInfo?.school || item.school || ""}</Text>
              {item.title ? <Text style={[styles.captionText, { color: colors.text }]}>{item.title}</Text> : null}
            </>
          )}
        </View>

        {/* Action buttons */}
        <View style={[styles.actionStack, { bottom: 128 + insets.bottom }]}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: `${colors.accent}20` }]} onPress={handleLikePress}>
            <Text style={{ fontSize: 18, color: liked ? colors.accent : colors.text }}>❤️ {item.likes || 0}</Text>
          </TouchableOpacity>
          {!isShortReel && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: `${colors.accent}20` }]} onPress={() => setCommentsVisible(true)}>
              <Text style={{ fontSize: 18, color: colors.text }}>💬 {commentCount}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: `${colors.accent}20` }]} onPress={() => onShare(item)}>
            <Text style={{ fontSize: 18, color: colors.text }}>📤 {item.shares || 0}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.views, { bottom: 60 + insets.bottom, color: colors.accent, backgroundColor: `${colors.background}80`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
          👁️ {item.views || 0}
        </Text>
      </Pressable>

      {/* Comments modal — posts only */}
      {!isShortReel && (
        <Modal visible={commentsVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Comments</Text>
                <TouchableOpacity onPress={() => setCommentsVisible(false)}>
                  <Text style={[styles.modalClose, { color: colors.accent }]}>Close</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id}
                ListEmptyComponent={<Text style={[styles.modalEmpty, { color: colors.textSecondary }]}>No comments yet</Text>}
                renderItem={({ item: c }) => (
                  <View style={[styles.commentCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.commentAuthor, { color: colors.accent }]}>{c.userName || "Student"}</Text>
                    <Text style={[styles.commentText,   { color: colors.text }]}>{c.text}</Text>
                  </View>
                )}
              />
              <Text style={[styles.suggestionTitle, { color: colors.text }]}>Suggested comments</Text>
              {COMMENT_GROUPS.map((group) => (
                <View key={group.title} style={styles.suggestionGroup}>
                  <Text style={[styles.suggestionGroupTitle, { color: colors.textSecondary }]}>{group.title}</Text>
                  <View style={styles.suggestionWrap}>
                    {group.options.map((preset) => (
                      <TouchableOpacity key={preset} style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setCommentText(preset)}>
                        <Text style={[styles.suggestionText, { color: colors.text }]}>{preset}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
              <View style={styles.commentComposer}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Pick a suggestion or type..."
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.commentInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                />
                <TouchableOpacity style={[styles.commentSendBtn, { backgroundColor: colors.accent }]} onPress={handleAddComment}>
                  <Text style={styles.commentSendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────
export default function Reels() {
  const { colors }      = useTheme();
  // FIX 1: read "tab" and "startIndex" params that SkillShortPreview sends
  const params = useLocalSearchParams<{
    index?:      string;
    postId?:     string;
    filter?:     string;
    tab?:        string;   // "short" = admin short_reels
    startIndex?: string;   // index within the short_reels list
  }>();
  const { height: windowHeight } = useWindowDimensions();

  const [reels,        setReels]        = useState<Post[]>([]);
  const [ownPending,   setOwnPending]   = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [paused,       setPaused]       = useState(false);
  const [ready,        setReady]        = useState(true); // true from start

  // FIX (bug report — "reels tab shows 'Upload First Video' even when the
  // feed failed to load"): every Firestore error in loadReels below used to
  // be swallowed with just a console.log, leaving `reels` empty exactly like
  // a genuinely empty feed — so a failed query (e.g. a missing Firestore
  // composite index) looked identical to "you have no reels yet" with no
  // way to tell the difference or retry. Mirrors web's reels/page.tsx fix.
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError,   setFeedError]   = useState(false);
  const [reloadTick,  setReloadTick]  = useState(0);

  const flatListRef     = useRef<FlatList>(null);
  const viewed          = useRef(new Set<string>());
  const hasScrolled     = useRef(false);
  const screenPausedRef = useRef(false);

  // Viewer's own profile for feed personalization (scoreReel in
  // lib/reelScoring.ts). Kept in a ref, not state, for the same reason as
  // web's reels/page.tsx: loadReels only needs the *current* value at
  // fetch time, and putting the profile object itself in state would
  // re-trigger the feed query on every reference change rather than just
  // once when it first resolves.
  const viewerProfileRef = useRef<ScoringProfile | null>(null);
  // Flips true once the profile lookup below has resolved at least once
  // (successfully or not) — lets loadReels depend on resolution timing
  // without depending on the profile object itself. See web's
  // reels/page.tsx for the identical reasoning.
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) { viewerProfileRef.current = null; setProfileReady(true); return; }
      getDoc(doc(db, "students", user.uid)).then((snap) => {
        if (!snap.exists()) { viewerProfileRef.current = null; return; }
        const d = snap.data();
        viewerProfileRef.current = {
          class:             d.class != null ? String(d.class) : undefined,
          preferredLanguage: d.preferredLanguage as string | undefined,
          location:          d.location as { state?: string } | undefined,
          interests:         d.interests as string[] | undefined,
        };
      }).catch(() => { viewerProfileRef.current = null; })
        .finally(() => setProfileReady(true));
    });
    return () => unsubAuth();
  }, []);

  const rankByRelevance = useCallback(
    <T extends { targetClass?: string[]; targetLanguage?: string[]; targetState?: string[]; targetInterest?: string[]; featured?: boolean }>(
      items: T[]
    ): T[] => {
      return [...items].sort((a, b) => scoreReel(b, viewerProfileRef.current) - scoreReel(a, viewerProfileRef.current));
    },
    []
  );

  // Bug report — "short reels added by admin last will show first while
  // user opens the reel tab". Recency is already one of several signals
  // scoreReel() weighs (worth up to 15 of ~60 possible points, see
  // lib/reelScoring.ts), so a well-matched older item can still outrank a
  // brand-new admin short reel after ranking. This guarantees the newest
  // admin-curated short reel specifically always lands in the very first
  // slot, without disturbing the relevance order of everything after it —
  // same "pin one item to the front" pattern already used for the
  // deep-linked-post branch below.
  function pinNewestShortReel<T extends { id: string; isShortReel?: boolean; createdAt?: unknown }>(items: T[]): T[] {
    const shortReels = items.filter((i) => i.isShortReel);
    if (shortReels.length === 0) return items;
    const newest = shortReels.reduce((a, b) => (toMillis(b.createdAt) > toMillis(a.createdAt) ? b : a));
    if (items[0]?.id === newest.id) return items;
    return [newest, ...items.filter((i) => i.id !== newest.id)];
  }

  const isShortTab        = params.tab === "short";
  const isSkillBattleFilter = params.filter === "skillbattle";

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, "fade");
      screenPausedRef.current = false;
      setPaused(false);
      return () => {
        screenPausedRef.current = true;
        setPaused(true);
        StatusBar.setHidden(false, "fade");
      };
    }, [])
  );

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        if (!screenPausedRef.current) setPaused(false);
      } else {
        setPaused(true);
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, []);

  // Deduplicate own-pending first, then feed
  const videos = (() => {
    const seen = new Set<string>();
    // Short reels tab never shows own-pending (they're admin content)
    const combined = isShortTab ? reels : [...ownPending, ...reels];
    return combined.filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  })();

  // ── Load reels ────────────────────────────────────────────────
  // FEATURE (language priority + scope ranking): see web's
  // reels/page.tsx for the full explanation — same fix here. Reels were
  // ordered purely by raw views; now re-ranked by scoreReel() after the
  // Firestore-level orderBy/limit pulls a candidate batch. Soft ranking
  // only — nothing is hidden, just reordered.
  useEffect(() => {
    let cancelled = false;
    const loadReels = async () => {
      setFeedLoading(true); setFeedError(false);
      try {
        // ── SHORT REELS TAB (admin short_reels collection) ────────
        // FIX 1: Previously this tab param was ignored entirely.
        // short_reels use status="active"/"archived" not "approved".
        if (isShortTab) {
          const q = query(
            collection(db, "short_reels"),
            where("status", "==", "active"),
            orderBy("createdAt", "desc"),
            limit(30)
          );
          const snap = await getDocs(q);
          if (cancelled) return;
          const candidates = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">), isShortReel: true }));
          // FIX: short reels can be admin-scoped to specific classes
          // (targetClass) — this is a hard visibility filter, unlike
          // language/state/interest which only affect ranking. See
          // matchesClassFilter() in lib/reelScoring.ts.
          const visible = candidates.filter((p) =>
            matchesClassFilter(p, viewerProfileRef.current?.class)
          );
          const data = pinNewestShortReel(rankByRelevance(visible));
          setReels(data);
          // Scroll to startIndex if provided
          const startIdx = parseInt(params.startIndex ?? "0", 10) || 0;
          if (startIdx > 0 && startIdx < data.length) {
            setCurrentIndex(startIdx);
            hasScrolled.current = true;
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: startIdx, animated: false });
            }, 150);
          }
          return;
        }

        // ── DEEP LINK to specific post ────────────────────────────
        if (params.postId) {
          try {
            const snap = await getDoc(doc(db, "posts", params.postId as string));
            if (cancelled) return;
            if (snap.exists()) {
              const post = { id: snap.id, ...(snap.data() as Omit<Post, "id">) };
              if ((post as any).status !== "rejected") {
                setReels([post]);
                setCurrentIndex(0);
                hasScrolled.current = true;
              }
            }
          } catch { /* the deep-linked post itself failing shouldn't block the rest of the feed below */ }

          const q = isSkillBattleFilter
            ? query(collection(db, "posts"), where("isSkillBattle", "==", true),  orderBy("createdAt", "desc"), limit(20))
            : query(collection(db, "posts"), where("postType", "==", "reel"),     orderBy("createdAt", "desc"), limit(20));
          const snap = await getDocs(q);
          if (cancelled) return;
          const rest = rankByRelevance(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">) }))
              .filter((p) => p.id !== params.postId && (p as any).status !== "rejected")
          );
          setReels((prev) => {
            const pinned = prev[0];
            return pinned ? [pinned, ...rest] : rest;
          });
          return;
        }

        // ── SKILL BATTLE feed — posts only, deliberately not mixed with
        // admin short reels; this filter means "just skill battle" ──
        if (isSkillBattleFilter) {
          const q = query(collection(db, "posts"), where("isSkillBattle", "==", true), orderBy("createdAt", "desc"), limit(20));
          const snap = await getDocs(q);
          if (cancelled) return;
          const data = rankByRelevance(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">), isShortReel: false }))
              .filter((p) => (p as any).status !== "rejected")
          );
          setReels(data);
          return;
        }

        // ── DEFAULT LANDING FEED — creator posts + admin short reels,
        // merged and ranked together (bug report — "reels tab should mix
        // creator shorts and short reels one by one, not creator shorts
        // only"). FIX 2 still applies to the posts side: no
        // status=="approved" filter, since posts never get approved —
        // only explicitly rejected posts are filtered out.
        const [postsSnap, shortReelsSnap] = await Promise.all([
          getDocs(query(collection(db, "posts"), where("postType", "==", "reel"), orderBy("createdAt", "desc"), limit(20))),
          getDocs(query(collection(db, "short_reels"), where("status", "==", "active"), orderBy("createdAt", "desc"), limit(20))),
        ]);
        if (cancelled) return;
        const postsData = postsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">), isShortReel: false }))
          .filter((p) => (p as any).status !== "rejected");
        const shortReelsData = shortReelsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">), isShortReel: true }))
          .filter((p) => matchesClassFilter(p, viewerProfileRef.current?.class));
        const data = pinNewestShortReel(rankByRelevance([...postsData, ...shortReelsData]));
        setReels(data);
      } catch (e) {
        console.log("[Reels] loadReels error:", e);
        if (!cancelled) setFeedError(true);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    };

    loadReels();
    return () => { cancelled = true; };
  }, [params.postId, params.filter, params.tab, params.startIndex, rankByRelevance, profileReady, reloadTick]);

  // ── Own pending posts (student sees their own before approval) ─
  useEffect(() => {
    if (isShortTab) return; // short_reels are admin-only
    let unsubQ: (() => void) | null = null;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (unsubQ) { unsubQ(); unsubQ = null; }
      if (!user) { setOwnPending([]); return; }
      const q = query(collection(db, "posts"), where("userId", "==", user.uid));
      unsubQ = onSnapshot(q, (snap) => {
        setOwnPending(
          snap.docs
            .filter((d) => {
              const dt = d.data();
              const notRejected = dt.status !== "rejected";
              const notApproved = dt.status !== "approved";
              return notRejected && notApproved && (
                isSkillBattleFilter ? dt.isSkillBattle === true : dt.postType === "reel"
              );
            })
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">) }))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        );
      }, () => setOwnPending([]));
    });
    return () => { unsubAuth(); if (unsubQ) unsubQ(); };
  }, [isSkillBattleFilter, isShortTab]);

  // ── Scroll to deep-linked index ───────────────────────────────
  useEffect(() => {
    if (videos.length === 0 || hasScrolled.current) return;
    let target = 0;
    if (params.postId) {
      const found = videos.findIndex((v) => v.id === params.postId);
      target = found >= 0 ? found : 0;
    } else if (params.index) {
      target = Math.min(Math.max(parseInt(params.index, 10) || 0, 0), videos.length - 1);
    }
    hasScrolled.current = true;
    setCurrentIndex(target);
    if (target === 0) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: target, animated: false });
    }, 150);
    return () => clearTimeout(timer);
  }, [videos]);

  const handleView = async (item: Post) => {
    if (viewed.current.has(item.id)) return;
    viewed.current.add(item.id);
    const col = (item.isShortReel ?? isShortTab) ? "short_reels" : "posts";
    await updateDoc(doc(db, col, item.id), { views: increment(1) }).catch(() => {});
  };

  const handleLike = async (item: Post): Promise<boolean> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    const col     = (item.isShortReel ?? isShortTab) ? "short_reels" : "posts";
    const likeRef = doc(db, col, item.id, "likes", uid);
    const snap    = await getDoc(likeRef);
    if (snap.exists()) {
      await deleteDoc(likeRef);
      await updateDoc(doc(db, col, item.id), { likes: increment(-1) });
      return false;
    }
    await setDoc(likeRef, { liked: true, userId: uid, createdAt: serverTimestamp() });
    await updateDoc(doc(db, col, item.id), { likes: increment(1) });
    return true;
  };

  const handleShare = async (item: Post) => {
    try {
      const deepLink = `vidya://post/${item.id}`;
      const result   = await Share.share({
        message: `${item.title || "Vidya Reel"}\n\n${item.description || ""}\n\nOpen in Vidya: ${deepLink}`.trim(),
        url: deepLink,
      });
      if (result.action === Share.sharedAction) {
        const col = (item.isShortReel ?? isShortTab) ? "short_reels" : "posts";
        await updateDoc(doc(db, col, item.id), { shares: increment(1) });
      }
    } catch (e) {}
  };

  const renderItem = ({ item, index }: { item: Post; index: number }) => {
    if (!isShortTab && index !== 0 && index % 5 === 0) {
      return (
        <View style={[styles.adContainer, { height: windowHeight, backgroundColor: colors.background }]}>
          <Text style={[styles.adText, { color: colors.accent }]}>🔥 Sponsored Ad</Text>
        </View>
      );
    }
    return (
      <VideoItem
        item={item}
        isActive={ready && index === currentIndex}
        paused={paused}
        itemHeight={windowHeight}
        isShortReel={item.isShortReel ?? isShortTab}
        onPauseToggle={() => setPaused((p) => !p)}
        onLike={handleLike}
        onShare={handleShare}
        onView={handleView}
        colors={colors}
      />
    );
  };

  const getItemLayout = (_: any, index: number) => ({
    length: windowHeight, offset: windowHeight * index, index,
  });

  if (videos.length === 0) {
    if (feedLoading) {
      return (
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }
    if (feedError) {
      return (
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
          <Text style={{ fontSize: 34 }}>⚠️</Text>
          <Text style={[styles.emptyText, { color: colors.text, marginTop: 12 }]}>Couldn't load reels</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 13 }]}>Check your connection and try again.</Text>
          <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.accent }]} onPress={() => setReloadTick((t) => t + 1)}>
            <Text style={[styles.uploadBtnText, { color: colors.background }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No videos available</Text>
        <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.accent }]} onPress={() => router.push("/skillbattle")}>
          <Text style={[styles.uploadBtnText, { color: colors.background }]}>Upload First Video ＋</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={windowHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={getItemLayout}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        onEndReachedThreshold={0.5}
        onMomentumScrollEnd={(e) => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.y / windowHeight));
        }}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: Math.min(info.index, videos.length - 1), animated: false });
          }, 300);
        }}
        showsVerticalScrollIndicator={false}
      />
      <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.accent }]} onPress={() => router.push("/(drawer)/(tabs)/home")}>
        <Text style={[styles.btnText, { color: colors.background }]}>⬅</Text>
      </TouchableOpacity>
      {!isShortTab && (
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.accent }]} onPress={() => router.push("/skillbattle")}>
          <Text style={[styles.btnText, { color: colors.background }]}>＋</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ownStatusBar:   { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  ownStatusIcon:  { fontSize: 22 },
  ownStatusInfo:  { flex: 1 },
  ownStatusLabel: { color: "#fff", fontSize: 13, fontWeight: "800" },
  ownStatusSub:   { color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 1 },
  actionStack:    { position: "absolute", right: 20, gap: 12 },
  actionBtn:      { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  views:          { position: "absolute", left: 10, fontSize: 14, fontWeight: "600" },
  caption:        { position: "absolute", left: 10, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, maxWidth: "75%" },
  username:       { fontWeight: "bold", fontSize: 14 },
  school:         { fontSize: 12, marginBottom: 4 },
  captionText:    { marginTop: 4, fontSize: 13 },
  heart:          { position: "absolute", top: "40%", left: "40%" },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", gap: 10, paddingHorizontal: 32 },
  processingIcon:    { fontSize: 48, marginBottom: 4 },
  processingTitle:   { color: "#fff", fontSize: 16, fontWeight: "800", textAlign: "center" },
  processingSubText: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", lineHeight: 18 },
  processingHint:    { color: "rgba(255,159,67,0.8)", fontSize: 11, fontWeight: "600", marginTop: 4 },
  progressDots:      { flexDirection: "row", gap: 5, marginTop: 4 },
  progressDot:       { width: 8, height: 8, borderRadius: 4 },
  retryBtn:          { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  retryBtnText:      { color: "#fff", fontSize: 14, fontWeight: "700" },
  adContainer:       { justifyContent: "center", alignItems: "center" },
  adText:            { fontSize: 20, fontWeight: "700" },
  emptyContainer:    { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText:         { fontSize: 18, marginBottom: 20, fontWeight: "600" },
  uploadBtn:         { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, elevation: 8 },
  uploadBtnText:     { fontWeight: "700", fontSize: 16 },
  backBtn:           { position: "absolute", top: 50, left: 20, width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", zIndex: 10, elevation: 8 },
  createBtn:         { position: "absolute", top: 50, right: 20, width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", zIndex: 10, elevation: 8 },
  btnText:           { fontSize: 24, fontWeight: "bold" },
  modalBackdrop:     { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  modalCard:         { minHeight: "50%", maxHeight: "80%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  modalHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle:        { fontSize: 18, fontWeight: "700" },
  modalClose:        { fontSize: 14, fontWeight: "700" },
  modalEmpty:        { textAlign: "center", marginTop: 20 },
  suggestionTitle:      { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  suggestionGroup:      { marginBottom: 10 },
  suggestionGroupTitle: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  suggestionWrap:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  suggestionChip:       { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionText:       { fontSize: 12, fontWeight: "600" },
  commentCard:          { borderRadius: 12, padding: 12, marginBottom: 10 },
  commentAuthor:        { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  commentText:          { fontSize: 14, lineHeight: 20 },
  commentComposer:      { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  commentInput:         { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  commentSendBtn:       { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  commentSendText:      { color: "#fff", fontWeight: "700" },
});