import ConceptNode from "@/components/seekho/ConceptNode";
import LessonRow from "@/components/seekho/LessonRow";
import SubscriptionBottomSheet from "@/components/seekho/SubscriptionBottomSheet";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { useSeekhoAccess } from "@/hooks/useSeekhoAccess";
import { PRACTICE_UNLOCK_THRESHOLD } from "@/lib/seekho/constants";
import type { SeekhoCourse, SeekhoLesson, SeekhoSubject } from "@/lib/seekho/types";
import { getCourseById, getLessonsByCourse } from "@/services/seekhoFirestore";
import { useSeekhoStore } from "@/store/seekhoStore";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Graceful: expo-web-browser — requires prebuild
let WebBrowser: { openBrowserAsync: (url: string) => Promise<any> } | null = null;
try { WebBrowser = require("expo-web-browser"); } catch {}

type ConceptState = "completed" | "active" | "locked";

function buildConceptStates(
  lessons: SeekhoLesson[],
  completedLessonIds: string[]
): Array<{ tag: string; state: ConceptState }> {
  const completedSet = new Set(completedLessonIds);
  const tagMap: Record<string, { total: number; done: number; firstIdx: number }> = {};

  lessons.forEach((l, idx) => {
    l.conceptTags.forEach((tag) => {
      if (!tagMap[tag]) tagMap[tag] = { total: 0, done: 0, firstIdx: idx };
      tagMap[tag].total++;
      if (completedSet.has(l.lessonId)) tagMap[tag].done++;
    });
  });

  // First incomplete lesson's tags are "active"
  const firstIncompleteIdx = lessons.findIndex((l) => !completedSet.has(l.lessonId));

  return Object.entries(tagMap).map(([tag, info]) => {
    if (info.done === info.total) return { tag, state: "completed" as ConceptState };
    if (info.firstIdx === firstIncompleteIdx) return { tag, state: "active" as ConceptState };
    return { tag, state: info.firstIdx < firstIncompleteIdx ? "active" : "locked" as ConceptState };
  });
}

