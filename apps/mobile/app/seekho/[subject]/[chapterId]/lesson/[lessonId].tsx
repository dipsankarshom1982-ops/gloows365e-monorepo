import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { LESSON_WATCH_THRESHOLD } from "@/lib/seekho/constants";
import type { SeekhoLesson, SeekhoSubject } from "@/lib/seekho/types";
import { streamPlaybackUrl } from "@/lib/cloudflareStream";
import { useSeekhoStore } from "@/store/seekhoStore";
import { getLessonById, getLessonsByCourse } from "@/services/seekhoFirestore";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LessonPlayerScreen() {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const { subject, chapterId, lessonId } = useLocalSearchParams<{
    subject: string;
    chapterId: string;
    lessonId: string;
  }>();

  const subjectName = subject as SeekhoSubject;
  const { markLessonComplete, courseProgress } = useSeekhoStore();

  const [lesson, setLesson] = useState<SeekhoLesson | null>(null);
  const [nextLesson, setNextLesson] = useState<SeekhoLesson | null>(null);
  const [watchProgress, setWatchProgress] = useState(0);
  const [canMarkComplete, setCanMarkComplete] = useState(false);
  const [marked, setMarked] = useState(false);

  const progress = courseProgress[chapterId ?? ""];
  const alreadyCompleted = progress?.completedLessons.includes(lessonId ?? "") ?? false;

  // videoUrl stores the Cloudflare Stream video ID; resolve to HLS URL for playback
  const videoSource = lesson?.videoUrl ? streamPlaybackUrl(lesson.videoUrl) : "";
  const hasVideo = !!lesson?.videoUrl;

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
  });

  // Auto-play when a valid URL loads
  useEffect(() => {
    if (hasVideo) player.play();
  }, [hasVideo]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!lesson?.videoUrl || alreadyCompleted) return;

    intervalRef.current = setInterval(() => {
      if (!player || player.duration === 0) return;
      const ratio = player.currentTime / player.duration;
      setWatchProgress(ratio);
      if (ratio >= LESSON_WATCH_THRESHOLD) {
        setCanMarkComplete(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lesson?.videoUrl, player, alreadyCompleted]);

  useEffect(() => {
    if (!lessonId || !chapterId || !user) return;
    (async () => {
      const [l, allLessons] = await Promise.all([
        getLessonById(lessonId),
        getLessonsByCourse(chapterId),
      ]);
      setLesson(l);
      if (l) {
        const idx = allLessons.findIndex((x) => x.lessonId === lessonId);
        setNextLesson(allLessons[idx + 1] ?? null);
      }
    })();
  }, [lessonId, chapterId, user]);

  useEffect(() => {
    if (alreadyCompleted || !hasVideo) {
      setMarked(alreadyCompleted);
      setCanMarkComplete(true);
    }
  }, [alreadyCompleted, hasVideo]);

  const handleMarkComplete = async () => {
    if (!lesson || !chapterId || !user) return;
    setMarked(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const totalLessons = lesson ? (await getLessonsByCourse(chapterId)).length : 1;
    markLessonComplete(chapterId, lesson.lessonId, totalLessons);
  };

  const handleAskAiGuru = () => {
    if (!lesson) return;
    router.push({
      pathname: "/ai-guru/setup",
      params: {
        subject: subjectName,
        chapter: lesson.title,
        topic: lesson.conceptTags[0] ?? "",
        classLevel: "10",
      },
    });
  };

  const handleNext = () => {
    if (!nextLesson) return;
    router.replace({
      pathname: "/seekho/[subject]/[chapterId]/lesson/[lessonId]",
      params: { subject: subjectName, chapterId: chapterId!, lessonId: nextLesson.lessonId },
    });
  };

  if (!lesson) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: "#000" }]}>
        <View style={S.loadingWrap}>
          <Text style={{ color: "#fff" }}>Loading lesson…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: "#000" }]} edges={["top"]}>
      {/* Video player / placeholder */}
      <View style={S.videoWrap}>
        {hasVideo ? (
          <VideoView
            player={player}
            style={S.video}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
          />
        ) : (
          <View style={S.noVideoPlaceholder}>
            <Ionicons name="videocam-off-outline" size={40} color="#475569" />
            <Text style={S.noVideoText}>Video coming soon</Text>
          </View>
        )}
        {/* Back button overlay */}
        <TouchableOpacity style={S.backOverlay} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom info sheet */}
      <ScrollView
        style={[S.infoSheet, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Title + tags */}
        <View style={S.lessonHeader}>
          <Text style={[S.lessonTitle, { color: colors.text }]}>{lesson.title}</Text>
          <View style={S.tagsRow}>
            {lesson.conceptTags.map((tag) => (
              <View key={tag} style={[S.tag, { backgroundColor: colors.card }]}>
                <Text style={[S.tagText, { color: "#a5b4fc" }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Watch progress bar */}
        {!alreadyCompleted && (
          <View style={S.watchSection}>
            <View style={[S.watchBarBg, { backgroundColor: colors.border }]}>
              <View style={[S.watchBarFill, { width: `${watchProgress * 100}%` }]} />
            </View>
            <Text style={[S.watchLabel, { color: colors.textSecondary }]}>
              {Math.round(watchProgress * 100)}% watched · Need 80% to complete
            </Text>
          </View>
        )}

        {/* Mark Complete */}
        <TouchableOpacity
          style={[
            S.markBtn,
            {
              backgroundColor:
                marked || alreadyCompleted
                  ? "#059669"
                  : canMarkComplete
                  ? "#4f46e5"
                  : colors.card,
              opacity: canMarkComplete || marked ? 1 : 0.5,
            },
          ]}
          onPress={handleMarkComplete}
          disabled={!canMarkComplete || marked || alreadyCompleted}
        >
          <Ionicons
            name={marked || alreadyCompleted ? "checkmark-circle" : "checkmark-circle-outline"}
            size={20}
            color={canMarkComplete || marked ? "#fff" : colors.textSecondary}
          />
          <Text
            style={[
              S.markBtnText,
              { color: canMarkComplete || marked ? "#fff" : colors.textSecondary },
            ]}
          >
            {marked || alreadyCompleted ? "Lesson Complete ✓" : "Mark as Complete"}
          </Text>
        </TouchableOpacity>

        {/* Next lesson */}
        {nextLesson && (marked || alreadyCompleted) && (
          <TouchableOpacity
            style={[S.nextBtn, { borderColor: colors.border }]}
            onPress={handleNext}
          >
            <View style={S.nextBtnContent}>
              <Text style={[S.nextBtnLabel, { color: colors.textSecondary }]}>Next</Text>
              <Text style={[S.nextBtnTitle, { color: colors.text }]} numberOfLines={1}>
                {nextLesson.title}
              </Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color="#6366f1" />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Ask AI Guru FAB */}
      <TouchableOpacity style={S.fab} onPress={handleAskAiGuru} activeOpacity={0.85}>
        <LinearGradientFab />
        <Text style={S.fabText}>Ask AI Guru</Text>
        <Ionicons name="sparkles" size={16} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Inline gradient FAB background using a View (expo-linear-gradient handled separately)
function LinearGradientFab() {
  const { LinearGradient } = require("expo-linear-gradient");
  return (
    <LinearGradient
      colors={["#4f46e5", "#7c3aed"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  videoWrap: { position: "relative", aspectRatio: 16 / 9, backgroundColor: "#000" },
  video: { width: "100%", height: "100%" },
  noVideoPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  noVideoText: { color: "#475569", fontSize: 13, fontWeight: "600" },
  backOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  infoSheet: { flex: 1 },
  lessonHeader: { padding: 16, paddingBottom: 8 },
  lessonTitle: { fontSize: 18, fontWeight: "800", lineHeight: 24, marginBottom: 10 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: "600" },

  watchSection: { paddingHorizontal: 16, marginBottom: 4 },
  watchBarBg: { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 6 },
  watchBarFill: { height: 4, borderRadius: 2, backgroundColor: "#6366f1" },
  watchLabel: { fontSize: 11, fontWeight: "500" },

  markBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  markBtnText: { fontSize: 15, fontWeight: "800" },

  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  nextBtnContent: { flex: 1 },
  nextBtnLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  nextBtnTitle: { fontSize: 14, fontWeight: "700", marginTop: 2 },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
