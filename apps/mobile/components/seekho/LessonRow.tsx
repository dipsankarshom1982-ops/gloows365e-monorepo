import { useTheme } from "@/context/ThemeContext";
import type { SeekhoLesson } from "@/lib/seekho/types";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  lesson: SeekhoLesson;
  completed: boolean;
  locked: boolean;
  onPress: () => void;
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function LessonRow({ lesson, completed, locked, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[S.row, { opacity: locked ? 0.55 : 1 }]}
      onPress={onPress}
      activeOpacity={locked ? 1 : 0.8}
    >
      {/* Left icon */}
      <View
        style={[
          S.iconWrap,
          {
            backgroundColor: completed
              ? "#059669"
              : locked
              ? colors.border
              : "#4f46e5",
          },
        ]}
      >
        <Ionicons
          name={completed ? "checkmark" : locked ? "lock-closed" : "play"}
          size={14}
          color="#fff"
        />
      </View>

      {/* Text */}
      <View style={S.textWrap}>
        <Text
          style={[
            S.title,
            {
              color: completed ? colors.textSecondary : colors.text,
              textDecorationLine: completed ? "line-through" : "none",
            },
          ]}
          numberOfLines={2}
        >
          {lesson.title}
        </Text>
        <View style={S.meta}>
          <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
          <Text style={[S.metaText, { color: colors.textSecondary }]}>
            {fmtDuration(lesson.duration)}
          </Text>
          {lesson.conceptTags.slice(0, 2).map((tag) => (
            <View key={tag} style={[S.tag, { backgroundColor: colors.border }]}>
              <Text style={[S.tagText, { color: colors.textSecondary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Right badge */}
      <View style={S.rightWrap}>
        {lesson.isFree && !completed && (
          <View style={S.freeBadge}>
            <Text style={S.freeBadgeText}>FREE</Text>
          </View>
        )}
        {locked && (
          <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
        )}
        {completed && (
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  metaText: { fontSize: 10, fontWeight: "500" },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagText: { fontSize: 9, fontWeight: "600" },
  rightWrap: { alignItems: "center", justifyContent: "center" },
  freeBadge: {
    backgroundColor: "#059669",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  freeBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
