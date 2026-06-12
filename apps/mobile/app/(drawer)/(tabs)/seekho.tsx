import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useAppConfig } from "@/context/AppConfigContext";
import {
  SEEKHO_SUBJECTS,
  SUBJECT_META,
} from "@/lib/seekho/constants";
import type { SeekhoSubject } from "@/lib/seekho/types";
import { useSeekhoAccess } from "@/hooks/useSeekhoAccess";
import { useSeekhoStore } from "@/store/seekhoStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "@/components/header";

export default function SeekhoHomeScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { user, authLoading } = useStudentProfile();
  const { selectedClass, selectedBoard, courseProgress, revisionQueue } = useSeekhoStore();
  const { isFreeUser, loading: seekhoLoading, showSubscriptionSheet } = useSeekhoAccess();
  const { plans } = useAppConfig();

  const lowestPaidPlan = plans.filter((p) => p.id !== "free").sort((a, b) => a.monthlyPrice - b.monthlyPrice)[0];
  const startingPrice = lowestPaidPlan ? `Starting ₹${lowestPaidPlan.monthlyPrice}/month · Cancel anytime` : "Starting ₹149/month · Cancel anytime";

  // Continue learning — find most recently accessed incomplete chapter
  const recentProgress = Object.values(courseProgress)
    .filter((p) => !p.chapterCompleted && p.lastAccessedAt)
    .sort((a, b) => Number(b.lastAccessedAt) - Number(a.lastAccessedAt));
  const continueLearning = recentProgress[0] ?? null;

  // Revision due count
  const revisionDue = revisionQueue.filter(
    (item) => item.nextReviewAt <= Date.now()
  ).length;

  if (!authLoading && !user) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
        <Header />
        <View style={S.center}>
          <Text style={[S.emptyTitle, { color: colors.text }]}>{t("seekhoSignIn")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      <Header />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        {/* ── Title + student info ── */}
        <View style={S.titleRow}>
          <View style={S.titleLeft}>
            <Text style={[S.title, { color: colors.text }]}>📖 {t("seekhoPreviewTitle") ?? "Seekho"}</Text>
            <Text style={[S.subtitle, { color: colors.textSecondary }]}>
              {t("curriculumAligned")}
            </Text>
          </View>
          {seekhoLoading ? (
            <ActivityIndicator size="small" color="#6366f1" />
          ) : (
            <View style={[S.classBadge, { backgroundColor: "#4f46e5" }]}>
              <Text style={S.classBadgeText}>{t("classLabel") ?? "Class"} {selectedClass}</Text>
              <Text style={S.boardBadgeText}>{selectedBoard}</Text>
            </View>
          )}
        </View>

        {/* ── Subject grid ── */}
        <Text style={[S.sectionLabel, { color: colors.textSecondary }]}>{t("subjects")}</Text>
        <View style={S.subjectGrid}>
          {SEEKHO_SUBJECTS.map((subject: SeekhoSubject) => {
            const meta = SUBJECT_META[subject];
            return (
              <TouchableOpacity
                key={subject}
                style={S.subjectCardWrap}
                onPress={() =>
                  router.push({
                    pathname: "/seekho/[subject]",
                    params: { subject },
                  })
                }
                activeOpacity={0.82}
              >
                <LinearGradient
                  colors={meta.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={S.subjectCard}
                >
                  <Text style={S.subjectEmoji}>{meta.emoji}</Text>
                  <Text style={S.subjectName}>{meta.shortName}</Text>
                  <Text style={S.subjectFull} numberOfLines={1}>
                    {subject}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Continue Learning ── */}
        {continueLearning && (
          <View style={S.sectionWrap}>
            <Text style={[S.sectionTitle, { color: colors.text }]}>{t("continueLearning")}</Text>
            <TouchableOpacity
              style={[S.continueCard, { backgroundColor: colors.card }]}
              onPress={() =>
                router.push({
                  pathname: "/seekho/[subject]/[chapterId]",
                  params: {
                    subject: "Mathematics",
                    chapterId: continueLearning.courseId,
                  },
                })
              }
              activeOpacity={0.85}
            >
              <View style={[S.continueBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    S.continueBarFill,
                    { width: `${(continueLearning.percentComplete ?? 0) * 100}%` },
                  ]}
                />
              </View>
              <View style={S.continueInfo}>
                <Text style={[S.continueTitle, { color: colors.text }]}>
                  {t("resumeLearning")}
                </Text>
                <Text style={[S.continuePct, { color: "#6366f1" }]}>
                  {Math.round((continueLearning.percentComplete ?? 0) * 100)}% complete
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Revision due ── */}
        {revisionDue > 0 && (
          <TouchableOpacity
            style={S.revisionBanner}
            onPress={() => router.push("/seekho/revision")}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#7c2d12", "#dc2626"]} style={S.revisionBannerInner}>
              <Ionicons name="refresh-circle" size={22} color="#fff" />
              <View style={S.revisionText}>
                <Text style={S.revisionTitle}>{t("revisionDue")}</Text>
                <Text style={S.revisionSub}>
                  {revisionDue} {t("revisionReady")}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── Freemium upgrade banner ── */}
        {isFreeUser && (
          <TouchableOpacity
            style={S.upgradeBannerWrap}
            onPress={() => showSubscriptionSheet()}
            activeOpacity={0.88}
          >
            <LinearGradient colors={["#1e1b4b", "#4f46e5"]} style={S.upgradeBanner}>
              <Text style={S.upgradeEmoji}>🚀</Text>
              <View style={S.upgradeText}>
                <Text style={S.upgradeTitle}>{t("unlockCurriculum")}</Text>
                <Text style={S.upgradeSub}>{startingPrice}</Text>
              </View>
              <View style={S.upgradeCta}>
                <Text style={S.upgradeCtaText}>{t("upgrade")}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700" },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  titleLeft: { flex: 1 },
  title: { fontSize: 24, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "500", marginTop: 2 },

  classBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 4,
  },
  classBadgeText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  boardBadgeText: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "600", marginTop: 1 },

  sectionLabel: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Subject grid — 2 columns
  subjectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 4,
  },
  subjectCardWrap: { width: "47%", aspectRatio: 1 },
  subjectCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    justifyContent: "flex-end",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  subjectEmoji: { fontSize: 34, marginBottom: 8 },
  subjectName: { color: "#fff", fontSize: 16, fontWeight: "900" },
  subjectFull: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "500", marginTop: 2 },

  // Continue learning
  sectionWrap: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  continueBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 4, borderRadius: 0 },
  continueBarFill: { height: 4, backgroundColor: "#6366f1", borderRadius: 0 },
  continueInfo: { flex: 1 },
  continueTitle: { fontSize: 13, fontWeight: "700" },
  continuePct: { fontSize: 12, fontWeight: "600", marginTop: 2 },

  // Revision banner
  revisionBanner: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: "hidden" },
  revisionBannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  revisionText: { flex: 1 },
  revisionTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  revisionSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "500", marginTop: 2 },

  // Upgrade banner
  upgradeBannerWrap: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: "hidden" },
  upgradeBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  upgradeEmoji: { fontSize: 28 },
  upgradeText: { flex: 1 },
  upgradeTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  upgradeSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "500", marginTop: 2 },
  upgradeCta: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  upgradeCtaText: { color: "#4f46e5", fontSize: 13, fontWeight: "800" },
});
