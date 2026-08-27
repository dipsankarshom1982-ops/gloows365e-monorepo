"use client";

// PATH: apps/web/src/app/reels/page.tsx
// Mirrors mobile app/(drawer)/(tabs)/reels.tsx — full-screen vertical reel
// feed, now with the bottom tab bar overlaid (Instagram-style), matching
// mobile since reels.tsx moved into mobile's tab layout. Lives OUTSIDE the
// (app) route group on purpose: still needs to escape AppHeader/Drawer for
// the immersive full-bleed video layout, but renders <BottomNav /> itself
// (nested inside the feed's own zIndex:2000 container, since BottomNav's
// z-index:100 would otherwise sit underneath the video) instead of relying
// on (app)/layout.tsx's copy.
//
// FIX (bug report — "reels not showing after tapping from home"): this file
// previously lived at apps/web/src/reels/page.tsx, OUTSIDE the Next.js
// app-router folder (apps/web/src/app/). Next.js only creates routes for
// page.tsx files placed under src/app/, so /reels had no matching route and
// 404'd whenever home pushed to it. Moved here, under src/app/reels/, to
// register the route. No component logic changed.
//
// Supports the same query params mobile sends from preview cards:
//   ?tab=short              -> admin short_reels collection
//   ?postId=<id>             -> deep link to a specific post, feed fills in after
//   ?filter=skillbattle      -> posts where isSkillBattle == true
//   ?startIndex=<n>          -> scroll position within the short_reels tab
//   ?index=<n>               -> scroll position within the normal feed
//
// Web-specific adaptations:
//   - FlatList paging -> CSS scroll-snap (scroll-snap-type: y mandatory)
//   - expo-video -> native <video> + hls.js (same pattern as Story.tsx)
//   - Share.share -> navigator.share with clipboard fallback
//   - Modal -> fixed-position overlay div
//
// NOTE: needs the `hls.js` package (see components/Story.tsx for the same
// dependency note) for playback in Chrome/Firefox.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/layout/AuthGuard";
import BottomNav from "@/components/layout/BottomNav";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import {
  streamPlaybackUrl,
  waitForManifest,
} from "@/lib/cloudflareStream";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { scoreReel, matchesClassFilter, toMillis, type ScoringProfile } from "@/lib/reelScoring";
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

// ─── Constants ──────────────────────────────────────────────────────────────
const COMMENT_GROUPS = [
  { title: "Encouragement",    options: ["Very good", "Keep it up", "Well done"] },
  { title: "Skill Praise",     options: ["Excellent work", "Super effort", "Amazing skill"] },
  { title: "Learning Support", options: ["Good try", "Nice learning", "You are improving"] },
];

type PostStatus = "pending" | "in_review" | "approved" | "rejected";

interface Post {
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
}

const WATERMARK_CONFIG: Partial<Record<string, { label: string; emoji: string; bg: string }>> = {
  pending:   { label: "PENDING REVIEW", emoji: "⏳", bg: "rgba(243,156,18,0.82)" },
  in_review: { label: "IN REVIEW",      emoji: "🔍", bg: "rgba(52,152,219,0.82)" },
  rejected:  { label: "REJECTED",       emoji: "❌", bg: "rgba(231,76,60,0.82)" },
};

// Resolve any mediaUrl / cfVideoId to a playable HLS URL
function resolvePlaybackUrl(item: Post): string | null {
  if (item.cfVideoId) return streamPlaybackUrl(item.cfVideoId);
  if (!item.mediaUrl) return null;
  const cfMatch = item.mediaUrl.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)/);
  if (cfMatch?.[1]) return streamPlaybackUrl(cfMatch[1]);
  const vdMatch = item.mediaUrl.match(/videodelivery\.net\/([a-zA-Z0-9]+)/);
  if (vdMatch?.[1]) return streamPlaybackUrl(vdMatch[1]);
  if (/^[a-zA-Z0-9]{32}$/.test(item.mediaUrl.trim())) return streamPlaybackUrl(item.mediaUrl.trim());
  return item.mediaUrl;
}

type CfState = "checking" | "processing" | "ready" | "error";

