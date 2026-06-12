// PATH: app/vcoins/wallet.tsx
// Changes:
//  • Added VCoins Leaderboard section (top 10 by default, "See More" for top 100)
//  • Shows user's own rank highlighted
//  • Rankings based on vCoinsYear_{currentYear} field

import { useAppTranslation } from "@/context/LanguageContext";
import { useVCoins } from "@/hooks/useVCoins";
import { auth, db } from "@/lib/firebase";
import { VCoinTransaction } from "@/services/vCoinsService";
import {
  formatTransactionDate,
  formatVCoins,
  getStatusColor,
  getTransactionColor,
  getVCoinsSourceIcon,
  getVCoinsSourceIconBg,
  getVCoinsSourceIconColor
} from "@/utils/formatVCoins";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FilterTab = "ALL" | "EARNED" | "SPENT" | "PENDING";
type TabView   = "wallet" | "leaderboard";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL",     label: "All" },
  { key: "EARNED",  label: "Earned" },
  { key: "SPENT",   label: "Spent" },
  { key: "PENDING", label: "Pending" },
];

const EARN_SOURCES = [
  { icon: "time-outline",         label: "Learning Time",  bg: "#EDE9FE", color: "#7C3AED" },
  { icon: "play-circle-outline",  label: "Watch Reels",    bg: "#FEF3C7", color: "#D97706" },
  { icon: "videocam-outline",     label: "Watch Videos",   bg: "#DBEAFE", color: "#2563EB" },
  { icon: "sparkles-outline",     label: "AI Guru",        bg: "#F0FDF4", color: "#16A34A" },
  { icon: "trophy-outline",       label: "SkillBattle",    bg: "#FEF9C3", color: "#CA8A04" },
];

interface RankEntry {
  uid:      string;
  name:     string;
  school:   string;
  profilePic: string;
  yearCoins: number;
  rank:     number;
}

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const currentYear = new Date().getFullYear();
const YEAR_FIELD  = `vCoinsYear_${currentYear}`;

