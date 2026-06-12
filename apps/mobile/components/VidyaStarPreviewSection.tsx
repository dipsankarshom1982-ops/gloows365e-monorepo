import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useContests } from "@/hooks/useContests";
import { useUserContests } from "@/hooks/useUserContests";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { getAuth } from "firebase/auth";
import { useEffect, useRef } from "react";
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ContestItem {
  id: string;
  title: string;
  prizePool?: string;
  startTime?: any;
  endTime?: any;
  startDate?: any;
  endDate?: any;
  description?: string;
  order?: number;
  isFeatured?: boolean;
  lessonStatus?: string;
  bannerMeta?: {
    emoji?: string;
    tagline?: string;
    gradientStart?: string;
    gradientEnd?: string;
  };
}

function parseDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

function getContestStatus(item: ContestItem): "live" | "upcoming" | "ended" {
  const now   = new Date();
  const start = parseDate(item.startTime ?? item.startDate);
  const end   = parseDate(item.endTime   ?? item.endDate);
  if (end && end < now) return "ended";
  if (start && start <= now && (!end || end > now)) return "live";
  return "upcoming";
}

const STATUS_CFG = {
  live:     { label: "🔴 LIVE",    bg: "#ef4444" },
  upcoming: { label: "⏰ Upcoming", bg: "#f59e0b" },
  ended:    { label: "✅ Ended",   bg: "#6b7280" },
};

function Pulse({ w, h, r = 10 }: { w: number; h: number; r?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4,  duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: "#334155", opacity: anim, marginRight: 12 }} />;
}

function ContestCard({
  item,
  joined,
  completed,
}: {
  item: ContestItem;
  joined: Record<string, any>;
  completed: Record<string, any>;
}) {
  const { t } = useAppTranslation();
  const status = getContestStatus(item);
  const cfg    = STATUS_CFG[status];
  const hasLesson = item.lessonStatus === "completed";
  const isParticipated = !!joined[item.id] || !!completed[item.id];

  const gradStart = item.bannerMeta?.gradientStart ?? "#1a0a2e";
  const gradEnd   = item.bannerMeta?.gradientEnd   ?? "#7c3aed";
  const emoji     = item.bannerMeta?.emoji ?? "🌟";

  const handlePress = () => {
    if (status === "ended" && isParticipated) {
      router.push({ pathname: "/contest/result", params: { contestId: item.id } });
    } else if (hasLesson) {
      router.push({ pathname: "/contest/lesson", params: { contestId: item.id } });
    } else {
      router.push("/(drawer)/(tabs)/vidyastar");
    }
  };

  return (
    <TouchableOpacity style={S.card} onPress={handlePress} activeOpacity={0.85}>
      <LinearGradient
        colors={[gradStart, gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={S.cardGrad}
      >
        <View style={S.cardTop}>
          <View style={[S.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={S.statusText}>{cfg.label}</Text>
          </View>

          <Text style={S.starIcon}>{emoji}</Text>
          <Text style={S.cardTitle} numberOfLines={2}>{item.title}</Text>

          {item.prizePool ? (
            <View style={S.prizeRow}>
              <Text style={S.prizeIcon}>🏆</Text>
              <Text style={S.prizeText}>{item.prizePool}</Text>
            </View>
          ) : null}

          {item.description ? (
            <Text style={S.desc} numberOfLines={2}>{item.description}</Text>
          ) : null}
        </View>

        <View style={S.cardBottom}>
          <View style={S.divider} />
          <TouchableOpacity
            style={[
              S.participateBtn,
              status === "live"   && S.participateBtnLive,
              status === "ended"  && S.participateBtnEnded,
              !hasLesson && status !== "ended" && S.participateBtnPending,
            ]}
            onPress={handlePress}
            activeOpacity={0.8}
          >
            <Text style={S.participateBtnText}>
              {status === "ended" && isParticipated
                ? t("viewResults")
                : isParticipated && hasLesson
                  ? "Continue Lesson"
                  : hasLesson
                    ? t("participateNow")
                    : "Coming Soon"}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function VidyaStarPreviewSection() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { contests: allContests, loading, error: fetchError } = useContests();
  const error = !!fetchError;

  const userId = getAuth().currentUser?.uid ?? "";
  const { joined = {}, completed = {} } = useUserContests(userId);

  const contests = allContests
    .map((d) => d as ContestItem)
    .filter((item) => {
      // Hide ended contests the student never participated in
      if (getContestStatus(item) === "ended") {
        return !!joined[item.id] || !!completed[item.id];
      }
      return true;
    })
    .sort((a, b) => {
      if ((b.isFeatured ? 1 : 0) !== (a.isFeatured ? 1 : 0))
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      return (a.order ?? 99) - (b.order ?? 99);
    })
    .slice(0, 6);

  return (
    <View style={S.section}>
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>{t("vidyaStarPreviewTitle")}</Text>
          <Text style={[S.sectionSub, { color: colors.textSecondary }]}>
            {t("vidyaStarPreviewSub")}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(drawer)/(tabs)/vidyastar")}>
          <Text style={S.viewAll}>{t("viewAll")}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", paddingLeft: 16 }}>
          {[0, 1, 2].map((i) => <Pulse key={i} w={180} h={230} r={16} />)}
        </View>
      ) : error ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>⚠️</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>{t("couldNotLoadContests")}</Text>
        </View>
      ) : contests.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>🌟</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>{t("contestsComingSoon")}</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={contests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContestCard item={item} joined={joined} completed={completed} />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  section:      { marginVertical: 16 },
  header:       { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  sectionSub:   { fontSize: 12, fontWeight: "500" },
  viewAll:      { fontSize: 13, fontWeight: "700", color: "#7c3aed", marginTop: 4 },

  card:     { marginRight: 12, width: 180, height: 230, borderRadius: 16, overflow: "hidden", elevation: 6, shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  cardGrad: { flex: 1, padding: 14, justifyContent: "space-between" },
  cardTop:  { flex: 1 },
  cardBottom: {},

  statusBadge: { alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  statusText:  { color: "#fff", fontSize: 10, fontWeight: "800" },

  starIcon:  { fontSize: 32, textAlign: "center", marginBottom: 8 },
  cardTitle: { color: "#fff", fontSize: 13, fontWeight: "800", lineHeight: 19, marginBottom: 8 },

  prizeRow:  { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  prizeIcon: { fontSize: 14 },
  prizeText: { color: "#fde68a", fontSize: 13, fontWeight: "800" },

  desc: { color: "rgba(255,255,255,0.7)", fontSize: 10, lineHeight: 14, marginBottom: 6 },

  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 8 },

  participateBtn:        { backgroundColor: "#6366f1", borderRadius: 8, paddingVertical: 9, alignItems: "center", borderWidth: 1, borderColor: "#818cf8", marginTop: 4 },
  participateBtnLive:    { backgroundColor: "#10b981", borderColor: "#10b981" },
  participateBtnEnded:   { backgroundColor: "#4b5563", borderColor: "#6b7280" },
  participateBtnPending: { backgroundColor: "#374151", borderColor: "#4b5563" },
  participateBtnText:    { color: "#fff", fontSize: 12, fontWeight: "800" },

  empty:     { height: 150, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 13, fontWeight: "500", textAlign: "center" },
});