// ─── Single reel — video + overlay UI ──────────────────────────────────────
function ReelItem({
  item, isActive, paused, isShortReel,
  onPauseToggle, onLike, onShare, onView, onBack, colors,
}: {
  item: Post; isActive: boolean; paused: boolean; isShortReel: boolean;
  onPauseToggle: () => void;
  onLike: (item: Post) => Promise<boolean>;
  onShare: (item: Post) => Promise<void>;
  onView: (item: Post) => Promise<void>;
  onBack: () => void;
  colors: { background: string; text: string; textSecondary: string; accent: string; card: string; border: string };
}) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const hlsRef       = useRef<any>(null);
  const watchStart    = useRef<number | null>(null);
  const isActiveRef    = useRef(isActive);
  const isPausedRef    = useRef(paused);
  const pollingRef      = useRef(false);
  const viewFiredRef    = useRef(false);
  // Separate from viewFiredRef: a view fires on watch-start, this fires
  // once watch-completion has been credited, so pausing and resuming the
  // same reel several times doesn't attempt multiple credits client-side.
  // The creditWatchReward Cloud Function still dedupes server-side via
  // referenceId regardless, but this avoids redundant network calls.
  const creditFiredRef  = useRef(false);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { isPausedRef.current = paused;    }, [paused]);

  const [studentInfo,     setStudentInfo]     = useState<any>(null);
  const [liked,            setLiked]           = useState(false);
  const [heartBurst,       setHeartBurst]      = useState(false);
  const [commentsVisible,  setCommentsVisible] = useState(false);
  const [comments,         setComments]        = useState<any[]>([]);
  const [commentText,      setCommentText]     = useState("");
  const [commentCount,     setCommentCount]    = useState(item.comments || 0);
  const [cfState,          setCfState]         = useState<CfState>("checking");
  const [pollAttempt,      setPollAttempt]     = useState(0);
  const [pollMax,          setPollMax]         = useState(20);
  const [playerReady,      setPlayerReady]     = useState(false);

  const isOwner = !isShortReel && auth.currentUser?.uid === item.userId;
  const playbackUrl = resolvePlaybackUrl(item);

  const startPoll = useCallback(() => {
    if (pollingRef.current || !playbackUrl) return;
    const poll = async () => {
      pollingRef.current = true;
      setCfState("checking");
      const ready = await waitForManifest(
        playbackUrl,
        (a, m) => { setPollAttempt(a); setPollMax(m); if (a > 1) setCfState("processing"); },
        2_000, 20
      );
      pollingRef.current = false;
      setCfState(ready ? "ready" : "error");
    };
    poll();
  }, [playbackUrl]);

  useEffect(() => { setPollAttempt(0); startPoll(); }, [playbackUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach HLS source once CF reports ready
  useEffect(() => {
    const video = videoRef.current;
    if (cfState !== "ready" || !playbackUrl || !video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
      setPlayerReady(true);
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(playbackUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => setPlayerReady(true));
        } else {
          video.src = playbackUrl;
          setPlayerReady(true);
        }
      }).catch(() => { video.src = playbackUrl; setPlayerReady(true); });
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [cfState, playbackUrl]);

  // Play/pause + watch-time tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playerReady) return;
    if (isActive && !paused) {
      watchStart.current = Date.now();
      video.play().catch(() => {});
      if (!viewFiredRef.current) { viewFiredRef.current = true; onView(item); }
    } else {
      video.pause();
      if (watchStart.current) {
        const watched = Math.floor((Date.now() - watchStart.current) / 1000);
        const col = isShortReel ? "short_reels" : "posts";
        if (watched > 2) {
          updateDoc(doc(db, col, item.id), { watchTime: increment(watched) }).catch(() => {});

          // V-Coin reward via the creditWatchReward Cloud Function
          // (functions/src/vcoins.ts) — migrated server-side from the old
          // client-side creditVCoins() since firestore.rules now blocks
          // direct client writes to vCoinsBalance (see that migration's
          // header comment). short_reels (admin-curated) -> contentType
          // "reel", posts (student uploads, including skill-battle reels)
          // -> "video" — matches the daily-limit split already defined
          // there (30/day vs 50/day).
          //
          // watchPercentage: video.duration is standard on HTMLVideoElement
          // and should be populated by now (playback already started above)
          // — falls back to 100 if it's ever NaN/0/unavailable so a watch
          // that clears the >2s bar isn't blocked by a missing duration
          // read, matching this effect's original "no percentage gate,
          // just >2s" behavior as closely as the Cloud Function's minimum
          // (80%) threshold allows.
          const uid = auth.currentUser?.uid;
          if (uid && !creditFiredRef.current) {
            creditFiredRef.current = true;
            const duration = video.duration;
            const watchPercentage = duration && Number.isFinite(duration) && duration > 0
              ? Math.min(100, Math.round((watched / duration) * 100))
              : 100;
            // Dedup key includes the collection so the same id can't
            // collide between short_reels and posts (ids are generated
            // independently per collection, so a collision is unlikely
            // but not impossible — this makes it definitionally safe).
            httpsCallable(functions, "creditWatchReward")({
              contentId: `${col}_${item.id}`,
              contentType: isShortReel ? "reel" : "video",
              watchPercentage,
            }).catch(() => {
              // Best-effort: a failed credit should never disrupt playback
              // or surface an error to the student mid-reel. Allow a retry
              // on the next pause/resume cycle rather than giving up for
              // the lifetime of this card instance.
              creditFiredRef.current = false;
            });
          }
        }
        watchStart.current = null;
      }
    }
  }, [isActive, paused, playerReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Student info (posts only)
  useEffect(() => {
    if (isShortReel || !item.userId) return;
    getDoc(doc(db, "students", item.userId)).then((s) => { if (s.exists()) setStudentInfo(s.data()); }).catch(() => {});
  }, [item.userId, isShortReel]);

  // Like state
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const col = isShortReel ? "short_reels" : "posts";
    getDoc(doc(db, col, item.id, "likes", uid)).then((s) => setLiked(s.exists())).catch(() => {});
  }, [item.id, isShortReel]);

  // Comments (posts only)
  useEffect(() => {
    if (!commentsVisible || isShortReel) return;
    const q = query(collection(db, "posts", item.id, "comments"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCommentCount(snap.size);
    });
    return () => unsub();
  }, [commentsVisible, item.id, isShortReel]);

  useEffect(() => { setCommentCount(item.comments || 0); }, [item.comments]);

  const handleLikePress = async () => {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 600);
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
    } catch { /* ignore */ }
  };

  const watermarkCfg = WATERMARK_CONFIG[item.status as string];

  return (
    <div style={{
      height: "100dvh", width: "100%", position: "relative",
      scrollSnapAlign: "start", scrollSnapStop: "always",
      background: "#000", overflow: "hidden", flexShrink: 0,
    }}>
      <div
        style={{ position: "absolute", inset: 0, cursor: "pointer" }}
        onClick={onPauseToggle}
        onDoubleClick={cfState === "ready" ? handleLikePress : undefined}
      >
        <video
          ref={videoRef}
          loop
          playsInline
          muted={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* Processing / error overlay */}
        {cfState !== "ready" && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.82)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 10, padding: "0 32px", textAlign: "center",
          }}>
            {cfState === "error" ? (
              <>
                <span style={{ fontSize: 48 }}>😕</span>
                <span style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>Processing taking longer than usual</span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.5 }}>
                  Cloudflare Stream is still encoding.<br/>Check back in a few minutes.
                </span>
                <button
                  onClick={startPoll}
                  style={{ marginTop: 12, padding: "10px 24px", borderRadius: 20, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >↺ Check Again</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 48 }}>{cfState === "checking" ? "🔄" : "⚙️"}</span>
                <span style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>
                  {cfState === "checking" ? "Checking video…" : "Video is processing…"}
                </span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.5 }}>
                  {cfState === "checking" ? "Verifying Cloudflare Stream is ready" : `Usually 1–3 min after upload\nAttempt ${pollAttempt} of ${pollMax}`}
                </span>
                {cfState === "processing" && (
                  <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                    {Array.from({ length: Math.min(pollAttempt, 10) }).map((_, i) => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < pollAttempt ? "#ff9f43" : "rgba(255,255,255,0.2)" }}/>
                    ))}
                  </div>
                )}
                <span style={{ color: "rgba(255,159,67,0.8)", fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                  This video will auto-play when ready
                </span>
              </>
            )}
          </div>
        )}

        {/* Own-pending watermark */}
        {isOwner && item.status !== "approved" && watermarkCfg && (
          <>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)", pointerEvents: "none" }}/>
            <div style={{
              position: "absolute", top: 36, left: -48, width: 220, paddingBlock: 6,
              display: "flex", justifyContent: "center", transform: "rotate(-35deg)",
              background: watermarkCfg.bg, pointerEvents: "none",
            }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 900, letterSpacing: 0.8 }}>
                {watermarkCfg.emoji} {watermarkCfg.label}
              </span>
            </div>
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
              background: watermarkCfg.bg,
            }}>
              <span style={{ fontSize: 22 }}>{watermarkCfg.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>{watermarkCfg.label}</div>
                <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 1 }}>Only visible to you · Auto-publishes when approved</div>
              </div>
            </div>
          </>
        )}

        {/* Heart burst on double-tap/like */}
        {heartBurst && (
          <div style={{ position: "absolute", top: "40%", left: "40%", pointerEvents: "none" }}>
            <span style={{ fontSize: 80, animation: "reel-heart-burst 0.6s ease-out" }}>❤️</span>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={(e) => { e.stopPropagation(); onBack(); }}
          style={{
            position: "absolute", top: 50, left: 20, zIndex: 10,
            display: "flex", alignItems: "center", gap: 6,
            background: `${colors.accent}20`, borderRadius: 8, padding: "8px 12px", border: "none", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 18, color: colors.accent }}>⬅</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: colors.accent }}>Back</span>
        </button>

        {/* Caption */}
        <div style={{
          position: "absolute", left: 10, bottom: 100, paddingInline: 8, paddingBlock: 6,
          borderRadius: 8, maxWidth: "75%", background: `${colors.background}80`,
        }}>
          {isShortReel ? (
            <>
              {item.category && <div style={{ fontSize: 12, marginBottom: 4, color: colors.textSecondary }}>{item.category}</div>}
              {item.title && <div style={{ marginTop: 4, fontSize: 13, color: colors.text }}>{item.title}</div>}
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>@{studentInfo?.name || item.name || "student"}</div>
              <div style={{ fontSize: 12, marginBottom: 4, color: colors.textSecondary }}>{studentInfo?.school || item.school || ""}</div>
              {item.title && <div style={{ marginTop: 4, fontSize: 13, color: colors.text }}>{item.title}</div>}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ position: "absolute", right: 20, bottom: 128, display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleLikePress(); }}
            style={{ borderRadius: 8, padding: "8px 10px", background: `${colors.accent}20`, border: "none", cursor: "pointer" }}
          >
            <span style={{ fontSize: 18, color: liked ? colors.accent : colors.text }}>❤️ {item.likes || 0}</span>
          </button>
          {!isShortReel && (
            <button
              onClick={(e) => { e.stopPropagation(); setCommentsVisible(true); }}
              style={{ borderRadius: 8, padding: "8px 10px", background: `${colors.accent}20`, border: "none", cursor: "pointer" }}
            >
              <span style={{ fontSize: 18, color: colors.text }}>💬 {commentCount}</span>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onShare(item); }}
            style={{ borderRadius: 8, padding: "8px 10px", background: `${colors.accent}20`, border: "none", cursor: "pointer" }}
          >
            <span style={{ fontSize: 18, color: colors.text }}>📤 {item.shares || 0}</span>
          </button>
        </div>

        <span style={{
          position: "absolute", left: 10, bottom: 60, color: colors.accent,
          background: `${colors.background}80`, paddingInline: 8, paddingBlock: 4, borderRadius: 6, fontSize: 14, fontWeight: 600,
        }}>
          👁️ {item.views || 0}
        </span>
      </div>

      {/* Comments overlay — posts only */}
      {!isShortReel && commentsVisible && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={() => setCommentsVisible(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              minHeight: "50%", maxHeight: "80%", borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: 16, background: colors.background, overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>Comments</span>
              <button onClick={() => setCommentsVisible(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: colors.accent }}>Close</span>
              </button>
            </div>

            {comments.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 20, color: colors.textSecondary }}>No comments yet</div>
            )}
            {comments.map((c) => (
              <div key={c.id} style={{ borderRadius: 12, padding: 12, marginBottom: 10, background: colors.card }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: colors.accent }}>{c.userName || "Student"}</div>
                <div style={{ fontSize: 14, lineHeight: 1.4, color: colors.text }}>{c.text}</div>
              </div>
            ))}

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: colors.text }}>Suggested comments</div>
            {COMMENT_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: colors.textSecondary }}>{group.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  {group.options.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setCommentText(preset)}
                      style={{ border: `1px solid ${colors.border}`, borderRadius: 999, padding: "8px 12px", background: colors.card, cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{preset}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Pick a suggestion or type..."
                style={{ flex: 1, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "10px 12px", background: colors.card, color: colors.text }}
              />
              <button
                onClick={handleAddComment}
                style={{ borderRadius: 12, padding: "12px 14px", background: colors.accent, border: "none", cursor: "pointer" }}
              >
                <span style={{ color: "#fff", fontWeight: 700 }}>Send</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// FIX (bug report — "close app, reopen, reels/stories don't load"): the
// reel feed load below was a single getDocs() call wrapped in try/catch
// { /* ignore */ } with no retry. onSnapshot listeners elsewhere in the
// app reconnect on their own after a network hiccup, but a one-shot
// getDocs() doesn't get a second chance — if it fails once (very plausible
// right after a mobile browser resumes from being backgrounded: the OS may
// have torn down sockets, DNS/auth token may need a beat to catch up),
// `reels` just stays [] forever with zero indication anything went wrong.
// The page then rendered its normal "No videos available" empty state,
// indistinguishable from an actually-empty feed. This helper retries a
// failed read a couple of times with a short backoff before giving up.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 600): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

// ─── Main page ──────────────────────────────────────────────────────────────
function ReelsContent() {
  const { colors } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const indexParam      = searchParams.get("index");
  const postIdParam     = searchParams.get("postId");
  const filterParam     = searchParams.get("filter");
  const tabParam        = searchParams.get("tab");
  const startIndexParam = searchParams.get("startIndex");

  const isShortTab          = tabParam === "short";
  const isSkillBattleFilter = filterParam === "skillbattle";

  const [reels,        setReels]        = useState<Post[]>([]);
  const [ownPending,   setOwnPending]   = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused,       setPaused]       = useState(false);
  const [feedLoading,  setFeedLoading]  = useState(true);
  const [feedError,    setFeedError]    = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewed        = useRef(new Set<string>());
  const hasScrolled    = useRef(false);

  // Viewer's own profile for feed personalization (scoreReel in
  // lib/reelScoring.ts). Kept in a ref rather than state: the feed-loading
  // effect below only needs the *current* value at fetch time, not a
  // reactive dependency — putting it in state would re-trigger the feed
  // query every time the profile object reference changes, which isn't
  // useful here (the viewer's class/language/state rarely change mid
  // scroll session, and if they do, the *next* fetch picks it up anyway).
  const viewerProfileRef = useRef<ScoringProfile | null>(null);
  // Flips true once the auth/profile lookup above has resolved at least
  // once (successfully or not) — used as a loadReels dependency so the
  // very first feed fetch isn't permanently stuck using a null profile if
  // it happens to run before the async getDoc() above resolves. Boolean,
  // not the profile object itself, so this only re-triggers the feed fetch
  // once (on first resolution), not on every subsequent profile read.
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

  // Pause when tab loses focus, resume on return
  useEffect(() => {
    const handleVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const videos = useMemo(() => {
    const seen = new Set<string>();
    const combined = isShortTab ? reels : [...ownPending, ...reels];
    return combined.filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [isShortTab, reels, ownPending]);

  const scrollToIndex = (idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * el.clientHeight, behavior: "auto" });
  };

  // ── Load reels ──────────────────────────────────────────────────────────
  //
  // FEATURE (language priority + scope ranking): reels here used to be
  // ordered purely by raw `views` (orderBy("views","desc")) — completely
  // unpersonalized, unlike the home-page preview strip (ShortVideos.tsx),
  // which already re-ranks by class/language/state/interest match via
  // scoreReel(). This effect now does the same: each branch still uses
  // Firestore's orderBy/limit to pull a reasonable candidate batch (so we
  // don't fetch the whole collection client-side), then re-sorts that
  // batch by scoreReel() before it ever reaches state. Nothing is hidden —
  // a post the viewer doesn't match well on (wrong language, wrong state)
  // still appears, just lower in the feed. See lib/reelScoring.ts for the
  // exact point scale and the product decision behind it (soft ranking,
  // not a hard filter, for both language and state).
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

  // Bumping this re-runs loadReels below — used by the manual Retry button
  // and by the visibility-regain effect further down.
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadReels = async () => {
      setFeedLoading(true); setFeedError(false);
      try {
        if (isShortTab) {
          const q = query(
            collection(db, "short_reels"),
            where("status", "==", "active"),
            orderBy("createdAt", "desc"),
            limit(30)
          );
          const snap = await withRetry(() => getDocs(q));
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
          const startIdx = parseInt(startIndexParam ?? "0", 10) || 0;
          if (startIdx > 0 && startIdx < data.length) {
            setCurrentIndex(startIdx);
            hasScrolled.current = true;
            setTimeout(() => scrollToIndex(startIdx), 150);
          }
          return;
        }

        if (postIdParam) {
          try {
            const snap = await withRetry(() => getDoc(doc(db, "posts", postIdParam)));
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
            ? query(collection(db, "posts"), where("isSkillBattle", "==", true), orderBy("createdAt", "desc"), limit(20))
            : query(collection(db, "posts"), where("postType", "==", "reel"),    orderBy("createdAt", "desc"), limit(20));
          const snap = await withRetry(() => getDocs(q));
          if (cancelled) return;
          const rest = rankByRelevance(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">) }))
              .filter((p) => p.id !== postIdParam && (p as any).status !== "rejected")
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
          const snap = await withRetry(() => getDocs(q));
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
        // only"). No status=="approved" filter on the posts side, since
        // posts never get approved — only explicitly rejected posts are
        // filtered out.
        const [postsSnap, shortReelsSnap] = await Promise.all([
          withRetry(() => getDocs(query(collection(db, "posts"), where("postType", "==", "reel"), orderBy("createdAt", "desc"), limit(20)))),
          withRetry(() => getDocs(query(collection(db, "short_reels"), where("status", "==", "active"), orderBy("createdAt", "desc"), limit(20)))),
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
      } catch {
        // All retries exhausted — surface this as a real error state
        // rather than silently leaving `reels` empty (see withRetry comment
        // above for why this used to look identical to "genuinely no reels").
        if (!cancelled) setFeedError(true);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    };

    loadReels();
    return () => { cancelled = true; };
  }, [postIdParam, filterParam, tabParam, startIndexParam, isShortTab, isSkillBattleFilter, rankByRelevance, profileReady, reloadTick]);

  // FIX (bug report — "close app, reopen, reels/stories don't load"): the
  // feed above only ever loaded once per param change. If that one load
  // happened to fail right as the tab was resuming from the background
  // (see withRetry comment), nothing ever retried again until a hard
  // reload. Re-trigger the load when the tab becomes visible again, but
  // only if we don't already have reels showing — this is a recovery path
  // for a stuck/failed feed, not a refresh-every-time-you-tab-back.
  useEffect(() => {
    const handleVisible = () => {
      if (!document.hidden && reels.length === 0 && !feedLoading) {
        setReloadTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [reels.length, feedLoading]);

  // ── Own pending posts ───────────────────────────────────────────────────
  useEffect(() => {
    if (isShortTab) { setOwnPending([]); return; }
    let unsubQ: (() => void) | null = null;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      unsubQ?.(); unsubQ = null;
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
    return () => { unsubAuth(); unsubQ?.(); };
  }, [isSkillBattleFilter, isShortTab]);

  // ── Scroll to deep-linked index ─────────────────────────────────────────
  useEffect(() => {
    if (videos.length === 0 || hasScrolled.current) return;
    let target = 0;
    if (postIdParam) {
      const found = videos.findIndex((v) => v.id === postIdParam);
      target = found >= 0 ? found : 0;
    } else if (indexParam) {
      target = Math.min(Math.max(parseInt(indexParam, 10) || 0, 0), videos.length - 1);
    }
    hasScrolled.current = true;
    setCurrentIndex(target);
    if (target === 0) return;
    const timer = setTimeout(() => scrollToIndex(target), 150);
    return () => clearTimeout(timer);
  }, [videos, postIdParam, indexParam]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    setCurrentIndex(idx);
  };

  const handleView = async (item: Post) => {
    if (viewed.current.has(item.id)) return;
    viewed.current.add(item.id);
    const col = (item.isShortReel ?? isShortTab) ? "short_reels" : "posts";
    await updateDoc(doc(db, col, item.id), { views: increment(1) }).catch(() => {});
  };

  const handleLike = async (item: Post): Promise<boolean> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    const col = (item.isShortReel ?? isShortTab) ? "short_reels" : "posts";
    const likeRef = doc(db, col, item.id, "likes", uid);
    const snap = await getDoc(likeRef);
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
    const deepLink = `https://gloows365.in/reels?postId=${item.id}`;
    const shareText = `${item.title || "Vidya Reel"}\n\n${item.description || ""}\n\nWatch on Gloows365E: ${deepLink}`.trim();
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title || "Vidya Reel", text: shareText, url: deepLink });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      const col = (item.isShortReel ?? isShortTab) ? "short_reels" : "posts";
      await updateDoc(doc(db, col, item.id), { shares: increment(1) });
    } catch { /* user cancelled share — not an error */ }
  };

  if (videos.length === 0) {
    // FIX (bug report — "close app, reopen, reels/stories don't load"):
    // this used to render the exact same "No videos available" message
    // whether the feed was genuinely empty, still loading, or had just
    // failed to load — no way to tell the difference, and no way to retry
    // a failure short of a full page reload.
    if (feedLoading) {
      return (
        <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.background }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${colors.border}`, borderTop: `3px solid ${colors.accent}`, borderRadius: "50%", animation: "reels-spin 0.8s linear infinite" }}/>
          <style>{`@keyframes reels-spin { to { transform: rotate(360deg); } }`}</style>
          <BottomNav />
        </div>
      );
    }
    if (feedError) {
      return (
        <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: colors.background, padding: 24, textAlign: "center" }}>
          <span style={{ fontSize: 34 }}>⚠️</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Couldn't load reels</span>
          <span style={{ fontSize: 13, color: colors.textSecondary, maxWidth: 260 }}>Check your connection and try again.</span>
          <button
            onClick={() => setReloadTick((t) => t + 1)}
            style={{ padding: "12px 24px", borderRadius: 12, background: colors.accent, border: "none", cursor: "pointer" }}
          >
            <span style={{ fontWeight: 700, fontSize: 15, color: colors.background }}>Retry</span>
          </button>
          <BottomNav />
        </div>
      );
    }
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: colors.background }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: colors.textSecondary }}>No videos available</span>
        <button
          onClick={() => router.push("/battle")}
          style={{ padding: "14px 24px", borderRadius: 12, background: colors.accent, border: "none", cursor: "pointer" }}
        >
          <span style={{ fontWeight: 700, fontSize: 16, color: colors.background }}>Upload First Video ＋</span>
        </button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 2000 }}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: "100dvh", overflowY: "auto", scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
        }}
      >
        {videos.map((item, idx) => {
          if (!isShortTab && idx !== 0 && idx % 5 === 0) {
            return (
              <div
                key={`ad-${idx}`}
                style={{
                  height: "100dvh", scrollSnapAlign: "start", display: "flex",
                  alignItems: "center", justifyContent: "center", background: colors.background,
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 700, color: colors.accent }}>🔥 Sponsored Ad</span>
              </div>
            );
          }
          return (
            <ReelItem
              key={item.id}
              item={item}
              isActive={idx === currentIndex}
              paused={paused}
              isShortReel={item.isShortReel ?? isShortTab}
              onPauseToggle={() => setPaused((p) => !p)}
              onLike={handleLike}
              onShare={handleShare}
              onView={handleView}
              onBack={() => router.push("/home")}
              colors={colors}
            />
          );
        })}
      </div>

      {!isShortTab && (
        <button
          onClick={() => router.push("/battle")}
          style={{
            position: "absolute", top: 50, right: 20, width: 50, height: 50, borderRadius: 25,
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
            background: colors.accent, border: "none", cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: colors.background }}>＋</span>
        </button>
      )}

      <BottomNav />
    </div>
  );
}

export default function ReelsPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div style={{ height: "100dvh", background: "#000" }}/>
      }>
        <ReelsContent />
      </Suspense>
    </AuthGuard>
  );
}