export default function VCoinsWalletScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useAppTranslation();
  const { balance, lifetimeEarned, lifetimeSpent, thisMonthEarned, transactions, loading } = useVCoins();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [mainTab, setMainTab]     = useState<TabView>("wallet");

  // Leaderboard state
  const [topEntries, setTopEntries]    = useState<RankEntry[]>([]);
  const [extEntries, setExtEntries]    = useState<RankEntry[]>([]);
  const [myEntry, setMyEntry]          = useState<RankEntry | null>(null);
  const [rankLoading, setRankLoading]  = useState(false);
  const [showMore, setShowMore]        = useState(false);
  const [moreLoading, setMoreLoading]  = useState(false);

  useEffect(() => {
    if (mainTab !== "leaderboard") return;
    if (topEntries.length > 0) return; // already loaded
    fetchTop10();
  }, [mainTab]);

  const fetchTop10 = async () => {
    setRankLoading(true);
    try {
      const q    = query(
        collection(db, "users"),
        orderBy(YEAR_FIELD, "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      const uid  = auth.currentUser?.uid;
      const entries: RankEntry[] = snap.docs.map((d, i) => ({
        uid:       d.id,
        name:      d.data().name || "Student",
        school:    d.data().school || "",
        profilePic: d.data().profilePic || "",
        yearCoins: d.data()[YEAR_FIELD] ?? 0,
        rank:      i + 1,
      }));
      setTopEntries(entries);

      // Check if current user appears in top 10
      const inTop = entries.find((e) => e.uid === uid);
      if (!inTop) {
        fetchMyRank();
      } else {
        setMyEntry(inTop);
      }
    } finally {
      setRankLoading(false);
    }
  };

  const fetchMyRank = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      // Get user's yearCoins
      const { getDoc, doc: docRef } = await import("firebase/firestore");
      const snap = await getDoc(docRef(db, "users", uid));
      if (!snap.exists()) return;
      const myCoins = snap.data()[YEAR_FIELD] ?? 0;
      // Count users with more coins
      const { getCountFromServer, query: q2, where } = await import("firebase/firestore");
      const countSnap = await getCountFromServer(
        q2(collection(db, "users"), where(YEAR_FIELD, ">", myCoins))
      );
      setMyEntry({
        uid,
        name:       snap.data().name || "You",
        school:     snap.data().school || "",
        profilePic: snap.data().profilePic || "",
        yearCoins:  myCoins,
        rank:       countSnap.data().count + 1,
      });
    } catch (e) {
      console.warn("fetchMyRank error", e);
    }
  };

  const handleSeeMore = async () => {
    if (extEntries.length > 0) { setShowMore(true); return; }
    setMoreLoading(true);
    try {
      const q    = query(
        collection(db, "users"),
        orderBy(YEAR_FIELD, "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      const uid  = auth.currentUser?.uid;
      const all: RankEntry[] = snap.docs.map((d, i) => ({
        uid:       d.id,
        name:      d.data().name || "Student",
        school:    d.data().school || "",
        profilePic: d.data().profilePic || "",
        yearCoins: d.data()[YEAR_FIELD] ?? 0,
        rank:      i + 1,
      }));
      setExtEntries(all);
      const inList = all.find((e) => e.uid === uid);
      if (inList) setMyEntry(inList);
      setShowMore(true);
    } finally {
      setMoreLoading(false);
    }
  };

  const filtered = transactions.filter((tx) => {
    if (activeTab === "ALL")     return true;
    if (activeTab === "EARNED")  return tx.type === "CREDIT" && tx.status === "SUCCESS";
    if (activeTab === "SPENT")   return tx.type === "DEBIT";
    if (activeTab === "PENDING") return tx.status === "PENDING";
    return true;
  });

  const displayedEntries = showMore ? extEntries : topEntries;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>V-Coins</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Main Tab Switcher */}
      <View style={styles.mainTabs}>
        <TouchableOpacity
          style={[styles.mainTab, mainTab === "wallet" && styles.mainTabActive]}
          onPress={() => setMainTab("wallet")}
        >
          <Ionicons name="wallet-outline" size={16} color={mainTab === "wallet" ? "#fff" : "#6B7280"} />
          <Text style={[styles.mainTabText, mainTab === "wallet" && styles.mainTabTextActive]}>
            {t("walletLabel") ?? "Wallet"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, mainTab === "leaderboard" && styles.mainTabActive]}
          onPress={() => setMainTab("leaderboard")}
        >
          <Ionicons name="trophy-outline" size={16} color={mainTab === "leaderboard" ? "#fff" : "#6B7280"} />
          <Text style={[styles.mainTabText, mainTab === "leaderboard" && styles.mainTabTextActive]}>
            {t("leaderboardLabel") ?? "Leaderboard"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── WALLET VIEW ── */}
      {mainTab === "wallet" && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View>
              {/* Balance Card */}
              <LinearGradient
                colors={["#7C3AED", "#F59E0B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.balanceCard}
              >
                <Text style={styles.balanceLabel}>V-Coins Balance</Text>
                <Text style={styles.balanceAmount}>
                  {formatVCoins(balance ?? 0)}
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatVCoins(lifetimeEarned)}</Text>
                    <Text style={styles.statLabel}>Total Earned</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatVCoins(lifetimeSpent)}</Text>
                    <Text style={styles.statLabel}>Total Spent</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatVCoins(thisMonthEarned)}</Text>
                    <Text style={styles.statLabel}>This Month</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Earn Section */}
              <Text style={styles.sectionTitle}>Earn V-Coins</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.earnScroll}
              >
                {EARN_SOURCES.map((src) => (
                  <View key={src.label} style={styles.earnCard}>
                    <View style={[styles.earnIconCircle, { backgroundColor: src.bg }]}>
                      <Ionicons name={src.icon as any} size={20} color={src.color} />
                    </View>
                    <Text style={styles.earnLabel}>{src.label}</Text>
                  </View>
                ))}
              </ScrollView>

              {/* Filter Tabs */}
              <Text style={styles.sectionTitle}>Transaction History</Text>
              <View style={styles.tabs}>
                {FILTER_TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TransactionRow tx={item} onPress={() => router.push(`/vcoins/transaction-detail?id=${item.id}`)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubText}>
                Start watching videos and learning to earn V-Coins!
              </Text>
            </View>
          }
        />
      )}

      {/* ── LEADERBOARD VIEW ── */}
      {mainTab === "leaderboard" && (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {/* Header */}
          <LinearGradient
            colors={["#1e1b4b", "#7C3AED"]}
            style={styles.lbHeader}
          >
            <Text style={styles.lbHeaderTitle}>🏆 V-Coins Leaderboard</Text>
            <Text style={styles.lbHeaderSub}>{currentYear} {t("leaderboardLabel") ?? "Rankings"} · {t("updatedDaily") ?? "Updated Daily"}</Text>
          </LinearGradient>

          {/* My rank card (if not in visible list) */}
          {myEntry && !displayedEntries.find((e) => e.uid === auth.currentUser?.uid) && (
            <View style={styles.myRankCard}>
              <Text style={styles.myRankLabel}>Your Rank</Text>
              <View style={styles.myRankRow}>
                <Text style={styles.myRankNum}>#{myEntry.rank}</Text>
                <Text style={styles.myRankCoins}>🪙 {formatVCoins(myEntry.yearCoins)}</Text>
              </View>
            </View>
          )}

          {rankLoading ? (
            <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
          ) : (
            <>
              {displayedEntries.map((entry) => (
                <RankRow
                  key={entry.uid}
                  entry={entry}
                  isMe={entry.uid === auth.currentUser?.uid}
                />
              ))}

              {/* See More / Show Less */}
              {!showMore && topEntries.length >= 10 && (
                <TouchableOpacity
                  style={styles.seeMoreBtn}
                  onPress={handleSeeMore}
                  disabled={moreLoading}
                >
                  {moreLoading ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <>
                      <Ionicons name="chevron-down" size={18} color="#7C3AED" />
                      <Text style={styles.seeMoreText}>See Top 100</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {showMore && (
                <TouchableOpacity
                  style={styles.seeMoreBtn}
                  onPress={() => setShowMore(false)}
                >
                  <Ionicons name="chevron-up" size={18} color="#7C3AED" />
                  <Text style={styles.seeMoreText}>Show Less</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Rank Row ─────────────────────────────────────────────────────────────────

function RankRow({ entry, isMe }: { entry: RankEntry; isMe: boolean }) {
  const medal = RANK_MEDALS[entry.rank];
  return (
    <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
      <View style={styles.rankNumBox}>
        {medal ? (
          <Text style={styles.rankMedal}>{medal}</Text>
        ) : (
          <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>#{entry.rank}</Text>
        )}
      </View>
      <Image
        source={{ uri: entry.profilePic || `https://i.pravatar.cc/80?u=${entry.uid}` }}
        style={styles.rankAvatar}
      />
      <View style={styles.rankInfo}>
        <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
          {entry.name}{isMe ? " (You)" : ""}
        </Text>
        <Text style={styles.rankSchool} numberOfLines={1}>{entry.school}</Text>
      </View>
      <View style={styles.rankCoinsBox}>
        <Text style={styles.rankCoinsEmoji}>🪙</Text>
        <Text style={[styles.rankCoins, isMe && styles.rankCoinsMe]}>
          {formatVCoins(entry.yearCoins)}
        </Text>
      </View>
    </View>
  );
}

// ── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({ tx, onPress }: { tx: VCoinTransaction; onPress: () => void }) {
  const amountColor = getTransactionColor(tx.type, tx.status);
  const iconName    = getVCoinsSourceIcon(tx.source) as any;
  const iconBg      = getVCoinsSourceIconBg(tx.source);
  const iconColor   = getVCoinsSourceIconColor(tx.source);
  const statusColor = getStatusColor(tx.status);
  const prefix      = tx.type === "CREDIT" ? "+" : "-";
  const dateStr     = formatTransactionDate(tx.createdAt);

  return (
    <TouchableOpacity onPress={onPress} style={styles.txRow} activeOpacity={0.7}>
      <View style={[styles.txIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txTitle} numberOfLines={1}>{tx.title}</Text>
        <Text style={styles.txDate}>{dateStr}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {prefix}{formatVCoins(tx.amount)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{tx.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: "#F9FAFB" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  backBtn:     { width: 36, alignItems: "flex-start" },
  screenTitle: { fontSize: 17, fontWeight: "700", color: "#111" },

  // Main tabs
  mainTabs: {
    flexDirection: "row", padding: 12, gap: 8,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  mainTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8, borderRadius: 10, backgroundColor: "#F3F4F6",
  },
  mainTabActive:     { backgroundColor: "#7C3AED" },
  mainTabText:       { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  mainTabTextActive: { color: "#fff" },

  balanceCard:   { margin: 16, borderRadius: 20, padding: 24 },
  balanceLabel:  { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  balanceAmount: { color: "#fff", fontSize: 40, fontWeight: "800", marginTop: 4, marginBottom: 20 },

  statsRow:    { flexDirection: "row", alignItems: "center" },
  statItem:    { flex: 1, alignItems: "center" },
  statValue:   { color: "#fff", fontWeight: "700", fontSize: 15 },
  statLabel:   { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.25)" },

  sectionTitle: {
    fontSize: 15, fontWeight: "700", color: "#111",
    marginHorizontal: 16, marginTop: 8, marginBottom: 10,
  },
  earnScroll: { paddingHorizontal: 16, gap: 10 },
  earnCard:   { alignItems: "center", gap: 6, marginBottom: 12 },
  earnIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  earnLabel:  { fontSize: 11, fontWeight: "600", color: "#374151", textAlign: "center", maxWidth: 64 },

  tabs:          { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F3F4F6" },
  tabActive:     { backgroundColor: "#7C3AED" },
  tabText:       { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTextActive: { color: "#fff" },

  txRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F9FAFB",
  },
  txIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  txMid:        { flex: 1 },
  txTitle:      { fontSize: 14, fontWeight: "600", color: "#111" },
  txDate:       { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  txRight:      { alignItems: "flex-end", gap: 4 },
  txAmount:     { fontSize: 15, fontWeight: "700" },
  statusPill:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  statusText:   { fontSize: 10, fontWeight: "700" },

  empty:        { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyText:    { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySubText: { fontSize: 13, color: "#9CA3AF", textAlign: "center", maxWidth: 240 },

  // Leaderboard
  lbHeader: {
    margin: 16, borderRadius: 20, padding: 24, alignItems: "center", gap: 4,
  },
  lbHeaderTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  lbHeaderSub:   { color: "rgba(255,255,255,0.7)", fontSize: 13 },

  myRankCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "#EDE9FE", borderRadius: 14, padding: 14,
    borderWidth: 2, borderColor: "#7C3AED",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  myRankLabel:  { color: "#7C3AED", fontSize: 12, fontWeight: "700" },
  myRankRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  myRankNum:    { color: "#7C3AED", fontSize: 22, fontWeight: "800" },
  myRankCoins:  { color: "#374151", fontSize: 14, fontWeight: "700" },

  rankRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F9FAFB",
  },
  rankRowMe: { backgroundColor: "#F5F3FF", borderLeftWidth: 3, borderLeftColor: "#7C3AED" },
  rankNumBox:  { width: 36, alignItems: "center" },
  rankMedal:   { fontSize: 22 },
  rankNum:     { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  rankNumMe:   { color: "#7C3AED" },
  rankAvatar:  { width: 42, height: 42, borderRadius: 21 },
  rankInfo:    { flex: 1 },
  rankName:    { fontSize: 14, fontWeight: "700", color: "#111" },
  rankNameMe:  { color: "#7C3AED" },
  rankSchool:  { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  rankCoinsBox: { alignItems: "flex-end" },
  rankCoinsEmoji: { fontSize: 14 },
  rankCoins:   { fontSize: 14, fontWeight: "700", color: "#374151" },
  rankCoinsMe: { color: "#7C3AED" },

  seeMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    margin: 20, paddingVertical: 12,
    borderRadius: 14, backgroundColor: "#EDE9FE",
  },
  seeMoreText: { color: "#7C3AED", fontSize: 14, fontWeight: "700" },
});