import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/lib/firebase";
import { listenLeaderboard } from "@/lib/listenLeaderboard";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// India top 100 cash prize structure
const PRIZES: Record<string, { rank: string; reward: string; emoji: string; color: string }[]> = {
  daily: [
    { rank: "1st Place",  reward: "500 VCoins",  emoji: "🥇", color: "#fbbf24" },
    { rank: "2nd Place",  reward: "300 VCoins",  emoji: "🥈", color: "#94a3b8" },
    { rank: "3rd Place",  reward: "100 VCoins",  emoji: "🥉", color: "#d97706" },
    { rank: "Top 10",     reward: "20 VCoins",   emoji: "⭐", color: "#6366f1" },
  ],
  weekly: [
    { rank: "1st Place",  reward: "2000 VCoins", emoji: "🥇", color: "#fbbf24" },
    { rank: "2nd Place",  reward: "1000 VCoins", emoji: "🥈", color: "#94a3b8" },
    { rank: "3rd Place",  reward: "500 VCoins",  emoji: "🥉", color: "#d97706" },
    { rank: "Top 10",     reward: "100 VCoins",  emoji: "⭐", color: "#6366f1" },
  ],
  monthly: [
    { rank: "1st Place",  reward: "₹500 Cash",   emoji: "🥇", color: "#fbbf24" },
    { rank: "2nd Place",  reward: "₹200 Cash",   emoji: "🥈", color: "#94a3b8" },
    { rank: "3rd Place",  reward: "₹100 Cash",   emoji: "🥉", color: "#d97706" },
    { rank: "Top 10",     reward: "₹50 Cash",    emoji: "⭐", color: "#6366f1" },
    { rank: "Top 50",     reward: "₹20 Cash",    emoji: "🎖️", color: "#059669" },
    { rank: "Top 100",    reward: "₹10 Cash",    emoji: "🏅", color: "#0ea5e9" },
  ],
  yearly: [
    { rank: "1st Place",  reward: "₹5000 Cash",  emoji: "🥇", color: "#fbbf24" },
    { rank: "2nd Place",  reward: "₹2000 Cash",  emoji: "🥈", color: "#94a3b8" },
    { rank: "3rd Place",  reward: "₹1000 Cash",  emoji: "🥉", color: "#d97706" },
    { rank: "Top 10",     reward: "₹200 Cash",   emoji: "⭐", color: "#6366f1" },
    { rank: "Top 50",     reward: "₹100 Cash",   emoji: "🎖️", color: "#059669" },
    { rank: "Top 100",    reward: "₹50 Cash",    emoji: "🏅", color: "#0ea5e9" },
  ],
};

