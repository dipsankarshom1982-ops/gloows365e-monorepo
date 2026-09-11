"use client";

// PATH: apps/web/src/app/create-reel/page.tsx
// Port of mobile's app/Createreelscreen.tsx — full skill-battle reel
// upload flow: eligibility check, "My Submissions" tracker (max 4 per
// battle), video picker, caption (for language auto-detection) + scope
// picker (Pan-India vs own state — soft feed-ranking only, see
// lib/reelScoring.ts), step-by-step upload progress, rules box.
//
// FIX (bug report — "upload reel not working on web"): the "🚀 Upload Reel"
// button on app/(app)/battle/page.tsx had NO onClick handler at all —
// clicking it did nothing. The whole upload screen mobile has
// (Createreelscreen.tsx) was simply never built on web, even though the
// underlying infra (lib/cloudflareStream.ts's uploadToStream, the Worker
// proxy) was already there and ready to use. This page is that missing
// screen, wired up to battle/page.tsx's button via router.push.
//
// Lives OUTSIDE the (app) route group on purpose, same reasoning as
// app/reels/page.tsx — this is a focused full-screen task, not a tab.
//
// Web adaptations from mobile:
//   - expo-image-picker -> <input type="file" accept="video/*">
//   - expo-video-thumbnails -> <video> + <canvas> frame capture
//   - expo-router useLocalSearchParams -> next/navigation useSearchParams
//   - Alert.alert -> inline error/success banners (no native alert blocking UI)
//   - Animated progress bar -> CSS transition (same visual effect)
//   - getStreamUploadUrl() + uploadToStream(url, uri, ...) (mobile's 2-step,
//     since mobile needs a URL string before it can stream a local file://
//     URI) -> web's uploadToStream(file, onProgress, title) already does
//     both steps in one call (the browser already holds the File in memory
//     from the <input> picker), so there's no equivalent first step needed.
//   - studentProfile is read via useStudentProfile() (shared-logic), not a
//     fresh students/{uid} getDoc — web already has this hook everywhere
//     else, no need to re-fetch what's already in context.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDoc, collection, getDocs, onSnapshot, query, serverTimestamp, where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useStudentProfile } from "@gloows/shared-logic";
import AuthGuard from "@/components/layout/AuthGuard";
import { useTheme } from "@/context/ThemeContext";
import { auth, db, storage } from "@/lib/firebase";
import { uploadToStream } from "@/lib/cloudflareStream";
import { detectPostLanguage } from "@/lib/detectPostLanguage";

// ─── Types ───────────────────────────────────────────────────
type PostStatus = "pending" | "in_review" | "approved" | "rejected";

interface MyPost {
  id: string;
  mediaUrl: string;
  thumbnail: string;
  status: PostStatus;
  createdAt: any;
  rejectionReason?: string;
}

const STATUS_CONFIG: Record<
  PostStatus,
  { emoji: string; label: string; color: string; bg: string; description: string }
> = {
  pending: {
    emoji: "⏳", label: "Pending Review", color: "#f39c12", bg: "#f39c1218",
    description: "Waiting to be reviewed by our team.",
  },
  in_review: {
    emoji: "🔍", label: "In Review", color: "#3498db", bg: "#3498db18",
    description: "Our team is currently reviewing your reel.",
  },
  approved: {
    emoji: "✅", label: "Approved", color: "#2ecc71", bg: "#2ecc7118",
    description: "Your reel is live in the battle feed!",
  },
  rejected: {
    emoji: "❌", label: "Rejected", color: "#e74c3c", bg: "#e74c3c18",
    description: "Your reel did not meet the guidelines.",
  },
};

const ELIGIBLE_CLASSES = ["6", "7", "8", "9", "10", "11", "12"];

// ─── Post limit check (mirrors mobile exactly) ────────────────
const checkPostLimit = async (battleId: string, uid: string): Promise<boolean> => {
  const q = query(
    collection(db, "posts"),
    where("battleId", "==", battleId),
    where("userId", "==", uid),
    where("status", "not-in", ["rejected"])
  );
  const snap = await getDocs(q);
  return snap.size < 4;
};

// ─── Upload phases ─────────────────────────────────────────────
type UploadPhase = "idle" | "uploading" | "thumb" | "saving";

const accent = "#ff9f43"; // sponsored only — matches mobile

function CreateReelContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { colors } = useTheme();
  const { studentProfile } = useStudentProfile();

  const battleId    = params.get("battleId")    ?? "";
  const battleTitle = params.get("battleTitle") ?? "";
  const battleType  = params.get("battleType")  ?? "";
  const month       = params.get("month")       ?? "";

  const student = studentProfile as any; // shared-logic's type doesn't fully declare `location` — see battle/page.tsx for the same cast
  const studentClass = student?.class != null ? String(student.class) : "";
  const notEligible = !!studentClass && !ELIGIBLE_CLASSES.includes(studentClass);

  // ── State ──────────────────────────────────────────────────
  const [videoFile, setVideoFile]   = useState<File | null>(null);
  const [videoUrl, setVideoUrl]     = useState<string | null>(null); // local object URL for preview
  const [thumbnail, setThumbnail]   = useState<string | null>(null); // data URL, captured from <video> frame
  const [loading, setLoading]       = useState(false);
  const [phase, setPhase]           = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [myPosts, setMyPosts]       = useState<MyPost[]>([]);
  const [showMyPosts, setShowMyPosts] = useState(true);
  const [caption, setCaption]       = useState("");
  const [scope, setScope]           = useState<"pan_india" | "state">("pan_india");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoElRef    = useRef<HTMLVideoElement>(null);

  // ── Real-time: my posts in this battle ────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !battleId) return;

    const q = query(
      collection(db, "posts"),
      where("battleId", "==", battleId),
      where("userId", "==", uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const posts: MyPost[] = snap.docs.map((d) => ({
        id: d.id,
        mediaUrl: d.data().mediaUrl ?? "",
        thumbnail: d.data().thumbnail ?? "",
        status: (d.data().status as PostStatus) ?? "pending",
        createdAt: d.data().createdAt,
        rejectionReason: d.data().rejectionReason ?? "",
      }));
      posts.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setMyPosts(posts);
    });

    return () => unsub();
  }, [battleId]);

  // Revoke the preview object URL when it's replaced/unmounted, to avoid
  // leaking blob URLs (no equivalent cleanup needed on mobile, since
  // file:// URIs aren't memory-backed the way object URLs are).
  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); };
  }, [videoUrl]);

  // ── Pick video ─────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setThumbnail(null);
    setErrorMsg(null);
  };

  // Captures a frame from the <video> element as a thumbnail, once enough
  // of the video has loaded to seek — the web equivalent of mobile's
  // expo-video-thumbnails. Non-fatal if it fails (matches mobile's
  // try/catch around getThumbnailAsync).
  const captureThumbnail = () => {
    const videoEl = videoElRef.current;
    if (!videoEl) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth || 360;
      canvas.height = videoEl.videoHeight || 640;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      setThumbnail(canvas.toDataURL("image/jpeg", 0.85));
    } catch { /* non-fatal — falls back to Cloudflare's own thumbnail */ }
  };

  // ── Upload reel ────────────────────────────────────────────
  const uploadReel = async () => {
    const uid = auth.currentUser?.uid;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!uid)         { setErrorMsg("Please login first.");                                          return; }
    if (!student)     { setErrorMsg("Profile not found.");                                            return; }
    if (!videoFile)   { setErrorMsg("Please select a video.");                                        return; }
    if (notEligible)  { setErrorMsg("Not eligible — only Class 6–12 students can upload skill reels."); return; }
    if (!battleId)    { setErrorMsg("No battle selected.");                                            return; }

    const allowed = await checkPostLimit(battleId, uid);
    if (!allowed) { setErrorMsg("You've reached the max 4 reels for this battle."); return; }

    setLoading(true);
    setPhase("uploading");
    setUploadProgress(0);

    try {
      // ── Step 1: Upload video to Cloudflare Stream via Worker proxy ──
      // (Web's uploadToStream already covers what mobile splits into
      // getStreamUploadUrl + uploadToStream — see file header.)
      const uploadResult = await uploadToStream(
        videoFile,
        (pct) => setUploadProgress(Math.round(pct)),
        battleTitle || "Vidya Reel"
      );

      const finalPlaybackUrl  = uploadResult.playbackUrl;
      const finalVideoId      = uploadResult.uid;
      let thumbUrl            = uploadResult.thumbnailUrl;

      // ── Step 2: Upload thumbnail to Firebase Storage ────────────
      setPhase("thumb");
      if (thumbnail) {
        try {
          const thumbBlob = await fetch(thumbnail).then((r) => r.blob());
          const thumbRef = ref(storage, `thumbnails/${uid}/${Date.now()}_thumb.jpg`);
          await new Promise<void>((resolve) => {
            const task = uploadBytesResumable(thumbRef, thumbBlob, { contentType: "image/jpeg" });
            task.on("state_changed", undefined,
              () => resolve(), // non-fatal — keep Cloudflare's own thumbnail
              async () => {
                try { thumbUrl = await getDownloadURL(task.snapshot.ref); } catch { /* keep CF thumb */ }
                resolve();
              }
            );
          });
        } catch { /* non-fatal — using CF thumb */ }
      }

      // ── Step 3: Save post document to Firestore ─────────────────
      setPhase("saving");

      const detectedLanguage = detectPostLanguage(caption, student.preferredLanguage);
      const targetState: string[] =
        scope === "state" && student.location?.state ? [student.location.state] : ["All"];

      await addDoc(collection(db, "posts"), {
        userId: uid,
        name: student.name ?? "",
        school: student.school ?? "",
        class: studentClass,
        profilePic: student.profilePic ?? "",
        battleId, battleTitle, battleType, isSkillBattle: true,
        postType: "reel", month,
        caption: caption.trim(),
        targetState,
        targetLanguage: [detectedLanguage],
        location: {
          city: student.location?.city ?? "",
          district: student.location?.district ?? "",
          state: student.location?.state ?? "",
          pincode: student.location?.pincode ?? "",
          country: "India",
        },
        mediaUrl: finalPlaybackUrl,
        thumbnail: thumbUrl ?? "",
        status: "pending",
        rejectionReason: "",
        reviewedAt: null,
        reviewedBy: "",
        likes: 0, views: 0, shares: 0, comments: 0, watchTime: 0,
        createdAt: serverTimestamp(),
      });

      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoFile(null);
      setVideoUrl(null);
      setThumbnail(null);
      setCaption("");
      setScope("pan_india");
      setShowMyPosts(true);
      setSuccessMsg("🎉 Submitted! Your reel is pending admin review. Track its status in 'My Submissions' below.");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setLoading(false);
      setPhase("idle");
    }
  };

  const phaseLabel = (() => {
    switch (phase) {
      case "uploading": return `📤 Uploading video... ${uploadProgress}%`;
      case "thumb":     return "🖼️ Saving thumbnail...";
      case "saving":    return "💾 Saving your reel...";
      default:          return "";
    }
  })();
  const showProgressBar = phase === "uploading";
  const showSpinner     = phase === "thumb" || phase === "saving";

  // ── Not eligible screen ────────────────────────────────────
  if (notEligible) {
    return (
      <div style={{ minHeight: "100dvh", background: colors.background }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, background: "none", border: "none", cursor: "pointer", color: colors.text }}>
          <span style={{ fontSize: 18 }}>←</span><span style={{ fontSize: 15, fontWeight: 600 }}>Back</span>
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 30, minHeight: "70vh" }}>
          <span style={{ fontSize: 50 }}>🔒</span>
          <div style={{ fontSize: 22, fontWeight: 900, textAlign: "center", color: colors.text }}>Not Eligible</div>
          <div style={{ fontSize: 14, fontWeight: 500, textAlign: "center", lineHeight: 1.6, color: colors.textSecondary }}>
            Skill Battle is only available for<br/>students in Class 6 to 12.
            <br/><br/>You are currently in Class {studentClass || "unknown"}.
          </div>
          <button onClick={() => router.back()} style={{ padding: "12px 24px", borderRadius: 12, marginTop: 8, background: colors.accent, border: "none", cursor: "pointer" }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>← Back to Battles</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: colors.background, paddingBottom: 40 }}>
      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, background: "none", border: "none", cursor: "pointer", color: colors.text }}>
        <span style={{ fontSize: 18 }}>←</span><span style={{ fontSize: 15, fontWeight: 600 }}>Back</span>
      </button>

      {/* Battle banner */}
      <div style={{
        margin: "0 16px 14px", borderRadius: 18, padding: 16,
        background: "linear-gradient(135deg, #2a1500, #1a0e00)",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        <span style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: 20, marginBottom: 4, background: accent }}>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>🏅 Sponsored Battle</span>
        </span>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 900, lineHeight: 1.3 }}>{battleTitle}</div>
        {month && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>📅 {month}</div>}
      </div>

      {/* Student card */}
      {student && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 16px 12px", padding: 12, borderRadius: 14, background: colors.card, border: `1px solid ${colors.border}` }}>
          {student.profilePic ? (
            <img src={student.profilePic} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}20` }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: accent }}>{(student.name?.[0] ?? "S").toUpperCase()}</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{student.name}</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary, marginTop: 1 }}>
              {student.school} · Class {studentClass}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary, marginTop: 1 }}>
              📍 {student.location?.district}, {student.location?.state}
            </div>
          </div>
          <span style={{ padding: "4px 8px", borderRadius: 8, background: `${accent}18`, border: `1px solid ${accent}35` }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: accent }}>✅ Eligible</span>
          </span>
        </div>
      )}

      {/* My Submissions tracker */}
      {myPosts.length > 0 && (
        <div style={{ margin: "0 16px 14px", borderRadius: 14, overflow: "hidden", background: colors.card, border: `1px solid ${colors.border}` }}>
          <button
            onClick={() => setShowMyPosts((v) => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, background: "none", border: "none", cursor: "pointer" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>📋 My Submissions</span>
              <span style={{ padding: "2px 8px", borderRadius: 20, background: `${accent}20` }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: accent }}>{myPosts.length}/4</span>
              </span>
            </span>
            <span style={{ fontSize: 14, color: colors.textSecondary }}>{showMyPosts ? "▲" : "▼"}</span>
          </button>

          {showMyPosts && (
            <div style={{ padding: "0 14px 14px" }}>
              {myPosts.map((post, index) => {
                const cfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.pending;
                return (
                  <div
                    key={post.id}
                    style={{
                      display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0",
                      borderTop: index > 0 ? `1px solid ${colors.border}` : "none",
                    }}
                  >
                    <div style={{ position: "relative", width: 56, height: 80, borderRadius: 14, overflow: "hidden", flexShrink: 0 }}>
                      {post.thumbnail ? (
                        <img src={post.thumbnail} alt="" style={{ width: 56, height: 80, objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 56, height: 80, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}15` }}>
                          <span style={{ fontSize: 20 }}>🎬</span>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.text }}>Reel #{index + 1}</span>
                      <span style={{ alignSelf: "flex-start", padding: "3px 8px", borderRadius: 6, background: cfg.bg }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{cfg.emoji} {cfg.label}</span>
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: colors.textSecondary }}>{cfg.description}</span>
                      {post.status === "rejected" && post.rejectionReason && (
                        <div style={{ marginTop: 4, padding: 8, background: "#e74c3c15", borderRadius: 8, borderLeft: "3px solid #e74c3c" }}>
                          <div style={{ color: "#e74c3c", fontSize: 10, fontWeight: 800 }}>Admin note:</div>
                          <div style={{ color: "#e74c3c", fontSize: 11, fontWeight: 500, marginTop: 2 }}>{post.rejectionReason}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "0 16px 14px", padding: 12, borderRadius: 12, background: `${accent}10`, border: `1px solid ${accent}30` }}>
        <span style={{ fontSize: 16, color: accent }}>ℹ️</span>
        <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: accent }}>
          Battle title and description are set by admin. Just upload your best skill reel!
        </span>
      </div>

      {/* Video picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
        disabled={loading}
      />
      <div
        onClick={() => !loading && fileInputRef.current?.click()}
        style={{
          margin: "0 16px 14px", borderRadius: 18, overflow: "hidden", minHeight: 220,
          position: "relative", cursor: loading ? "default" : "pointer",
          background: colors.card,
          border: `${videoFile ? 2 : 1}px solid ${videoFile ? accent : colors.border}`,
        }}
      >
        {videoUrl ? (
          <>
            <video
              ref={videoElRef}
              src={videoUrl}
              style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
              muted loop autoPlay playsInline
              onLoadedData={captureThumbnail}
            />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", padding: "7px 12px", borderRadius: 20 }}>
                <span style={{ fontSize: 13 }}>📷</span>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>Change Video</span>
              </span>
            </div>
            {thumbnail && (
              <img src={thumbnail} alt="" style={{ position: "absolute", bottom: 12, left: 12, width: 48, height: 72, borderRadius: 8, border: "2px solid #fff", objectFit: "cover" }} />
            )}
          </>
        ) : (
          <div style={{
            minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24,
            background: `linear-gradient(135deg, ${accent}20, ${accent}08)`,
          }}>
            <span style={{ fontSize: 48 }}>🎬</span>
            <span style={{ fontSize: 16, fontWeight: 800, textAlign: "center", color: colors.text }}>Upload Your Skill Reel</span>
            <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center", color: colors.textSecondary }}>Tap to select a video · Max 60 seconds</span>
            <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 20, marginTop: 6, background: accent }}>
              <span style={{ fontSize: 14 }}>☁️</span>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Choose Video</span>
            </span>
          </div>
        )}
      </div>

      {/* Caption */}
      <div style={{ margin: "0 16px 14px", padding: 14, borderRadius: 14, background: colors.card, border: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>Caption (optional)</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 200))}
          placeholder="Say something about your reel..."
          maxLength={200}
          rows={3}
          style={{ fontSize: 14, fontWeight: 500, minHeight: 60, borderRadius: 10, padding: 10, resize: "vertical", color: colors.text, background: "transparent", border: `1px solid ${colors.border}`, fontFamily: "inherit" }}
        />
      </div>

      {/* Scope picker */}
      <div style={{ margin: "0 16px 14px", padding: 14, borderRadius: 14, background: colors.card, border: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>Who should see this most?</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setScope("pan_india")}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0", borderRadius: 10, cursor: "pointer",
              border: `1.5px solid ${scope === "pan_india" ? accent : colors.border}`,
              background: scope === "pan_india" ? `${accent}18` : "transparent",
            }}
          >
            <span style={{ fontSize: 13 }}>🌍</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: scope === "pan_india" ? accent : colors.textSecondary }}>Pan-India</span>
          </button>
          <button
            onClick={() => student?.location?.state && setScope("state")}
            disabled={!student?.location?.state}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0", borderRadius: 10, cursor: student?.location?.state ? "pointer" : "not-allowed",
              border: `1.5px solid ${scope === "state" ? accent : colors.border}`,
              background: scope === "state" ? `${accent}18` : "transparent",
              opacity: student?.location?.state ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: 13 }}>📍</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: scope === "state" ? accent : colors.textSecondary }}>
              {student?.location?.state || "My State"} only
            </span>
          </button>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: colors.textSecondary }}>
          This still reaches everyone — it just shows higher up for the audience you pick.
        </span>
      </div>

      {/* Rules */}
      <div style={{ margin: "0 16px 16px", padding: 14, borderRadius: 14, background: colors.card, border: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, color: colors.text }}>📋 Rules</span>
        {[
          "Video must be your original skill content",
          "Max 4 reels per battle · Max 60 seconds",
          "Only Class 6–12 students can participate",
          "No inappropriate content",
          "Your state is taken from your profile for the scope picker above",
          "All reels go through admin review before approval",
        ].map((rule, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, lineHeight: "20px", color: accent }}>•</span>
            <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5, color: colors.textSecondary }}>{rule}</span>
          </div>
        ))}
      </div>

      {/* Error / success banners */}
      {errorMsg && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: 12, background: "#e74c3c15", border: "1px solid #e74c3c40" }}>
          <span style={{ color: "#e74c3c", fontSize: 12, fontWeight: 700 }}>⚠️ {errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: 12, background: "#2ecc7115", border: "1px solid #2ecc7140" }}>
          <span style={{ color: "#2ecc71", fontSize: 12, fontWeight: 700 }}>{successMsg}</span>
        </div>
      )}

      {/* Upload progress */}
      {loading && (
        <div style={{ margin: "0 16px 12px", padding: 14, borderRadius: 14, background: colors.card, border: `1px solid ${accent}40`, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {showSpinner && <span style={{ fontSize: 14 }}>⏳</span>}
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1, color: colors.text }}>{phaseLabel}</span>
          </div>
          {showProgressBar && (
            <div style={{ height: 8, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.07)" }}>
              <div style={{ height: "100%", borderRadius: 5, background: accent, width: `${uploadProgress}%`, transition: "width 0.25s" }} />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {[
              { key: "uploading", label: "Upload" },
              { key: "thumb", label: "Thumb" },
              { key: "saving", label: "Save" },
            ].map((step) => {
              const phases: UploadPhase[] = ["uploading", "thumb", "saving"];
              const stepIdx = phases.indexOf(step.key as UploadPhase);
              const curIdx = phases.indexOf(phase);
              const done = curIdx > stepIdx;
              const active = curIdx === stepIdx;
              return (
                <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: done ? "#2ecc71" : active ? accent : "rgba(255,255,255,0.15)",
                  }}>
                    {done ? <span style={{ fontSize: 9, color: "#fff" }}>✓</span> : <span style={{ fontSize: 8, color: active ? "#fff" : "rgba(255,255,255,0.4)" }}>{stepIdx + 1}</span>}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? accent : done ? "#2ecc71" : "rgba(255,255,255,0.3)" }}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={uploadReel}
        disabled={!videoFile || loading}
        style={{
          width: "calc(100% - 32px)", margin: "0 16px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "16px 0", borderRadius: 16, border: "none", cursor: !videoFile || loading ? "not-allowed" : "pointer",
          background: accent, opacity: !videoFile || loading ? 0.6 : 1,
        }}
      >
        <span style={{ fontSize: 18 }}>{loading ? "⏳" : "🚀"}</span>
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>{loading ? "Uploading..." : "Submit to Battle 🚀"}</span>
      </button>
    </div>
  );
}

export default function CreateReelPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div style={{ minHeight: "100dvh" }} />}>
        <CreateReelContent />
      </Suspense>
    </AuthGuard>
  );
}
