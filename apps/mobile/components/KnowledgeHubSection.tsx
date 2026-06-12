import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const KB_CATS = [
  "All", "Educational", "Motivational", "Skill Development", "Lifestyle",
  "Health", "Technology", "Mind Development", "Career", "General Knowledge",
  "Personality Development", "Communication", "Financial Awareness",
  "Digital Skills", "Creativity", "Productivity",
];

interface KBVideo {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  category?: string;
  tags?: string[];
  duration?: string;
  uploadedBy?: string;
  viewsCount?: number;
  likesCount?: number;
  isFeatured?: boolean;
  isActive: boolean;
  order?: number;
  createdAt?: any;
}

function fmtViews(n?: number) {
  if (!n) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtDate(ts?: any): string {
  if (!ts) return "";
  const d = ts.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Skeleton ─────────────────────────────────────────────────
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

// ─── Video card ───────────────────────────────────────────────
function KBCard({ item }: { item: KBVideo }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[S.card, { backgroundColor: colors.card }]}
      onPress={() =>
        router.push({
          pathname: "/video-detail" as any,
          params: { id: item.id, videoUrl: item.videoUrl ?? "", title: item.title },
        })
      }
      activeOpacity={0.85}
    >
      {/* Thumbnail */}
      <View style={S.thumbWrap}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={S.thumb} resizeMode="cover" />
        ) : (
          <LinearGradient colors={["#0f172a", "#1e3a5f"]} style={S.thumbPlaceholder}>
            <Ionicons name="tv-outline" size={28} color="#60a5fa" />
          </LinearGradient>
        )}
        {/* Play overlay */}
        <View style={S.playBtn}>
          <Ionicons name="play" size={12} color="#fff" />
        </View>
        {/* Duration */}
        {item.duration ? (
          <View style={S.durationBadge}>
            <Text style={S.durationText}>{item.duration}</Text>
          </View>
        ) : null}
        {/* Category tag on thumb */}
        {item.category ? (
          <View style={S.catBadge}>
            <Text style={S.catBadgeText} numberOfLines={1}>{item.category}</Text>
          </View>
        ) : null}
      </View>

      {/* Info */}
      <View style={S.info}>
        <Text style={[S.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
        <View style={S.bottomRow}>
          <Text style={[S.metaText, { color: colors.textSecondary }]}>
            👁 {fmtViews(item.viewsCount)}
          </Text>
          {item.createdAt ? (
            <Text style={[S.metaText, { color: colors.textSecondary }]}>
              {fmtDate(item.createdAt)}
            </Text>
          ) : null}
        </View>
        {item.likesCount !== undefined && (
          <Text style={[S.metaText, { color: colors.textSecondary }]}>❤️ {fmtViews(item.likesCount)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main section ─────────────────────────────────────────────
export default function KnowledgeHubSection() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [videos,    setVideos]    = useState<KBVideo[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [activecat, setActivecat] = useState("All");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, "knowledgeVideos"),
          where("isActive", "==", true),
          limit(10)
        ));
        setVideos(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .sort((a, b) => {
              if ((b.isFeatured ? 1 : 0) !== (a.isFeatured ? 1 : 0))
                return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
              return (a.order ?? 99) - (b.order ?? 99);
            })
        );
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = activecat === "All"
    ? videos
    : videos.filter((v) => v.category === activecat);

  return (
    <View style={S.section}>
      {/* Header */}
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>{t("knowledgeHubTitle")}</Text>
          <Text style={[S.sectionSub, { color: colors.textSecondary }]}>
            {t("knowledgeHubSub")}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/knowledge-hub" as any)}>
          <Text style={S.viewAll}>{t("watchMore")}</Text>
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}
      >
        {KB_CATS.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              S.chip,
              {
                backgroundColor: activecat === cat ? "#1e3a5f" : colors.card,
                borderColor:     activecat === cat ? "#3b82f6" : colors.border,
              },
            ]}
            onPress={() => setActivecat(cat)}
          >
            <Text style={[S.chipText, { color: activecat === cat ? "#60a5fa" : colors.textSecondary }]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={{ flexDirection: "row", paddingLeft: 16 }}>
          {[0, 1, 2].map((i) => <Pulse key={i} w={160} h={200} r={12} />)}
        </View>
      ) : error ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>⚠️</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>{t("couldNotLoadVideos")}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>🎥</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>
            {activecat === "All" ? t("moreVideosSoon") : t("noVideosInCat", { cat: activecat })}
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <KBCard item={item} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
        />
      )}

      {/* Bottom divider spacing */}
      <View style={{ height: 8 }} />
    </View>
  );
}

const S = StyleSheet.create({
  section:      { marginVertical: 16 },
  header:       { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  sectionSub:   { fontSize: 12, fontWeight: "500" },
  viewAll:      { fontSize: 13, fontWeight: "700", color: "#3b82f6", marginTop: 4 },

  chip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontWeight: "700" },

  card:      { width: 160, marginRight: 12, borderRadius: 14, overflow: "hidden", elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 },
  thumbWrap: { position: "relative", width: 160, height: 100 },
  thumb:     { width: 160, height: 100 },
  thumbPlaceholder: { width: 160, height: 100, justifyContent: "center", alignItems: "center" },

  playBtn: {
    position: "absolute", top: "50%", left: "50%",
    marginLeft: -13, marginTop: -13,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },

  durationBadge: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  durationText:  { color: "#fff", fontSize: 10, fontWeight: "700" },

  catBadge: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(59,130,246,0.85)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 90 },
  catBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  info:      { padding: 9 },
  cardTitle: { fontSize: 12, fontWeight: "700", lineHeight: 17, marginBottom: 5 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  metaText:  { fontSize: 10, fontWeight: "600" },

  empty:     { height: 140, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 13, fontWeight: "500", textAlign: "center" },
});