const TABS = ["daily", "weekly", "monthly", "yearly"] as const;

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const router = useRouter();
  const uid    = auth.currentUser?.uid ?? "";

  const [data,       setData]       = useState<any[]>([]);
  const [tab,        setTab]        = useState<typeof TABS[number]>("weekly");
  const [showPrizes, setShowPrizes] = useState(false);

  useEffect(() => {
    const unsub = listenLeaderboard(tab, setData);
    return () => unsub();
  }, [tab]);

  const podium    = data.slice(0, 3);
  const rest      = data.slice(3);
  const myIndex   = data.findIndex((u) => u.userId === uid);
  const myData    = myIndex >= 0 ? data[myIndex] : null;
  const pointsGap = myIndex > 0 ? (data[myIndex - 1]?.points ?? 0) - (myData?.points ?? 0) : 0;

  const prizes = PRIZES[tab] ?? [];

  return (
    <SafeAreaView style={S.container}>
      {/* Header */}
      <LinearGradient colors={["#0f0c29", "#302b63"]} style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>🏆 {t("leaderboardLabel") ?? "India Leaderboard"}</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      {/* Time tabs */}
      <View style={[S.tabRow, { backgroundColor: colors.background }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[S.tabBtn, tab === t && S.tabBtnActive]}
          >
            <Text style={[S.tabText, tab === t && S.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* India top 100 banner */}
      <View style={S.indiaBanner}>
        <Ionicons name="globe-outline" size={14} color="#6366f1" />
        <Text style={S.indiaBannerText}>
          🇮🇳 India Top 100 — Cash prizes for monthly & yearly
        </Text>
      </View>

      <FlatList
        data={rest}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            {/* YOUR STATS CARD */}
            <LinearGradient
              colors={["#1e1b4b", "#312e81", "#1e1b4b"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={S.statsCard}
            >
              <View style={S.statsLeft}>
                <Text style={S.statsLabel}>{t("yourRank") ?? "Your Score"}</Text>
                <Text style={S.statsScore}>{myData?.points ?? "—"}</Text>
                <Text style={S.statsClass}>
                  {myData?.name ?? auth.currentUser?.email?.split("@")[0] ?? "Student"}
                </Text>
              </View>
              <View style={S.statsDivider} />
              <View style={S.statsRight}>
                <View style={S.statItem}>
                  <Text style={S.statVal}>
                    {myData ? `#${myData.rank}` : "—"}
                  </Text>
                  <Text style={S.statLbl}>India Rank</Text>
                </View>
                <View style={S.statItem}>
                  <Text style={S.statVal}>
                    {pointsGap > 0 ? `+${pointsGap}` : "🔝"}
                  </Text>
                  <Text style={S.statLbl}>
                    {pointsGap > 0 ? "pts to next" : "Top rank"}
                  </Text>
                </View>
                <View style={S.statItem}>
                  <Text style={S.statVal}>
                    {myData?.trend === "up" ? "▲" : myData?.trend === "down" ? "▼" : "—"}
                  </Text>
                  <Text style={S.statLbl}>Trend</Text>
                </View>
              </View>
            </LinearGradient>

            {/* PRIZES SECTION */}
            <TouchableOpacity
              style={S.prizesToggle}
              onPress={() => setShowPrizes((v) => !v)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#92400e", "#d97706"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={S.prizesToggleGrad}
              >
                <Text style={S.prizesToggleText}>🎁 Prizes this {tab}</Text>
                <Ionicons
                  name={showPrizes ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#fff"
                />
              </LinearGradient>
            </TouchableOpacity>

            {showPrizes && (
              <View style={S.prizesCard}>
                <Text style={S.prizesSubhead}>🇮🇳 India Rankings</Text>
                {prizes.map((p) => (
                  <View key={p.rank} style={S.prizeRow}>
                    <Text style={S.prizeEmoji}>{p.emoji}</Text>
                    <Text style={S.prizeRank}>{p.rank}</Text>
                    <Text style={[S.prizeReward, { color: p.color }]}>{p.reward}</Text>
                  </View>
                ))}
                <Text style={S.prizeNote}>* Prizes credited within 48 hrs of period end</Text>
                {(tab === "monthly" || tab === "yearly") && (
                  <Text style={S.prizeNote}>* Cash sent via UPI to registered number</Text>
                )}
              </View>
            )}

            {/* PODIUM */}
            {podium.length > 0 && (
              <View style={S.podiumWrap}>
                {[podium[1], podium[0], podium[2]].map((u, i) => {
                  if (!u) return null;
                  const pos   = [1, 0, 2][i];
                  const medal = ["🥈", "🥇", "🥉"][i];
                  const ht    = [100, 130, 85][i];
                  const clr   = ["#94a3b8", "#fbbf24", "#d97706"][i];
                  return (
                    <View key={u.userId} style={S.podItem}>
                      <Text style={S.podMedal}>{medal}</Text>
                      <Text style={S.podName} numberOfLines={1}>{u.name}</Text>
                      <Text style={S.podPoints}>{u.points} pts</Text>
                      <LinearGradient
                        colors={["#1e293b", "#0f172a"]}
                        style={[S.podBar, { height: ht, borderTopColor: clr }]}
                      >
                        <Text style={[S.podRankNum, { color: clr }]}>#{pos + 1}</Text>
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={S.listHeader}>ALL INDIA RANKINGS</Text>
          </>
        }
        renderItem={({ item }) => {
          const isMe = item.userId === uid;
          // highlight top 100 cash prize eligible rows
          const isCashEligible = (tab === "monthly" || tab === "yearly") && item.rank <= 100;
          return (
            <View style={[S.row, isMe && S.rowMe]}>
              <Text style={[S.rowRank, isMe && { color: "#818cf8" }]}>#{item.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[S.rowName, isMe && { color: "#818cf8", fontWeight: "800" }]}>
                  {isMe ? "You" : item.name}
                </Text>
                {item.state || item.class ? (
                  <Text style={S.rowSub}>
                    {[item.state, item.class ? `Class ${item.class}` : null]
                      .filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
              {isCashEligible && (
                <View style={S.cashBadge}>
                  <Text style={S.cashBadgeText}>💰</Text>
                </View>
              )}
              <Text style={[S.rowPoints, isMe && { color: "#818cf8" }]}>
                {item.points} pts
              </Text>
              <Text style={S.rowTrend}>
                {item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "—"}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={S.empty}>
            <Ionicons name="trophy-outline" size={48} color="#374151" />
            <Text style={S.emptyText}>No data yet for this period</Text>
          </View>
        }
      />

      {/* Sticky bottom "You" bar */}
      {myData && (
        <View style={S.stickyMe}>
          <Text style={S.stickyRank}>#{myData.rank}</Text>
          <Text style={S.stickyName}>You · {myData.points} pts</Text>
          {(tab === "monthly" || tab === "yearly") && myData.rank <= 100 && (
            <Text style={S.stickyPrize}>💰 Cash eligible!</Text>
          )}
          {pointsGap > 0 && myData.rank > 100 && (
            <Text style={S.stickyGap}>{pointsGap} pts to #{myData.rank - 1}</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#0f172a" },

  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 38, height: 38, justifyContent: "center" },
  headerTitle: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center" },

  tabRow:      { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabBtn:      { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: "center", backgroundColor: "#1e293b" },
  tabBtnActive:{ backgroundColor: "#4f46e5" },
  tabText:     { fontSize: 11, fontWeight: "700", color: "#64748b" },
  tabTextActive: { color: "#fff" },

  indiaBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 12, marginBottom: 6, backgroundColor: "rgba(99,102,241,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)" },
  indiaBannerText: { color: "#818cf8", fontSize: 11, fontWeight: "700", flex: 1 },

  statsCard:   { marginHorizontal: 12, marginTop: 4, borderRadius: 22, padding: 18, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
  statsLeft:   { flex: 1 },
  statsLabel:  { color: "#a5b4fc", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  statsScore:  { color: "#fff", fontSize: 34, fontWeight: "900", lineHeight: 40 },
  statsClass:  { color: "#6366f1", fontSize: 12, fontWeight: "700", marginTop: 2 },
  statsDivider:{ width: 1, height: 60, backgroundColor: "rgba(255,255,255,0.1)" },
  statsRight:  { gap: 8 },
  statItem:    { alignItems: "center" },
  statVal:     { color: "#f1f5f9", fontSize: 16, fontWeight: "900" },
  statLbl:     { color: "#64748b", fontSize: 9, fontWeight: "700" },

  prizesToggle:     { marginHorizontal: 12, marginBottom: 6, borderRadius: 16, overflow: "hidden" },
  prizesToggleGrad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 18 },
  prizesToggleText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  prizesCard:       { marginHorizontal: 12, backgroundColor: "#1e293b", borderRadius: 16, padding: 14, marginBottom: 12, gap: 10 },
  prizesSubhead:    { color: "#94a3b8", fontSize: 12, fontWeight: "800", letterSpacing: 0.3, marginBottom: 2 },
  prizeRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  prizeEmoji:  { fontSize: 22, width: 30 },
  prizeRank:   { flex: 1, color: "#cbd5e1", fontSize: 13, fontWeight: "700" },
  prizeReward: { fontSize: 14, fontWeight: "900" },
  prizeNote:   { color: "#475569", fontSize: 10, marginTop: 2 },

  podiumWrap:  { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", marginHorizontal: 12, marginBottom: 16, gap: 6 },
  podItem:     { flex: 1, alignItems: "center" },
  podMedal:    { fontSize: 28 },
  podName:     { color: "#e2e8f0", fontSize: 11, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  podPoints:   { color: "#94a3b8", fontSize: 10, marginBottom: 6 },
  podBar:      { width: "100%", borderRadius: 12, borderTopWidth: 3, justifyContent: "center", alignItems: "center" },
  podRankNum:  { fontSize: 18, fontWeight: "900", marginTop: 8 },

  listHeader:  { color: "#475569", fontSize: 12, fontWeight: "800", paddingHorizontal: 16, marginBottom: 6, letterSpacing: 1 },

  row:         { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  rowMe:       { backgroundColor: "rgba(99,102,241,0.08)" },
  rowRank:     { width: 44, color: "#64748b", fontWeight: "800", fontSize: 13 },
  rowName:     { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
  rowSub:      { color: "#475569", fontSize: 11, marginTop: 2 },
  rowPoints:   { color: "#94a3b8", fontSize: 13, fontWeight: "700", marginRight: 8 },
  rowTrend:    { width: 20, color: "#475569", textAlign: "center", fontSize: 12 },
  cashBadge:   { marginRight: 6 },
  cashBadgeText: { fontSize: 14 },

  empty:       { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText:   { color: "#374151", fontSize: 15, fontWeight: "600" },

  stickyMe:    {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#312e81",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#4f46e5",
  },
  stickyRank:  { color: "#a5b4fc", fontSize: 18, fontWeight: "900" },
  stickyName:  { flex: 1, color: "#e2e8f0", fontSize: 14, fontWeight: "700" },
  stickyGap:   { color: "#818cf8", fontSize: 12, fontWeight: "600" },
  stickyPrize: { color: "#fbbf24", fontSize: 12, fontWeight: "800" },
});
