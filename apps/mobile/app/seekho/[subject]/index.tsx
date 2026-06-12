import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { SUBJECT_META } from "@/lib/seekho/constants";
import type { SeekhoCourse, SeekhoSubject } from "@/lib/seekho/types";
import { useSeekhoAccess } from "@/hooks/useSeekhoAccess";
import { useSeekhoStore } from "@/store/seekhoStore";
import ChapterCard from "@/components/seekho/ChapterCard";
import SubscriptionBottomSheet from "@/components/seekho/SubscriptionBottomSheet";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCoursesByClassBoard } from "@/services/seekhoFirestore";

// Skeleton
function Skeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ height: 110, borderRadius: 16, backgroundColor: "#1e293b" }} />
      ))}
    </View>
  );
}

export default function SubjectChaptersScreen() {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const { subject } = useLocalSearchParams<{ subject: string }>();
  const { selectedClass, selectedBoard, courseProgress } = useSeekhoStore();
  const { canAccess, reload, loading: profileLoading } = useSeekhoAccess();

  const [courses, setCourses] = useState<SeekhoCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const lockedCourseRef = useRef<SeekhoCourse | null>(null);

  const subjectName = subject as SeekhoSubject;
  const meta = SUBJECT_META[subjectName] ?? { emoji: "📚", gradient: ["#1e293b", "#334155"] as [string, string], shortName: subject };

  useEffect(() => {
    if (!user || profileLoading) return; // wait for student profile sync
    setLoading(true);
    getCoursesByClassBoard(selectedClass, selectedBoard, subjectName)
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [user, profileLoading, selectedClass, selectedBoard, subjectName]);

  const handleChapterPress = (course: SeekhoCourse) => {
    const access = canAccess(course);
    if (!access) {
      lockedCourseRef.current = course;
      setSheetVisible(true);
      return;
    }
    router.push({
      pathname: "/seekho/[subject]/[chapterId]",
      params: { subject: subjectName, chapterId: course.courseId },
    });
  };

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient colors={meta.gradient as [string, string]} style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={S.headerContent}>
          <Text style={S.headerEmoji}>{meta.emoji}</Text>
          <Text style={S.headerTitle}>{subjectName}</Text>
          <Text style={S.headerSub}>
            Class {selectedClass} · {selectedBoard} · {courses.length} chapters
          </Text>
        </View>
      </LinearGradient>

      {/* Chapter list */}
      {loading ? (
        <Skeleton />
      ) : courses.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>📭</Text>
          <Text style={[S.emptyTitle, { color: colors.text }]}>No chapters yet</Text>
          <Text style={[S.emptySub, { color: colors.textSecondary }]}>
            Content for Class {selectedClass} {selectedBoard} {subject} coming soon!
          </Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(c) => c.courseId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <ChapterCard
              course={item}
              progress={courseProgress[item.courseId]}
              locked={!canAccess(item)}
              onPress={() => handleChapterPress(item)}
            />
          )}
        />
      )}

      <SubscriptionBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        defaultClass={lockedCourseRef.current?.class ?? selectedClass}
        onSubscribed={reload}
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 8, paddingBottom: 20, paddingHorizontal: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  headerContent: { paddingLeft: 4 },
  headerEmoji: { fontSize: 36, marginBottom: 6 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "500", marginTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  emptySub: { fontSize: 13, fontWeight: "500", textAlign: "center" },
});
