import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function ContestVideoScreen() {
  const { contestId } = useLocalSearchParams<{ contestId: string }>();
  const router = useRouter();

  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);

  useEffect(() => {
    if (!contestId) return;
    getDoc(doc(db, "contests", contestId as string)).then((snap) => {
      if (snap.exists()) setContest({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
  }, [contestId]);

  const player = useVideoPlayer(contest?.videoUrl ?? null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("playToEnd", () => setVideoEnded(true));
    return () => sub.remove();
  }, [player]);

  const goToQuiz = () => {
    router.push({ pathname: "/contest/quiz", params: { contestId } });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0f0c29", "#302b63"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {contest?.title ?? "Contest Video"}
        </Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Video Player */}
        {contest?.videoUrl ? (
          <VideoView
            player={player}
            style={styles.video}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off-outline" size={52} color="#4b5563" />
            <Text style={styles.noVideoText}>Video not available yet</Text>
            <Text style={styles.noVideoSub}>You can still take the quiz below</Text>
          </View>
        )}

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.contestTitle}>{contest?.title}</Text>
          {contest?.subject && (
            <View style={styles.subjectBadge}>
              <Text style={styles.subjectText}>{contest.subject}</Text>
            </View>
          )}
          {contest?.description && (
            <Text style={styles.desc}>{contest.description}</Text>
          )}
          {contest?.prizePool && (
            <View style={styles.prizeRow}>
              <Ionicons name="trophy" size={18} color="#f59e0b" />
              <Text style={styles.prizeText}>Prize Pool: ₹{contest.prizePool}</Text>
            </View>
          )}
        </View>

        {/* Tip */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={18} color="#6366f1" />
          <Text style={styles.tipText}>
            Watch the full video before starting the quiz for the best score!
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaContainer}>
        {videoEnded ? (
          <TouchableOpacity style={styles.startBtn} onPress={goToQuiz} activeOpacity={0.9}>
            <LinearGradient
              colors={["#6366f1", "#4f46e5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaBtnText}>Start Quiz →</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.skipBtn} onPress={goToQuiz} activeOpacity={0.85}>
              <Text style={styles.skipText}>Skip to Quiz</Text>
            </TouchableOpacity>
            <Text style={styles.watchHint}>Finish video to unlock quiz button</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#0f172a" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:      { width: 40, height: 40, justifyContent: "center" },
  headerTitle:  { flex: 1, color: "#fff", fontSize: 16, fontWeight: "800", textAlign: "center" },
  scroll:       { paddingBottom: 20 },
  video:        { width, height: (width * 9) / 16, backgroundColor: "#000" },
  noVideo:      {
    width, height: (width * 9) / 16,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  noVideoText:  { color: "#9ca3af", fontSize: 16, fontWeight: "700" },
  noVideoSub:   { color: "#6b7280", fontSize: 12 },
  infoCard:     {
    margin: 16,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  contestTitle: { color: "#f1f5f9", fontSize: 20, fontWeight: "900" },
  subjectBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#312e81",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  subjectText:  { color: "#a5b4fc", fontSize: 12, fontWeight: "700" },
  desc:         { color: "#94a3b8", fontSize: 14, lineHeight: 22 },
  prizeRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  prizeText:    { color: "#fbbf24", fontSize: 15, fontWeight: "700" },
  tipCard:      {
    marginHorizontal: 16,
    backgroundColor: "#1e1b4b",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#3730a3",
  },
  tipText:      { color: "#a5b4fc", fontSize: 13, flex: 1, lineHeight: 18 },
  ctaContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    padding: 16,
    paddingBottom: 28,
  },
  startBtn:     { borderRadius: 16, overflow: "hidden" },
  ctaGrad:      { paddingVertical: 16, alignItems: "center" },
  ctaBtnText:   { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 0.5 },
  ctaRow:       { gap: 8 },
  skipBtn:      {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  skipText:     { color: "#9ca3af", fontSize: 15, fontWeight: "700" },
  watchHint:    { color: "#6b7280", fontSize: 11, textAlign: "center" },
});
