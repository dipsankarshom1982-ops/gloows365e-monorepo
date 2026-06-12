// components/FeedPostCard.tsx — FIXED
//
// BUG FIX: Was importing resolveStreamUrl from @/lib/cloudflareStream which does
// not exist — the export is named streamPlaybackUrl. This caused a runtime crash
// on every card render, making useVideoPlayer receive undefined as its source,
// so tapping play never worked.
//
// FIX: Import streamPlaybackUrl and build a proper resolveStreamUrl helper inline
// that handles raw videoIds, cloudflarestream.com URLs, and videodelivery.net URLs —
// same logic used in reels.tsx VideoItem.

import { useTheme } from "@/context/ThemeContext";
import { streamPlaybackUrl } from "@/lib/cloudflareStream"; // FIX: correct export name
import { auth, db } from "@/lib/firebase";
import { VideoView, useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// FIX: replaces the missing resolveStreamUrl import.
// Handles all three URL formats stored in mediaUrl:
//   1. Raw 32-char Cloudflare video ID
//   2. https://cloudflarestream.com/<id>/...
//   3. https://videodelivery.net/<id>/...
//   4. Any other URL (returned as-is)
function resolveStreamUrl(mediaUrl?: string): string | null {
  if (!mediaUrl) return null;
  // Raw 32-char video ID
  if (/^[a-zA-Z0-9]{32}$/.test(mediaUrl.trim())) {
    return streamPlaybackUrl(mediaUrl.trim());
  }
  // cloudflarestream.com URL
  const cfMatch = mediaUrl.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)/);
  if (cfMatch?.[1]) return streamPlaybackUrl(cfMatch[1]);
  // videodelivery.net URL
  const vdMatch = mediaUrl.match(/videodelivery\.net\/([a-zA-Z0-9]+)/);
  if (vdMatch?.[1]) return streamPlaybackUrl(vdMatch[1]);
  // Fallback — plain URL (e.g. Firebase Storage)
  return mediaUrl;
}

const COMMENT_GROUPS = [
  {
    title: "Encouragement",
    options: ["Very good", "Keep it up", "Well done"],
  },
  {
    title: "Skill Praise",
    options: ["Excellent work", "Super effort", "Amazing skill"],
  },
  {
    title: "Learning Support",
    options: ["Good try", "Nice learning", "You are improving"],
  },
];

