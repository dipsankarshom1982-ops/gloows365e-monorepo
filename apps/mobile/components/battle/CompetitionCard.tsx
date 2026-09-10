// PATH: components/battle/CompetitionCard.tsx
// Phase 2D-5 — presentation ONLY (same posture as BattleCard.tsx): renders
// a CompetitionCardData it's handed, never computes rank/score/reward/
// engagement counts itself, never reads Firestore, never calls a Cloud
// Function. The Like button reports the tap upward; battle-competition.tsx
// owns the actual engageBattleSubmission call and all its error handling.

import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

const ACCENT = "#ff9f43";

export interface CompetitionCardData {
  submissionId: string;
  studentName: string;
  studentClass: string;
  skillLabel?: string;
  title: string;
  mediaRef: string;
  score: number;
  // Only ever set when the leaderboard page's `final` flag is true —
  // straight from the authoritative locked battleResults entry.
  rank?: number;
  isWinner?: boolean;
  rawEngagement?: number;
  isMine: boolean;
  liked: boolean;
  engagementOpen: boolean; // battle.state === "OPEN", mirrors engageBattleSubmission's own real check
}

function medalFor(rank?: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export default function CompetitionCard({
  data, onLike, liking,
}: {
  data: CompetitionCardData;
  onLike: (submissionId: string) => void;
  liking: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const player = useVideoPlayer(expanded && data.mediaRef ? data.mediaRef : null, (p) => {
    p.loop = false;
  });

  const medal = medalFor(data.rank);
  const likeDisabled = data.isMine || !data.engagementOpen || data.liked || liking;
  const likeLabel = data.isMine
    ? "You cannot like your own submission"
    : !data.engagementOpen
      ? "Liking is closed for this battle"
      : data.liked
        ? "You already liked this submission"
        : `Like ${data.studentName}'s submission`;

  return (
    <View
      style={styles.card}
      accessible={false}
    >
      <View
        style={styles.media}
        accessible
        accessibilityLabel={`${data.studentName}'s submission${data.rank ? `, rank ${data.rank}` : ""}${data.title ? `, titled ${data.title}` : ""}`}
      >
        {expanded && data.mediaRef ? (
          <VideoView player={player} style={styles.video} nativeControls />
        ) : (
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel={`Play ${data.studentName}'s submission`}
            style={styles.playWrap}
          >
            <Ionicons name="play-circle" size={46} color="rgba(255,255,255,0.92)" />
          </Pressable>
        )}

        {medal ? (
          <View style={styles.medalBadge} accessibilityElementsHidden>
            <Text style={styles.medalText}>{medal}</Text>
          </View>
        ) : typeof data.rank === "number" ? (
          <View style={styles.rankBadge} accessibilityElementsHidden>
            <Text style={styles.rankText}>#{data.rank}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{data.studentName.charAt(0).toUpperCase() || "S"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {data.studentName}{data.isMine ? " (You)" : ""}
            </Text>
            {data.studentClass ? <Text style={styles.classLabel}>Class {data.studentClass}</Text> : null}
          </View>
          {data.isWinner ? (
            <View style={styles.winnerChip}>
              <Text style={styles.winnerChipText}>🏆 Winner</Text>
            </View>
          ) : null}
        </View>

        {data.title ? <Text style={styles.title} numberOfLines={2}>{data.title}</Text> : null}
        {data.skillLabel ? <Text style={styles.skillChip}>🎯 {data.skillLabel}</Text> : null}

        <View style={styles.footerRow}>
          <View style={styles.statsRow}>
            <Text style={styles.score}>⭐ {data.score} pts</Text>
            {typeof data.rawEngagement === "number" ? (
              <Text style={styles.engagement}>🔥 {data.rawEngagement}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => onLike(data.submissionId)}
            disabled={likeDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: likeDisabled, selected: data.liked }}
            accessibilityLabel={likeLabel}
            style={({ pressed }) => [
              styles.likeBtn,
              data.liked && styles.likeBtnActive,
              likeDisabled && !data.liked && styles.likeBtnDisabled,
              pressed && !likeDisabled && { opacity: 0.85 },
            ]}
          >
            {liking ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <>
                <Ionicons
                  name={data.liked ? "heart" : "heart-outline"}
                  size={15}
                  color={data.liked ? "#ff6b9d" : "rgba(255,255,255,0.7)"}
                />
                <Text style={[styles.likeText, data.liked && { color: "#ff6b9d" }]}>
                  {data.liked ? "Liked" : "Like"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#0e0a1a" },
  media: { height: 170, backgroundColor: "#1a1226", position: "relative" },
  video: { width: "100%", height: "100%" },
  playWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  medalBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 14, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  medalText: { fontSize: 16 },
  rankBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  rankText: { color: "#ffd166", fontSize: 11, fontWeight: "900" },

  body: { padding: 12, gap: 8 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,159,67,0.18)", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: ACCENT, fontSize: 13, fontWeight: "900" },
  name: { color: "#fff", fontSize: 13, fontWeight: "800" },
  classLabel: { color: "rgba(255,255,255,0.45)", fontSize: 10.5, fontWeight: "600" },
  winnerChip: { backgroundColor: "rgba(6,214,160,0.15)", borderWidth: 1, borderColor: "rgba(6,214,160,0.4)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  winnerChipText: { color: "#06d6a0", fontSize: 10, fontWeight: "800" },

  title: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  skillChip: { color: ACCENT, fontSize: 11, fontWeight: "700", alignSelf: "flex-start" },

  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  score: { color: "#ffd166", fontSize: 12, fontWeight: "800" },
  engagement: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },

  likeBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", minWidth: 64, justifyContent: "center" },
  likeBtnActive: { borderColor: "rgba(255,107,157,0.4)", backgroundColor: "rgba(255,107,157,0.1)" },
  likeBtnDisabled: { opacity: 0.45 },
  likeText: { color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "800" },
});
