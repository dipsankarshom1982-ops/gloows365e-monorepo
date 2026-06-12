import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { auth } from "@/lib/firebase";
import { getUserLessons } from "@/services/aiGuruFirestore";
import { AiGuruLesson } from "@/lib/aiGuru/types";
import { SUBJECT_ICONS } from "@/lib/aiGuru/constants";

export default function MyLessonsScreen() {
  const [lessons, setLessons]     = useState<AiGuruLesson[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLessons = useCallback(async (silent = false) => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    if (!silent) setLoading(true);
    const data = await getUserLessons(uid);
    setLessons(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchLessons(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLessons(true);
  };

  const renderLesson = ({ item }: { item: AiGuruLesson }) => {
    const icon    = SUBJECT_ICONS[item.subject] ?? "📚";
    const pct     = item.progress ?? 0;
    const completed = item.status === "completed";

    return (
      <TouchableOpacity
        style={S.lessonCard}
        activeOpacity={0.85}
        onPress={() => completed && router.push({ pathname: "/ai-guru/player", params: { lessonId: item.id } })}
        disabled={!completed}
      >
        <View style={S.lessonIconWrap}>
          <Text style={S.lessonIcon}>{icon}</Text>
        </View>
        <View style={S.lessonInfo}>
          <Text style={S.lessonSubject}>{item.subject} • Class {item.classLevel}</Text>
          <Text style={S.lessonChapter} numberOfLines={1}>{item.chapter}</Text>
          {item.topic ? <Text style={S.lessonTopic} numberOfLines={1}>{item.topic}</Text> : null}
          <View style={S.meta}>
            <Text style={S.metaTag}>{item.language}</Text>
            <Text style={S.metaTag}>{item.lessonStyle}</Text>
            {!completed && (
              <View style={[S.statusBadge, item.status === "generating" && S.badgeGenerating]}>
                <Text style={S.statusText}>
                  {item.status === "generating" ? "⏳ Generating" : "⚠️ Failed"}
                </Text>
              </View>
            )}
          </View>
          {completed && (
            <View style={S.progressWrap}>
              <View style={S.progressTrack}>
                <View style={[S.progressFill, { width: `${pct}%` as any }]} />
              </View>
              <Text style={S.progressLabel}>{pct}%</Text>
            </View>
          )}
        </View>
        {completed && (
          <TouchableOpacity
            style={S.resumeBtn}
            onPress={() => router.push({ pathname: "/ai-guru/player", params: { lessonId: item.id } })}
          >
            <Text style={S.resumeText}>Resume</Text>
            <Ionicons name="chevron-forward" size={14} color="#6366f1" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={["#0a0a1a", "#0f172a"]} style={S.bg}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#94a3b8" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>My AI Lessons</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(item) => item.id}
          renderItem={renderLesson}
          contentContainerStyle={S.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Text style={S.emptyEmoji}>📚</Text>
              <Text style={S.emptyTitle}>No lessons yet</Text>
              <Text style={S.emptySubtitle}>Generate your first AI lesson to get started</Text>
              <TouchableOpacity style={S.emptyBtn} onPress={() => router.push("/ai-guru/setup")} activeOpacity={0.85}>
                <LinearGradient colors={["#4f46e5", "#7c3aed"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.emptyBtnGrad}>
                  <Text style={S.emptyBtnText}>Generate Lesson ✨</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </LinearGradient>
  );
}

const S = StyleSheet.create({
  bg:             { flex: 1 },
  center:         { flex: 1, justifyContent: "center", alignItems: "center" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16 },
  backBtn:        { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  headerTitle:    { color: "#f1f5f9", fontSize: 18, fontWeight: "800" },
  list:           { padding: 16, gap: 12 },
  lessonCard:     { flexDirection: "row", backgroundColor: "#1e293b", borderRadius: 18, padding: 14, gap: 12, borderWidth: 1, borderColor: "#334155", alignItems: "flex-start" },
  lessonIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center" },
  lessonIcon:     { fontSize: 24 },
  lessonInfo:     { flex: 1, gap: 4 },
  lessonSubject:  { color: "#475569", fontSize: 11, fontWeight: "700" },
  lessonChapter:  { color: "#f1f5f9", fontSize: 15, fontWeight: "800" },
  lessonTopic:    { color: "#64748b", fontSize: 12 },
  meta:           { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  metaTag:        { backgroundColor: "#0f172a", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, color: "#475569", fontSize: 10, fontWeight: "700" },
  statusBadge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "#450a0a" },
  badgeGenerating:{ backgroundColor: "#1e3a5f" },
  statusText:     { color: "#94a3b8", fontSize: 10, fontWeight: "700" },
  progressWrap:   { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  progressTrack:  { flex: 1, height: 4, backgroundColor: "#0f172a", borderRadius: 3, overflow: "hidden" },
  progressFill:   { height: "100%", backgroundColor: "#6366f1", borderRadius: 3 },
  progressLabel:  { color: "#475569", fontSize: 10, width: 28 },
  resumeBtn:      { flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 8 },
  resumeText:     { color: "#6366f1", fontSize: 12, fontWeight: "700" },
  empty:          { alignItems: "center", paddingTop: 80, gap: 14, paddingHorizontal: 32 },
  emptyEmoji:     { fontSize: 56 },
  emptyTitle:     { color: "#f1f5f9", fontSize: 20, fontWeight: "900" },
  emptySubtitle:  { color: "#475569", fontSize: 14, textAlign: "center", lineHeight: 22 },
  emptyBtn:       { width: "100%", borderRadius: 14, overflow: "hidden", marginTop: 8 },
  emptyBtnGrad:   { paddingVertical: 14, alignItems: "center" },
  emptyBtnText:   { color: "#fff", fontSize: 16, fontWeight: "800" },
});
