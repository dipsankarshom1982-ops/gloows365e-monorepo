import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { db } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface StarProfile {
  id: string;
  studentId?: string;
  studentName: string;
  className: string;
  schoolName: string;
  profileImageUrl?: string;
  achievementTitle: string;
  achievementDescription?: string;
  category?: string;
  badgeText?: string;
  rankText?: string;
  likesCount?: number;
  viewsCount?: number;
  isFeatured?: boolean;
  order?: number;
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
  return (
    <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: "#334155", opacity: anim, marginRight: 12 }} />
  );
}

// ─── Star card ────────────────────────────────────────────────
function StarCard({ item }: { item: StarProfile }) {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const initial = item.studentName?.charAt(0)?.toUpperCase() ?? "S";

  return (
    <TouchableOpacity
      style={[S.card, { backgroundColor: colors.card, borderColor: "#fbbf2430" }]}
      activeOpacity={0.85}
    >
      {/* Avatar */}
      <View style={S.avatarWrap}>
        {item.profileImageUrl ? (
          <Image source={{ uri: item.profileImageUrl }} style={S.avatar} />
        ) : (
          <LinearGradient colors={["#78350f", "#d97706"]} style={S.avatarPlaceholder}>
            <Text style={S.avatarInitial}>{initial}</Text>
          </LinearGradient>
        )}
        {item.isFeatured && (
          <View style={S.starBadge}>
            <Text style={{ fontSize: 10 }}>⭐</Text>
          </View>
        )}
      </View>

      {/* Name */}
      <Text style={[S.name, { color: colors.text }]} numberOfLines={1}>{item.studentName}</Text>

      {/* Class */}
      <Text style={[S.classText, { color: colors.textSecondary }]}>{t("class")} {item.className}</Text>

      {/* School */}
      <Text style={[S.schoolText, { color: colors.textSecondary }]} numberOfLines={1}>{item.schoolName}</Text>

      {/* Achievement */}
      <LinearGradient colors={["rgba(251,191,36,0.12)", "rgba(217,119,6,0.08)"]} style={S.achievementBox}>
        <Text style={S.achievementText} numberOfLines={2}>{item.achievementTitle}</Text>
      </LinearGradient>

      {/* Badge chip */}
      {item.badgeText ? (
        <View style={S.badgeChip}>
          <Text style={S.badgeChipText}>{item.badgeText}</Text>
        </View>
      ) : null}

      {/* Rank */}
      {item.rankText ? (
        <Text style={[S.rankText, { color: "#f59e0b" }]}>🏅 {item.rankText}</Text>
      ) : null}

      {/* Stats */}
      {(item.likesCount !== undefined || item.viewsCount !== undefined) ? (
        <View style={S.statsRow}>
          {item.likesCount !== undefined && <Text style={[S.statText, { color: colors.textSecondary }]}>❤️ {item.likesCount}</Text>}
          {item.viewsCount !== undefined && <Text style={[S.statText, { color: colors.textSecondary }]}>👁 {item.viewsCount}</Text>}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Main section ─────────────────────────────────────────────
export default function ShikshaStarPreviewSection() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [stars,   setStars]   = useState<StarProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, "shikshaStars"),
          where("isActive", "==", true),
          limit(10)
        ));
        setStars(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .sort((a, b) => {
              // Featured first, then by order
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

  return (
    <View style={S.section}>
      {/* Header */}
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>{t("shikshaStarPreviewTitle")}</Text>
          <Text style={[S.sectionSub, { color: colors.textSecondary }]}>
            {t("shikshaStarPreviewSub")}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(drawer)/(tabs)/vidyastar")}>
          <Text style={S.viewAll}>{t("viewStars")}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", paddingLeft: 16 }}>
          {[0, 1, 2].map((i) => <Pulse key={i} w={140} h={220} r={14} />)}
        </View>
      ) : error ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>⚠️</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>{t("couldNotLoadStars")}</Text>
        </View>
      ) : stars.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>🌟</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>
            {t("shikshaStarEmpty")}
          </Text>
          <TouchableOpacity style={[S.becomeBtn, { borderColor: "#f59e0b" }]}>
            <Text style={[S.becomeBtnText, { color: "#f59e0b" }]}>{t("becomeShikshaStar")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            horizontal
            data={stars}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <StarCard item={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
          />
          {/* Secondary CTA */}
          <TouchableOpacity style={[S.becomeBtnRow]}>
            <Text style={[S.becomeBtnRowText, { color: colors.textSecondary }]}>
              ✨ Think you deserve a star? —{" "}
              <Text style={{ color: "#f59e0b", fontWeight: "700" }}>{t("becomeShikshaStar")}</Text>
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  section:      { marginVertical: 16 },
  header:       { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  sectionSub:   { fontSize: 12, fontWeight: "500" },
  viewAll:      { fontSize: 13, fontWeight: "700", color: "#f59e0b", marginTop: 4 },

  card: {
    width: 140, marginRight: 12, borderRadius: 16, borderWidth: 1,
    padding: 12, alignItems: "center",
    shadowColor: "#f59e0b", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },

  avatarWrap:        { position: "relative", marginBottom: 8 },
  avatar:            { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: "#fbbf24" },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  avatarInitial:     { color: "#fff", fontSize: 24, fontWeight: "900" },
  starBadge:         { position: "absolute", bottom: -2, right: -2, backgroundColor: "#fbbf24", borderRadius: 10, width: 20, height: 20, justifyContent: "center", alignItems: "center" },

  name:      { fontSize: 13, fontWeight: "800", textAlign: "center", marginBottom: 2 },
  classText: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  schoolText:{ fontSize: 10, textAlign: "center", marginBottom: 6 },

  achievementBox: { width: "100%", borderRadius: 8, padding: 7, marginVertical: 6 },
  achievementText:{ color: "#d97706", fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 16 },

  badgeChip:     { backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 2 },
  badgeChipText: { color: "#92400e", fontSize: 10, fontWeight: "800" },

  rankText:  { fontSize: 11, fontWeight: "700", marginTop: 4 },
  statsRow:  { flexDirection: "row", gap: 8, marginTop: 6 },
  statText:  { fontSize: 10, fontWeight: "600" },

  empty:       { height: 160, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  emptyIcon:   { fontSize: 40, marginBottom: 8 },
  emptyText:   { fontSize: 13, fontWeight: "500", textAlign: "center", marginBottom: 12 },
  becomeBtn:   { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  becomeBtnText: { fontSize: 13, fontWeight: "700" },

  becomeBtnRow:     { marginHorizontal: 16, marginTop: 10 },
  becomeBtnRowText: { fontSize: 12, fontWeight: "500", textAlign: "center" },
});
