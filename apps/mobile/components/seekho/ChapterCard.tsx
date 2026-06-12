import { useTheme } from "@/context/ThemeContext";
import type { SeekhoCourse, SeekhoProgress } from "@/lib/seekho/types";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ProgressRing from "./ProgressRing";

interface Props {
  course: SeekhoCourse;
  progress: SeekhoProgress | undefined;
  locked: boolean;
  onPress: () => void;
}

export default function ChapterCard({ course, progress, locked, onPress }: Props) {
  const { colors } = useTheme();
  const pct = progress?.percentComplete ?? 0;
  const completedCount = progress?.completedLessons.length ?? 0;

  return (
    <TouchableOpacity
      style={[S.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={locked ? 0.95 : 0.82}
    >
      {/* Thumbnail */}
      <View style={S.thumbWrap}>
        {course.thumbnailUrl ? (
          <Image
            source={{ uri: course.thumbnailUrl }}
            style={S.thumb}
            contentFit="cover"
          />
        ) : (
          <LinearGradient colors={["#1e1b4b", "#4f46e5"]} style={S.thumb}>
            <Ionicons name="book-outline" size={28} color="#a5b4fc" />
          </LinearGradient>
        )}

        {/* Progress ring overlay */}
        <View style={S.ringOverlay}>
          <ProgressRing progress={pct} size={38} strokeWidth={4} color="#6366f1" />
        </View>

        {/* Free badge */}
        {course.isFree && (
          <View style={S.freeBadge}>
            <Text style={S.freeBadgeText}>FREE</Text>
          </View>
        )}

        {/* Lock overlay */}
        {locked && (
          <View style={S.lockOverlay}>
            <View style={S.lockCircle}>
              <Ionicons name="lock-closed" size={18} color="#fff" />
            </View>
            <Text style={S.lockLabel}>Seekho Plus</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={S.info}>
        <Text style={[S.chapterNum, { color: colors.textSecondary }]}>
          Chapter {course.chapterNumber}
        </Text>
        <Text style={[S.title, { color: colors.text }]} numberOfLines={2}>
          {course.chapterTitle}
        </Text>
        <View style={S.meta}>
          <Ionicons name="play-circle-outline" size={13} color={colors.textSecondary} />
          <Text style={[S.metaText, { color: colors.textSecondary }]}>
            {completedCount}/{course.totalLessons} lessons
          </Text>
          {progress?.chapterCompleted && (
            <View style={S.completedBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#10b981" />
              <Text style={S.completedText}>Done</Text>
            </View>
          )}
        </View>

        {/* Progress bar */}
        <View style={[S.barBg, { backgroundColor: colors.border }]}>
          <View style={[S.barFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  thumbWrap: {
    width: 110,
    height: 110,
    position: "relative",
    flexShrink: 0,
  },
  thumb: {
    width: 110,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
  },
  ringOverlay: {
    position: "absolute",
    bottom: 6,
    right: 6,
  },
  freeBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#059669",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  freeBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  lockCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(99,102,241,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockLabel: { color: "#fff", fontSize: 10, fontWeight: "700" },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    gap: 3,
  },
  chapterNum: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontSize: 11, fontWeight: "500" },
  completedBadge: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 6 },
  completedText: { fontSize: 11, fontWeight: "700", color: "#10b981" },
  barBg: { height: 4, borderRadius: 2, marginTop: 6, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2, backgroundColor: "#6366f1" },
});
