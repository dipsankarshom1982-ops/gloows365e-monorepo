// PATH: components/SkillBattlePreviewSection.tsx
// Shows LIVE battles only in homepage preview
// Same logic, updated status derivation

import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { db } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Animated, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Battle {
  id:               string;
  title:            string;
  description?:     string;
  sponsor?:         string;
  month?:           string;
  startDate?:       string;
  endDate?:         string;
  isActive?:        unknown;
  totalPool?:       string;
  participantCount?: number;
  vcoin_india?:     number;
  vcoin_state?:     number;
  vcoin_district?:  number;
}

// Only show battles where startDate ≤ now ≤ endDate
function isLiveBattle(b: Battle): boolean {
  const now   = Date.now();
  const start = b.startDate ? new Date(b.startDate).getTime() : 0;
  const end   = b.endDate   ? new Date(b.endDate).getTime()   : Infinity;
  return now >= start && now <= end;
}

const getTimeLeft = (endDate?: string): string => {
  if (!endDate) return "Ongoing";
  const diff = new Date(endDate).getTime() - Date.now();
  if (isNaN(diff) || diff <= 0) return "Ended";
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function Pulse({ w, h, r = 12 }: { w: number; h: number; r?: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: "#1e293b", opacity: anim, marginRight: 12 }} />;
}

function BattleCard({ item, index }: { item: Battle; index: number }) {
  const { t } = useAppTranslation();
  const timeLeft    = getTimeLeft(item.endDate);
  const totalVCoins = (item.vcoin_india ?? 0) + (item.vcoin_state ?? 0) + (item.vcoin_district ?? 0);

  const gradients: [string, string, string][] = [
    ["#0f0c29", "#302b63", "#24243e"],
    ["#1a0533", "#4c1d95", "#6d28d9"],
    ["#1c0a00", "#7c2d12", "#b45309"],
    ["#052e16", "#065f46", "#0f766e"],
    ["#0c1a2e", "#1e3a5f", "#1d4ed8"],
  ];

  return (
    <TouchableOpacity style={S.cardWrap} onPress={() => router.push("/(drawer)/(tabs)/skillbattle")} activeOpacity={0.88}>
      <LinearGradient colors={gradients[index % gradients.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.card}>
        <View style={S.cardOrb} />

        {/* LIVE badge */}
        <View style={S.cardTopRow}>
          <View style={S.liveDot} />
          <View style={S.liveBadge}>
            <Text style={S.liveText}>🔴 LIVE · {timeLeft}</Text>
          </View>
        </View>

        <Text style={S.trophy}>🏆</Text>
        <Text style={S.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.sponsor ? <Text style={S.sponsor} numberOfLines={1}>⚡ {item.sponsor}</Text> : null}

        <View style={S.statsRow}>
          {totalVCoins > 0 && <View style={S.statChip}><Text style={S.statChipText}>🪙 {fmt(totalVCoins)}</Text></View>}
          {(item.participantCount ?? 0) > 0 && <View style={S.statChip}><Text style={S.statChipText}>👥 {fmt(item.participantCount!)}</Text></View>}
          {item.totalPool ? <View style={[S.statChip, S.poolChip]}><Text style={[S.statChipText, { color: "#fde68a" }]}>🎁 {item.totalPool}</Text></View> : null}
        </View>

        <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.cta}>
          <Text style={S.ctaText}>{t("participateNow") ?? "Join Now →"}</Text>
        </LinearGradient>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function SkillBattlePreviewSection() {
  const { colors, isDarkMode } = useTheme();
  const { t }    = useAppTranslation();
  const [items,   setItems]   = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "skillBattles"));
        const all = snap.docs.map((d) => {
          const raw = d.data();
          const cleaned: Record<string, unknown> = {};
          Object.entries(raw).forEach(([k, v]) => { cleaned[k.trim()] = v; });
          return { id: d.id, ...cleaned } as Battle;
        });
        // Homepage preview shows LIVE battles only
        const live = all
          .filter((b) => Boolean(b.isActive) && isLiveBattle(b))
          .sort((a, b) => {
            const da  = new Date(a.startDate ?? a.month ?? "").getTime() || 0;
            const db_ = new Date(b.startDate ?? b.month ?? "").getTime() || 0;
            return db_ - da;
          })
          .slice(0, 5);
        setItems(live);
      } catch { setError(true); }
      finally  { setLoading(false); }
    })();
  }, []);

  if (!loading && !error && items.length === 0) return null;

  return (
    <View style={S.section}>
      <View style={S.header}>
        <View style={S.headerLeft}>
          <LinearGradient colors={["#6366f1", "#8b5cf6"]} style={S.headerIcon}>
            <Text style={{ fontSize: 14 }}>⚔️</Text>
          </LinearGradient>
          <View>
            <Text style={[S.sectionTitle, { color: colors.text }]}>
              {t("skillBattlePreviewTitle") ?? "Skill Battles"}
            </Text>
            <Text style={[S.sectionSub, { color: colors.textSecondary }]}>
              Live now · Compete & win prizes
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push("/(drawer)/(tabs)/skillbattle")} style={S.viewAllBtn}>
          <Text style={S.viewAllText}>{t("seeAll") ?? "See All"}</Text>
          <Text style={{ color: "#8b5cf6", fontSize: 12 }}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", paddingLeft: 16 }}>
          {[0, 1].map((i) => <Pulse key={i} w={200} h={240} r={20} />)}
        </View>
      ) : error ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>⚠️</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>{t("couldNotLoadBattles") ?? "Could not load battles"}</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <BattleCard item={item} index={index} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 8, paddingBottom: 4 }}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  section: { marginVertical: 14 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 14 },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionTitle:{ fontSize: 17, fontWeight: "800" },
  sectionSub:  { fontSize: 11, fontWeight: "500", marginTop: 1 },
  viewAllBtn:  { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(139,92,246,0.12)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  viewAllText: { fontSize: 12, fontWeight: "700", color: "#8b5cf6" },

  cardWrap: { marginRight: 12, borderRadius: 20, overflow: "hidden", elevation: 8, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10 },
  card:     { width: 200, padding: 16, minHeight: 240, justifyContent: "flex-end", overflow: "hidden" },
  cardOrb:  { position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.05)" },

  cardTopRow: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#ef4444" },
  liveBadge:  { backgroundColor: "rgba(239,68,68,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(239,68,68,0.35)" },
  liveText:   { color: "#fca5a5", fontSize: 10, fontWeight: "800" },

  trophy:    { fontSize: 36, marginBottom: 6 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "800", lineHeight: 20, marginBottom: 4 },
  sponsor:   { color: "rgba(251,191,36,0.9)", fontSize: 10, fontWeight: "700", marginBottom: 8 },

  statsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 10 },
  statChip:    { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  poolChip:    { backgroundColor: "rgba(251,191,36,0.15)" },
  statChipText:{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "700" },

  cta:     { borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },

  empty:     { height: 160, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 13, fontWeight: "500", textAlign: "center" },
});
