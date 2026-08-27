"use client";

// PATH: apps/web/src/app/mypost/page.tsx
// Mirrors mobile app/mypost.tsx — profile box + list of the student's own
// posts, with delete support (mobile's "Edit" option is also a no-op there
// — it only console.logs — so this mirrors that faithfully rather than
// inventing an edit flow mobile doesn't actually have).
//
// Lives outside the (app) route group, like /reels: mobile's mypost.tsx is
// a plain pushed screen (no drawer/tab bar visible), not nested inside the
// tab layout, so this skips AppHeader/Drawer/BottomNav the same way.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/AuthGuard";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { resolveStreamUrl } from "@/lib/cloudflareStream";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, where,
} from "firebase/firestore";

interface Post {
  id: string;
  mediaUrl?: string;
  postType?: string;
  videoUrl?: string;
  caption?: string;
  thumbnail?: string | null;
  name?: string;
  profilePic?: string;
  createdAt?: any;
  userId?: string;
}

interface UserData {
  name?: string;
  school?: string;
  district?: string;
  profilePic?: string;
}

function timeLabel(createdAt: any): string {
  if (!createdAt?.seconds) return "";
  return new Date(createdAt.seconds * 1000).toLocaleString();
}

// ─── Single post card — mirrors mobile ProfilePostCard.tsx ────────────────
function PostCard({ item, colors, onDelete }: {
  item: Post;
  colors: { text: string; textSecondary: string; border: string; card: string };
  onDelete: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isPhotoPost = item.postType === "photo";
  const rawUrl = item.videoUrl || item.mediaUrl || "";
  const playbackUrl = resolveStreamUrl(rawUrl) ?? rawUrl;

  return (
    <div style={{ padding: 12, borderBottom: `1px solid ${colors.border}` }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={item.profilePic || `https://i.pravatar.cc/100?u=${item.userId}`}
            alt=""
            style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover" }}
          />
          <div>
            <div style={{ fontWeight: 700, color: colors.text, fontSize: 14 }}>{item.name || "User"}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{timeLabel(item.createdAt)}</div>
          </div>
        </div>

        {/* 3-dot menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((m) => !m)}
            aria-label="Post options"
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.text, fontSize: 18, padding: 4 }}
          >⋮</button>
          {menuOpen && (
            <>
              <div
                onClick={() => setMenuOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 10 }}
              />
              <div style={{
                position: "absolute", right: 0, top: "100%", marginTop: 4,
                background: colors.card, border: `1px solid ${colors.border}`,
                borderRadius: 10, overflow: "hidden", zIndex: 11, minWidth: 120,
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              }}>
                <button
                  onClick={() => { setMenuOpen(false); /* mirrors mobile: Edit is not implemented */ }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", color: colors.text, fontSize: 13 }}
                >Edit</button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13 }}
                >Delete</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Media */}
      {isPhotoPost ? (
        <img
          src={item.mediaUrl || item.thumbnail || "https://via.placeholder.com/600x400.png"}
          alt=""
          style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 12, display: "block" }}
        />
      ) : !playing ? (
        <button
          onClick={() => setPlaying(true)}
          style={{ position: "relative", width: "100%", height: 220, border: "none", padding: 0, cursor: "pointer", borderRadius: 12, overflow: "hidden" }}
        >
          <img
            src={item.thumbnail || "https://via.placeholder.com/600x400.png"}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <span style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 56, height: 56, borderRadius: "50%", background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff",
          }}>▶</span>
        </button>
      ) : (
        <video
          src={playbackUrl}
          controls
          autoPlay
          style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 12, background: "#000" }}
        />
      )}

      {/* Caption */}
      <div style={{ marginTop: 8, color: colors.text, fontSize: 14, lineHeight: 1.5 }}>
        {item.caption || ""}
      </div>
    </div>
  );
}

function MyPostContent() {
  const { colors } = useTheme();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const snap = await getDoc(doc(db, "students", uid));
    if (snap.exists()) setUserData(snap.data() as UserData);
  }, []);

  const fetchPosts = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, "posts"), where("userId", "==", uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((d) => {
      const dt = d.data();
      return {
        id: d.id,
        mediaUrl: dt.mediaUrl,
        postType: dt.postType,
        videoUrl: dt.mediaUrl,
        caption: dt.description,
        thumbnail: dt.thumbnail || (dt.postType === "photo" ? dt.mediaUrl : null),
        name: dt.name,
        profilePic: dt.profilePic,
        createdAt: dt.createdAt,
        userId: dt.userId,
      } as Post;
    });
    setPosts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    fetchUser();
    fetchPosts();
  }, [fetchUser, fetchPosts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    await deleteDoc(doc(db, "posts", id));
    fetchPosts();
  };

  return (
    <div style={{ minHeight: "100dvh", background: colors.background }}>
      {/* Simple back header — mirrors mobile's default pushed-screen back button */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        borderBottom: `1px solid ${colors.border}`, position: "sticky", top: 0,
        background: colors.background, zIndex: 10,
      }}>
        <button
          onClick={() => router.push("/home")}
          aria-label="Back"
          style={{
            width: 36, height: 36, borderRadius: 10, background: colors.card,
            border: "none", cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 18, color: colors.text, flexShrink: 0,
          }}
        >‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>My Posts</span>
      </div>

      {/* Profile box */}
      {userData && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: 20, borderBottom: `1px solid ${colors.border}`,
        }}>
          <img
            src={userData.profilePic || `https://i.pravatar.cc/100?u=${auth.currentUser?.uid}`}
            alt=""
            style={{ width: 90, height: 90, borderRadius: 45, objectFit: "cover" }}
          />
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10, color: colors.text }}>{userData.name}</div>
          {userData.school && <div style={{ color: colors.textSecondary }}>{userData.school}</div>}
          {userData.district && <div style={{ color: colors.textSecondary }}>{userData.district}</div>}
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 28, height: 28, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "mp-spin 0.8s linear infinite" }}/>
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 20, color: colors.text }}>No posts yet</div>
      ) : (
        posts.map((item) => (
          <PostCard key={item.id} item={item} colors={colors} onDelete={() => handleDelete(item.id)} />
        ))
      )}

      <style>{`@keyframes mp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function MyPostPage() {
  return (
    <AuthGuard>
      <MyPostContent />
    </AuthGuard>
  );
}
