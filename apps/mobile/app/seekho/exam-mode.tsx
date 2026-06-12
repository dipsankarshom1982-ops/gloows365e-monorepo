import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { useSeekhoAccess } from "@/hooks/useSeekhoAccess";
import { useSeekhoStore } from "@/store/seekhoStore";
import type { DailyPlanItem } from "@/lib/seekho/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PlanDays = 30 | 60 | 90;

interface DailyStudyPlanResponse {
  courses: Array<{
    courseId: string;
    subject: string;
    chapterTitle: string;
    chapterNumber: number;
    percentComplete: number;
  }>;
  revisionsDue: number;
}

export default function ExamModeScreen() {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const { isPro, showSubscriptionSheet } = useSeekhoAccess();
  const { courseProgress, selectedClass, selectedBoard } = useSeekhoStore();

  const [examDate, setExamDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [planDays, setPlanDays] = useState<PlanDays>(60);
  const [studyPlan, setStudyPlan] = useState<DailyStudyPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Streak calculation — consecutive days with any lesson completed
  const allLastAccessed = Object.values(courseProgress)
    .map((p) => (typeof p.lastAccessedAt === "number" ? p.lastAccessedAt : 0))
    .filter((t) => t > 0);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const streak = allLastAccessed.some(
    (t) => t >= todayStart && t <= Date.now()
  )
    ? 1
    : 0;

  const daysUntilExam = Math.max(
    0,
    Math.ceil((examDate.getTime() - Date.now()) / 86_400_000)
  );

  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (date) setExamDate(date);
  };

  const handleGeneratePlan = async () => {
    if (!user || !isPro) return;
    setLoading(true);
    try {
      const fns = getFunctions();
      const getDailyPlan = httpsCallable<
        Record<string, never>,
        DailyStudyPlanResponse
      >(fns, "seekhoGetDailyStudyPlan");
      const result = await getDailyPlan({});
      setStudyPlan(result.data);
    } catch (e) {
      Alert.alert("Error", "Could not generate study plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Pro gate
  if (!isPro) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
        <View style={[S.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[S.headerTitle, { color: colors.text }]}>Exam Mode</Text>
        </View>
        <LinearGradient colors={["#1e1b4b", "#0f172a"]} style={S.lockScreen}>
          <Ionicons name="lock-closed" size={56} color="#6366f1" />
          <Text style={S.lockTitle}>Exam Mode is Pro Only</Text>
          <Text style={S.lockSub}>
            Upgrade to Seekho Pro to unlock exam planning, daily targets, and streak tracking.
          </Text>
          <TouchableOpacity
            style={S.upgradeBtn}
            onPress={() => showSubscriptionSheet()}
          >
            <Text style={S.upgradeBtnText}>Upgrade to Pro · ₹299/mo</Text>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>Exam Mode</Text>
        <View style={[S.streakBadge, { backgroundColor: "#431407" }]}>
          <Text style={S.streakText}>🔥 {streak} day streak</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        {/* Countdown */}
        <LinearGradient colors={["#1e1b4b", "#4f46e5"]} style={S.countdownCard}>
          <Text style={S.countdownNum}>{daysUntilExam}</Text>
          <Text style={S.countdownLabel}>days until exam</Text>
          <Text style={S.countdownSub}>
            Class {selectedClass} · {selectedBoard}
          </Text>
        </LinearGradient>

        {/* Exam date */}
        <View style={[S.section, { backgroundColor: colors.card }]}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>Exam Date</Text>
          <TouchableOpacity
            style={[S.dateBtn, { borderColor: colors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color="#6366f1" />
            <Text style={[S.dateBtnText, { color: colors.text }]}>
              {examDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={examDate}
            mode="date"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        {/* Plan duration */}
        <View style={[S.section, { backgroundColor: colors.card }]}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>Study Plan Duration</Text>
          <View style={S.planDaysRow}>
            {([30, 60, 90] as PlanDays[]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  S.planDayBtn,
                  {
                    backgroundColor: planDays === d ? "#4f46e5" : colors.background,
                    borderColor: planDays === d ? "#4f46e5" : colors.border,
                  },
                ]}
                onPress={() => setPlanDays(d)}
              >
                <Text
                  style={[
                    S.planDayText,
                    { color: planDays === d ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {d} Days
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Daily target (estimated) */}
        <View style={[S.section, { backgroundColor: colors.card }]}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>Daily Target</Text>
          <View style={S.targetRow}>
            <View style={S.targetItem}>
              <Text style={S.targetNum}>{Math.ceil(planDays <= 30 ? 3 : planDays <= 60 ? 2 : 1)}</Text>
              <Text style={[S.targetLabel, { color: colors.textSecondary }]}>Lessons/day</Text>
            </View>
            <View style={[S.targetDivider, { backgroundColor: colors.border }]} />
            <View style={S.targetItem}>
              <Text style={S.targetNum}>{Math.ceil(planDays <= 30 ? 10 : 5)}</Text>
              <Text style={[S.targetLabel, { color: colors.textSecondary }]}>Revision cards</Text>
            </View>
            <View style={[S.targetDivider, { backgroundColor: colors.border }]} />
            <View style={S.targetItem}>
              <Text style={S.targetNum}>{planDays}</Text>
              <Text style={[S.targetLabel, { color: colors.textSecondary }]}>Study days</Text>
            </View>
          </View>
        </View>

        {/* Generate plan button */}
        <TouchableOpacity
          style={[S.generateBtn, loading && { opacity: 0.65 }]}
          onPress={handleGeneratePlan}
          disabled={loading}
        >
          <LinearGradient
            colors={["#4f46e5", "#7c3aed"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={S.generateBtnInner}
          >
            <Ionicons name="flash-outline" size={18} color="#fff" />
            <Text style={S.generateBtnText}>
              {loading ? "Generating…" : "Generate Today's Plan"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Today's plan */}
        {studyPlan && (
          <View style={S.todayPlan}>
            <Text style={[S.sectionTitle, { color: colors.text, paddingHorizontal: 16 }]}>
              Today's Plan
            </Text>

            {studyPlan.revisionsDue > 0 && (
              <TouchableOpacity
                style={[S.todayItem, { backgroundColor: colors.card, borderLeftColor: "#dc2626" }]}
                onPress={() => router.push("/seekho/revision")}
              >
                <Ionicons name="refresh-circle-outline" size={20} color="#dc2626" />
                <View style={S.todayItemText}>
                  <Text style={[S.todayItemTitle, { color: colors.text }]}>
                    Revision Session
                  </Text>
                  <Text style={[S.todayItemSub, { color: colors.textSecondary }]}>
                    {studyPlan.revisionsDue} cards due
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {studyPlan.courses.map((course, idx) => (
              <TouchableOpacity
                key={course.courseId}
                style={[S.todayItem, { backgroundColor: colors.card, borderLeftColor: "#6366f1" }]}
                onPress={() =>
                  router.push({
                    pathname: "/seekho/[subject]/[chapterId]",
                    params: {
                      subject: course.subject,
                      chapterId: course.courseId,
                    },
                  })
                }
              >
                <View style={[S.todayIdxBadge, { backgroundColor: "#1e1b4b" }]}>
                  <Text style={S.todayIdxText}>{idx + 1}</Text>
                </View>
                <View style={S.todayItemText}>
                  <Text style={[S.todayItemTitle, { color: colors.text }]} numberOfLines={1}>
                    {course.chapterTitle}
                  </Text>
                  <Text style={[S.todayItemSub, { color: colors.textSecondary }]}>
                    {course.subject} · {Math.round(course.percentComplete * 100)}% done
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800" },
  streakBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  streakText: { color: "#f97316", fontSize: 12, fontWeight: "700" },

  // Pro lock screen
  lockScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  lockTitle: { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  lockSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
  },
  upgradeBtn: {
    marginTop: 16,
    backgroundColor: "#6366f1",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  upgradeBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  scroll: { paddingBottom: 40 },

  countdownCard: {
    alignItems: "center",
    padding: 28,
    gap: 4,
  },
  countdownNum: { color: "#fff", fontSize: 64, fontWeight: "900" },
  countdownLabel: { color: "#a5b4fc", fontSize: 16, fontWeight: "600" },
  countdownSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "500" },

  section: { marginHorizontal: 16, marginTop: 14, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 12 },

  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  dateBtnText: { flex: 1, fontSize: 14, fontWeight: "600" },

  planDaysRow: { flexDirection: "row", gap: 8 },
  planDayBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, alignItems: "center" },
  planDayText: { fontSize: 13, fontWeight: "700" },

  targetRow: { flexDirection: "row", alignItems: "center" },
  targetItem: { flex: 1, alignItems: "center", gap: 4 },
  targetNum: { color: "#6366f1", fontSize: 28, fontWeight: "900" },
  targetLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  targetDivider: { width: 1, height: 44 },

  generateBtn: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: "hidden" },
  generateBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  generateBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  todayPlan: { marginTop: 16 },
  todayItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 3,
  },
  todayItemText: { flex: 1 },
  todayItemTitle: { fontSize: 13, fontWeight: "700" },
  todayItemSub: { fontSize: 11, fontWeight: "500", marginTop: 2 },
  todayIdxBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  todayIdxText: { color: "#a5b4fc", fontSize: 13, fontWeight: "700" },
});
