import { useTheme } from "@/context/ThemeContext";
import { useContests } from "@/hooks/useContests";
import { useUserContests } from "@/hooks/useUserContests";
import { joinContest } from "@/services/joinContest";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/header";
import { useAppTranslation } from "@/context/LanguageContext";
import UserService from "@/lib/userService";

const { width } = Dimensions.get("window");

const getDate = (t: any): Date | null => {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
};

// 🔥 Ultra Premium Chip
const Chip = ({ label, active, onPress }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={[styles.chipBase, active ? styles.chipActive : styles.chipInactive]}
  >
    <Text style={[styles.chipText, { color: active ? "#fff" : "#6366f1" }]}>{label}</Text>
  </TouchableOpacity>
);

// 🔥 Modern Action Button
const ActionButton = ({ title, onPress, colors, icon }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtn}>
      <Text style={styles.actionBtnText}>{title}</Text>
      <Ionicons name={icon} size={18} color="#fff" style={{ marginLeft: 8 }} />
    </LinearGradient>
  </TouchableOpacity>
);

const ContestCard = ({ item, joined, completed }: any) => {
  const router = useRouter();
  const { t } = useAppTranslation();
  const userId = getAuth().currentUser?.uid;
  const isJoined    = !!joined[item.id];
  const isCompleted = !!completed[item.id];
  const now   = new Date();
  const start = getDate(item.startTime ?? item.startDate);
  const end   = getDate(item.endTime   ?? item.endDate);
  const isLive   = !!(start && start <= now && (!end || end > now));
  const isEnded  = !!(end && end < now);
  const hasLesson = item.lessonStatus === "completed";

  const progress =
    isLive && start && end
      ? ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100
      : 0;

  const handleJoin = async () => {
    if (!userId) return Alert.alert(t("loginRequired"));
    await joinContest(userId, item);
  };

  const goToLesson = () =>
    router.push({ pathname: "/contest/lesson", params: { contestId: item.id } });

  const goToResult = () =>
    router.push({ pathname: "/contest/result", params: { contestId: item.id } });

  const goToLeaderboard = () =>
    router.push({ pathname: "/contest/leaderboard", params: { contestId: item.id } });

  return (
    <View style={styles.cardContainer}>
      <LinearGradient colors={["#ffffff", "#f8faff"]} style={styles.cardInner}>
        {/* TOP BADGE ROW */}
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.contestTitle} numberOfLines={1}>{item.title}</Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveText}>{t("live").toUpperCase()}</Text>
              </View>
            )}
          </View>
          {isCompleted && (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={styles.doneText}>{t("completed")}</Text>
            </View>
          )}
        </View>

        {/* PRIZE INFO */}
        <View style={styles.prizeRow}>
          <MaterialCommunityIcons name="trophy-outline" size={20} color="#f59e0b" />
          <Text style={styles.prizeLabel}>{t("prizePool")}</Text>
          <Text style={styles.prizeValue}>{item.prizePool}</Text>
        </View>

        {/* SPOTS */}
        {(item.joinedCount != null || item.totalSpots != null) && (
          <View style={styles.spotsRow}>
            <Ionicons name="people-outline" size={15} color="#6b7280" />
            <Text style={styles.spotsText}>
              {item.joinedCount ?? 0} / {item.totalSpots ?? "∞"} joined
            </Text>
          </View>
        )}

        {/* PROGRESS BAR */}
        {isLive && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressTimeText}>{t("endingSoon")}</Text>
          </View>
        )}

        {/* AI LESSON BADGE */}
        {hasLesson && !isCompleted && (
          <View style={styles.lessonBadge}>
            <Ionicons name="sparkles" size={12} color="#6366f1" />
            <Text style={styles.lessonBadgeText}>{t("aiLessonReady") ?? "AI Lesson Ready"}</Text>
          </View>
        )}

        {/* CTA SECTION */}
        <View style={styles.ctaWrapper}>
          {/* Ended + participated → View Result + Leaderboard */}
          {isCompleted && isEnded && (
            <>
              <ActionButton
                title={t("viewResult")}
                colors={["#10b981", "#059669"]}
                icon="stats-chart"
                onPress={goToResult}
              />
              <TouchableOpacity style={styles.leaderLink} onPress={goToLeaderboard} activeOpacity={0.8}>
                <Ionicons name="podium-outline" size={14} color="#a5b4fc" />
                <Text style={styles.leaderLinkText}>{t("viewFinalLeaderboard") ?? "View Final Leaderboard"}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Ended + joined but didn't complete quiz */}
          {isJoined && !isCompleted && isEnded && (
            <TouchableOpacity style={styles.leaderLink} onPress={goToLeaderboard} activeOpacity={0.8}>
              <Ionicons name="podium-outline" size={14} color="#a5b4fc" />
              <Text style={styles.leaderLinkText}>{t("viewFinalLeaderboard") ?? "View Final Leaderboard"}</Text>
            </TouchableOpacity>
          )}

          {/* Active contest — completed quiz → result + live standings */}
          {isCompleted && !isEnded && (
            <>
              <ActionButton
                title={t("viewResult")}
                colors={["#10b981", "#059669"]}
                icon="stats-chart"
                onPress={goToResult}
              />
              <TouchableOpacity style={styles.leaderLink} onPress={goToLeaderboard} activeOpacity={0.8}>
                <Ionicons name="podium-outline" size={14} color="#a5b4fc" />
                <Text style={styles.leaderLinkText}>{t("viewLiveStandings") ?? "View Live Standings"}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Active contest — joined, not yet completed, lesson ready */}
          {!isCompleted && isLive && isJoined && hasLesson && (
            <ActionButton
              title="Continue Lesson"
              colors={["#4f46e5", "#3730a3"]}
              icon="play"
              onPress={goToLesson}
            />
          )}

          {/* Active contest — joined, lesson not yet generated */}
          {!isCompleted && isLive && isJoined && !hasLesson && (
            <View style={styles.timerBadge}>
              <Ionicons name="time-outline" size={18} color="#f59e0b" />
              <Text style={styles.timerText}>{t("lessonBeingPrepared") ?? "Lesson being prepared…"}</Text>
            </View>
          )}

          {/* Active contest — not joined */}
          {!isCompleted && isLive && !isJoined && (
            <>
              {hasLesson ? (
                <ActionButton
                  title={t("joinNow")}
                  colors={["#6366f1", "#4f46e5"]}
                  icon="flash"
                  onPress={async () => {
                    await handleJoin();
                    goToLesson();
                  }}
                />
              ) : (
                <View style={styles.timerBadge}>
                  <Ionicons name="time-outline" size={18} color="#f59e0b" />
                  <Text style={styles.timerText}>{t("lessonBeingPrepared") ?? "Lesson being prepared…"}</Text>
                </View>
              )}
            </>
          )}

          {/* Upcoming — not joined */}
          {!isCompleted && !isLive && !!start && start > now && !isJoined && (
            <ActionButton
              title={t("reserveSpot")}
              colors={["#6366f1", "#4f46e5"]}
              icon="calendar"
              onPress={handleJoin}
            />
          )}

          {/* Upcoming — joined */}
          {!isCompleted && !isLive && !!start && start > now && isJoined && (
            <View style={styles.timerBadge}>
              <Ionicons name="time-outline" size={18} color="#f59e0b" />
              <Text style={styles.timerText}>{t("startsSoon")}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

export default function ShikshastarScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { contests = [], loading: contestsLoading } = useContests();
  const userId = getAuth().currentUser?.uid;
  const { joined = {}, completed = {} } = useUserContests(userId || "");

  const [chip, setChip] = useState("all");
  const [userClass, setUserClass] = useState<number | null>(null);

  useEffect(() => {
    UserService.getUserClass().then(setUserClass);
  }, []);

  const now = new Date();

  const classFiltered = contests.filter((c: any) => {
    if (!userClass) return true;
    return !c.class || c.class.includes(userClass) || c.class.includes("all");
  });

  const limited = classFiltered.slice(0, 10);

  // Core filter: hide ended contests the student never joined
  const visibleContests = limited.filter((c: any) => {
    const end = getDate(c.endTime ?? c.endDate);
    const isEnded = end && end < now;
    const hasParticipated = !!joined[c.id] || !!completed[c.id];
    if (isEnded && !hasParticipated) return false;
    return true;
  });

  const live = visibleContests.filter((c: any) => {
    const s = getDate(c.startTime ?? c.startDate);
    const e = getDate(c.endTime   ?? c.endDate);
    return s && e && s <= now && now <= e;
  });
  const upcoming = visibleContests.filter((c: any) => {
    const s = getDate(c.startTime ?? c.startDate);
    return s && s > now;
  });
  const done = visibleContests.filter((c: any) => !!completed[c.id]);

  const data =
    chip === "all"      ? visibleContests.filter((c: any) => {
      const e = getDate(c.endTime ?? c.endDate);
      return !e || e >= now;   // "all" tab shows only active/upcoming
    })
    : chip === "live"      ? live
    : chip === "upcoming"  ? upcoming
    : done;

  if (contestsLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      <Header />
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(["all", "live", "upcoming", "completed"] as const).map((c) => (
            <Chip
              key={c}
              label={t(c === "all" ? "all" : c === "live" ? "live" : c === "upcoming" ? "upcoming" : "completed")}
              active={chip === c}
              onPress={() => setChip(c)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {data.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyText}>
              {chip === "completed"
                ? "You haven't completed any contests yet."
                : "No contests available right now."}
            </Text>
          </View>
        ) : (
          data.map((item: any) => (
            <ContestCard key={item.id} item={item} joined={joined} completed={completed} />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  chipBase: { paddingVertical: 10, paddingHorizontal: 20, marginRight: 10, borderRadius: 30, borderWidth: 1 },
  chipActive:   { backgroundColor: "#4f46e5", borderColor: "#4f46e5", elevation: 4 },
  chipInactive: { backgroundColor: "#fff", borderColor: "#e5e7eb" },
  chipText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  cardContainer: {
    marginBottom: 18, borderRadius: 24, backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08, shadowRadius: 15, elevation: 6,
  },
  cardInner: { borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  titleContainer: { flexDirection: "row", alignItems: "center", flex: 1 },
  contestTitle: { fontSize: 18, fontWeight: "800", color: "#1f2937", marginRight: 8 },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444", marginRight: 4 },
  liveText: { fontSize: 10, fontWeight: "800", color: "#ef4444" },
  doneBadge: { flexDirection: "row", alignItems: "center" },
  doneText: { fontSize: 12, color: "#10b981", fontWeight: "700", marginLeft: 4 },
  prizeRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 10, borderRadius: 14, borderWidth: 1, borderColor: "#f3f4f6" },
  prizeLabel: { fontSize: 14, color: "#6b7280", marginLeft: 8 },
  prizeValue: { fontSize: 15, fontWeight: "700", color: "#1f2937", marginLeft: "auto" },
  spotsRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  spotsText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  progressContainer: { marginTop: 15 },
  progressBarBg: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#4f46e5" },
  progressTimeText: { fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" },
  lessonBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, alignSelf: "flex-start", backgroundColor: "#ede9fe", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  lessonBadgeText: { fontSize: 11, color: "#6366f1", fontWeight: "700" },
  ctaWrapper: { marginTop: 16 },
  actionBtn: { paddingVertical: 14, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  timerBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, backgroundColor: "#fffbeb", borderRadius: 16, borderWidth: 1, borderColor: "#fef3c7" },
  timerText: { color: "#d97706", fontWeight: "700", marginLeft: 8 },
  leaderLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: "#1e1b4b", borderWidth: 1, borderColor: "#6366f133", marginTop: 8 },
  leaderLinkText: { color: "#a5b4fc", fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: "#6b7280", fontSize: 14, fontWeight: "600", textAlign: "center" },
});