export default function ChapterDetailScreen() {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const { subject, chapterId } = useLocalSearchParams<{
    subject: string;
    chapterId: string;
  }>();

  const subjectName = subject as SeekhoSubject;
  const { courseProgress, selectedClass } = useSeekhoStore();
  const { canAccess, showSubscriptionSheet, reload } = useSeekhoAccess();

  const [course, setCourse] = useState<SeekhoCourse | null>(null);
  const [lessons, setLessons] = useState<SeekhoLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);

  const progress = courseProgress[chapterId ?? ""];
  const completedLessons = progress?.completedLessons ?? [];
  const pct = progress?.percentComplete ?? 0;
  const practiceUnlocked = pct >= PRACTICE_UNLOCK_THRESHOLD;

  const conceptNodes = buildConceptStates(lessons, completedLessons);

  useEffect(() => {
    if (!chapterId || !user) return;
    (async () => {
      setLoading(true);
      try {
        const [c, l] = await Promise.all([
          getCourseById(chapterId),
          getLessonsByCourse(chapterId),
        ]);
        setCourse(c);
        setLessons(l);
      } finally {
        setLoading(false);
      }
    })();
  }, [chapterId, user]);

  const handleLessonPress = (lesson: SeekhoLesson) => {
    if (!canAccess(lesson as unknown as SeekhoCourse)) {
      setSheetVisible(true);
      return;
    }
    router.push({
      pathname: "/seekho/[subject]/[chapterId]/lesson/[lessonId]",
      params: { subject: subjectName, chapterId: chapterId!, lessonId: lesson.lessonId },
    });
  };

  const handleNotesOpen = async () => {
    if (course?.thumbnailUrl) {
      await WebBrowser?.openBrowserAsync(course.thumbnailUrl).catch(() => null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
        <View style={S.loadingWrap}>
          <View style={[S.skeletonHeader, { backgroundColor: colors.card }]} />
          <View style={{ padding: 16, gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[S.skeletonRow, { backgroundColor: colors.card }]} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={lessons}
        keyExtractor={(l) => l.lessonId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <>
            {/* Back + title */}
            <View style={[S.topBar, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={S.topBarTitle}>
                <Text style={[S.chapterNum, { color: colors.textSecondary }]}>
                  Chapter {course?.chapterNumber}
                </Text>
                <Text style={[S.chapterTitle, { color: colors.text }]} numberOfLines={2}>
                  {course?.chapterTitle ?? "Loading…"}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={S.progressSection}>
              <View style={S.progressLabelRow}>
                <Text style={[S.progressLabel, { color: colors.textSecondary }]}>
                  {completedLessons.length} of {course?.totalLessons ?? lessons.length} lessons
                </Text>
                <Text style={[S.progressPct, { color: "#6366f1" }]}>
                  {Math.round(pct * 100)}%
                </Text>
              </View>
              <View style={[S.progressBarBg, { backgroundColor: colors.border }]}>
                <View style={[S.progressBarFill, { width: `${pct * 100}%` }]} />
              </View>
            </View>

            {/* Concept map */}
            {conceptNodes.length > 0 && (
              <View style={S.conceptSection}>
                <Text style={[S.sectionTitle, { color: colors.text }]}>Concept Map</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={S.conceptRow}>
                    {conceptNodes.map((node, idx) => (
                      <View key={node.tag} style={S.conceptItem}>
                        <ConceptNode tag={node.tag} state={node.state} />
                        {idx < conceptNodes.length - 1 && (
                          <View style={[S.conceptLine, { backgroundColor: colors.border }]} />
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Action buttons */}
            <View style={S.actionRow}>
              {course?.thumbnailUrl && (
                <TouchableOpacity
                  style={[S.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handleNotesOpen}
                >
                  <Ionicons name="document-text-outline" size={18} color="#6366f1" />
                  <Text style={[S.actionBtnText, { color: colors.text }]}>Chapter Notes</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  S.actionBtn,
                  {
                    backgroundColor: practiceUnlocked ? "#4f46e5" : colors.card,
                    borderColor: practiceUnlocked ? "#4f46e5" : colors.border,
                    opacity: practiceUnlocked ? 1 : 0.6,
                  },
                ]}
                onPress={() => {
                  if (practiceUnlocked) {
                    router.push({
                      pathname: "/seekho/[subject]/[chapterId]/practice",
                      params: { subject: subjectName, chapterId: chapterId! },
                    });
                  }
                }}
                disabled={!practiceUnlocked}
              >
                <Ionicons
                  name={practiceUnlocked ? "clipboard-outline" : "lock-closed-outline"}
                  size={18}
                  color={practiceUnlocked ? "#fff" : colors.textSecondary}
                />
                <Text
                  style={[
                    S.actionBtnText,
                    { color: practiceUnlocked ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {practiceUnlocked ? "Practice Set" : `Practice (60% needed)`}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[S.sectionTitle, { color: colors.text, paddingHorizontal: 16, marginTop: 8 }]}>
              Lessons
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <LessonRow
            lesson={item}
            completed={completedLessons.includes(item.lessonId)}
            locked={!canAccess(item as unknown as SeekhoCourse) && !item.isFree}
            onPress={() => handleLessonPress(item)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={[S.separator, { backgroundColor: colors.border }]} />
        )}
      />

      <SubscriptionBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        defaultClass={selectedClass}
        onSubscribed={reload}
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1 },
  skeletonHeader: { height: 120, margin: 16, borderRadius: 16 },
  skeletonRow: { height: 56, borderRadius: 12 },

  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  topBarTitle: { flex: 1 },
  chapterNum: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  chapterTitle: { fontSize: 18, fontWeight: "800", lineHeight: 24, marginTop: 2 },

  progressSection: { paddingHorizontal: 16, paddingVertical: 12 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: "500" },
  progressPct: { fontSize: 13, fontWeight: "700" },
  progressBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: "#6366f1" },

  conceptSection: { paddingLeft: 16, paddingBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  conceptRow: { flexDirection: "row", alignItems: "center", gap: 0, paddingRight: 16 },
  conceptItem: { flexDirection: "row", alignItems: "center" },
  conceptLine: { width: 24, height: 2, marginHorizontal: 2 },

  actionRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  separator: { height: 1, marginLeft: 60 },
});