export default function PostCard({ data }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [profilePicError, setProfilePicError] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(data?.comments || 0);

  // 🎬 Generate video thumbnail
  useEffect(() => {
    if (data?.postType === "video" && data?.mediaUrl && !videoThumbnail) {
      const generateThumbnail = async () => {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(
            data.mediaUrl,
            {
              time: 1000, // 1 second into video
            }
          );
          setVideoThumbnail(uri);
        } catch (e) {
          console.log("Thumbnail error:", e);
          setVideoThumbnail(null);
        }
      };

      generateThumbnail();
    }
  }, [data?.mediaUrl, data?.postType, videoThumbnail]);

  // 📸 Fetch profile picture from students collection
  useEffect(() => {
    const fetchProfilePic = async () => {
      try {
        if (!data?.userId) {
          setProfilePicError(true);
          return;
        }

        const studentDoc = await getDoc(doc(db, "students", data.userId));
        if (studentDoc.exists() && studentDoc.data()?.profilePic) {
          setProfilePic(studentDoc.data().profilePic);
          setProfilePicError(false);
        } else {
          setProfilePicError(true);
        }
      } catch (error) {
        console.log("Fetch profile pic error:", error);
        setProfilePicError(true);
      }
    };

    fetchProfilePic();
  }, [data?.userId]);

  useEffect(() => {
    setCommentCount(data?.comments || 0);
  }, [data?.comments]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId || !data?.id) return;

    const fetchLikeStatus = async () => {
      try {
        const likeSnap = await getDoc(doc(db, "posts", data.id, "likes", userId));
        setLiked(likeSnap.exists());
      } catch (error) {
        console.log("Like status error:", error);
      }
    };

    fetchLikeStatus();
  }, [data?.id]);

  useEffect(() => {
    if (!commentsVisible || !data?.id) return;

    const commentsQuery = query(
      collection(db, "posts", data.id, "comments"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const nextComments = snapshot.docs.map((commentDoc) => ({
        id: commentDoc.id,
        ...commentDoc.data(),
      }));

      setComments(nextComments);
      setCommentCount(snapshot.size);
    });

    return unsubscribe;
  }, [commentsVisible, data?.id]);

  // 🎬 Video player — FIX: use the local resolveStreamUrl helper (streamPlaybackUrl
  // under the hood) instead of the non-existent import that crashed on render.
  // expo-video's useVideoPlayer accepts VideoSource which includes null (no source)
  // but NOT undefined — so we coerce undefined → null here.
  const videoPlayer = useVideoPlayer(
    resolveStreamUrl(data?.mediaUrl) ?? null,
    (player) => {
      player.muted = true;
    }
  );

  const handlePlayVideo = () => {
    setIsVideoPlaying(true);
    videoPlayer.play();
  };

  const handleExitFullscreen = () => {
    setIsVideoPlaying(false);
    videoPlayer.pause();
  };

  // 📅 Format timestamp
  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "now";

    try {
      const date = timestamp instanceof Timestamp
        ? timestamp.toDate()
        : new Date(timestamp);

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    } catch (error) {
      return "now";
    }
  };

  const timeText = formatTime(data?.createdAt);

  // Fallback profile picture with user initial
  const displayProfilePic = profilePic || `https://i.pravatar.cc/150?u=${data?.userId || "user"}`;

  const handleToggleLike = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !data?.id) return;

    const likeRef = doc(db, "posts", data.id, "likes", userId);

    try {
      if (liked) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, "posts", data.id), {
          likes: increment(-1),
        });
        setLiked(false);
        return;
      }

      await setDoc(likeRef, {
        liked: true,
        userId,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", data.id), {
        likes: increment(1),
      });
      setLiked(true);
    } catch (error) {
      console.log("Like action error:", error);
    }
  };

  const handleAddComment = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !data?.id || !commentText.trim()) return;

    try {
      await addDoc(collection(db, "posts", data.id, "comments"), {
        userId,
        userName: auth.currentUser?.displayName || "Student",
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "posts", data.id), {
        comments: increment(1),
      });

      setCommentText("");
    } catch (error) {
      console.log("Comment add error:", error);
    }
  };

  const handleSharePost = async () => {
    if (!data?.id) return;

    try {
      const deepLink = `vidya://post/${data.id}`;
      const result = await Share.share({
        message: `${data?.title || "Vidya post"}\n\n${data?.description || ""}\n\nOpen in Vidya: ${deepLink}`.trim(),
        url: deepLink,
      });

      if (result.action === Share.sharedAction) {
        await updateDoc(doc(db, "posts", data.id), {
          shares: increment(1),
        });
      }
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        {/* HEADER */}
        <View style={styles.header}>
        {!profilePicError ? (
          <Image
            source={{ uri: displayProfilePic }}
            style={[styles.avatar, { borderColor: colors.accent, borderWidth: 1 }]}
            onError={() => setProfilePicError(true)}
          />
        ) : (
          <View style={[styles.avatar, { borderColor: colors.accent, borderWidth: 1, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" }]}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
              {data?.name ? data.name.charAt(0).toUpperCase() : "U"}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]}>{data?.name || "User Name"}</Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>{timeText}</Text>
        </View>
        </View>

        {/* DESCRIPTION/CAPTION */}
        {data?.description && (
          <Text style={[styles.description, { color: colors.text }]} numberOfLines={3}>
            {data.description}
          </Text>
        )}

        {/* MEDIA */}
        {data?.mediaUrl && (
          <View style={styles.media}>
          {data?.postType === "video" ? (
            !isVideoPlaying ? (
              <TouchableOpacity onPress={handlePlayVideo}>
                <Image
                  source={{ uri: videoThumbnail || data?.thumbnail || data.mediaUrl }}
                  style={styles.previewMedia}
                />
                <View style={styles.playIcon}>
                  <Text style={styles.playText}>▶</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <VideoView
                player={videoPlayer}
                style={styles.previewMedia}
                fullscreenOptions={{ enable: true }}
              />
            )
          ) : (
            <Image
              source={{ uri: data.mediaUrl }}
              style={styles.previewMedia}
            />
          )}
          </View>
        )}

        {/* TITLE */}
        {data?.title && (
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {data.title}
          </Text>
        )}

        {/* ACTIONS */}
        <View style={styles.stats}>
          <TouchableOpacity onPress={handleToggleLike}>
            <Text style={[styles.statText, { color: liked ? colors.accent : colors.textSecondary }]}>❤️ {data?.likes || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCommentsVisible(true)}>
            <Text style={[styles.statText, { color: colors.textSecondary }]}>💬 {commentCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSharePost}>
            <Text style={[styles.statText, { color: colors.textSecondary }]}>📤 {data?.shares || 0}</Text>
          </TouchableOpacity>
          <Text style={[styles.statText, { color: colors.textSecondary }]}>👁️ {data?.views || 0}</Text>
        </View>
      </View>

      <Modal visible={commentsVisible} animationType="slide" transparent>
        <View style={[styles.modalBackdrop, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentsVisible(false)}>
                <Text style={[styles.closeText, { color: colors.accent }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentList}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>No comments yet</Text>}
              renderItem={({ item }) => (
                <View style={[styles.commentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.commentAuthor, { color: colors.accent }]}>{item.userName || "Student"}</Text>
                  <Text style={[styles.commentBody, { color: colors.text }]}>{item.text}</Text>
                </View>
              )}
            />

            <Text style={[styles.suggestionTitle, { color: colors.text }]}>Suggested comments</Text>
            {COMMENT_GROUPS.map((group) => (
              <View key={group.title} style={styles.suggestionGroup}>
                <Text style={[styles.suggestionGroupTitle, { color: colors.textSecondary }]}>{group.title}</Text>
                <View style={styles.suggestionWrap}>
                  {group.options.map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => setCommentText(preset)}
                    >
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
                placeholder="Pick a suggestion or edit your comment..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.commentInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              />
              <TouchableOpacity style={[styles.commentSend, { backgroundColor: colors.accent }]} onPress={handleAddComment}>
                <Text style={styles.commentSendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
 card: {
    marginVertical: 8,
    marginHorizontal: 8,
    backgroundColor: "#1f2937",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },

   header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
    paddingHorizontal: 12,
  },


  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  name: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },

  time: {
    color: "#aaa",
    fontSize: 12
  },

  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    color: "#fff",
    paddingHorizontal: 12,
  },

  title: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
  },

  media: {
    marginBottom: 12,
  },

  previewMedia: {
    height: 220,
    borderRadius: 12,
    width: "100%",
    resizeMode: "cover",
  },

  playIcon: {
    position: "absolute",
    top: "40%",
    left: "45%",
  },

  playText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "700",
  },

  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },

  statText: {
    fontSize: 12,
    fontWeight: "600",
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    minHeight: "55%",
    maxHeight: "80%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  closeText: {
    fontSize: 14,
    fontWeight: "700",
  },

  commentList: {
    paddingBottom: 16,
    gap: 10,
  },

  commentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },

  commentAuthor: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },

  commentBody: {
    fontSize: 14,
    lineHeight: 20,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },

  suggestionTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  suggestionGroup: {
    marginBottom: 10,
  },

  suggestionGroupTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },

  suggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },

  suggestionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  suggestionText: {
    fontSize: 12,
    fontWeight: "600",
  },

  commentComposer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingTop: 8,
  },

  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  commentSend: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  commentSendText: {
    color: "#fff",
    fontWeight: "700",
  },
});