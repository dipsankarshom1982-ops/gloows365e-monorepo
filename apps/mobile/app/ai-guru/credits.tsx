// PATH: app/ai-guru/credits.tsx
// AI Guru pay-as-you-go credits — balance, pack grid, ledger. Visual style
// matches subscription.tsx (same product area — AiGuruHeader, gradient
// hero, card list) rather than the V-Coins wallet screen (app/vcoins/
// wallet.tsx), which is a different, gamified-currency concept with its
// own leaderboard that doesn't apply here.

import { useAppConfig } from "@/context/AppConfigContext";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/lib/firebase";
import {
  CreditTransaction,
  purchaseCreditPack,
  subscribeToCreditBalance,
  subscribeToCreditTransactions,
} from "@/services/aiGuruCreditsService";
import AiGuruHeader from "@/components/aiGuru/AiGuruHeader";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

function formatTxDate(ts: any): string {
  const d: Date | null = ts?.toDate ? ts.toDate() : null;
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function AiGuruCreditsScreen() {
  const { colors, isDarkMode } = useTheme();
  const { creditPacks, configLoading } = useAppConfig();
  const uid = auth.currentUser?.uid ?? null;

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const pageBg    = isDarkMode ? "#060612" : colors.background;
  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;
  const textMain  = isDarkMode ? "#f1f5f9" : colors.text;
  const textSec   = isDarkMode ? "#94a3b8" : colors.textSecondary;

  useEffect(() => {
    if (!uid) return;
    const unsubBal = subscribeToCreditBalance(uid, setBalance);
    const unsubTx  = subscribeToCreditTransactions(uid, setTransactions);
    return () => { unsubBal(); unsubTx(); };
  }, [uid]);

  const handleBuy = async (pack: (typeof creditPacks)[number]) => {
    if (!uid) {
      Alert.alert("Login Required", "Please log out and log in again.");
      return;
    }
    setPurchasingId(pack.id);
    try {
      const result = await purchaseCreditPack(pack);
      if (result.activated) {
        Alert.alert("Credits added! ⚡", `You now have ${result.newBalance} AI Guru credits.`);
      } else {
        Alert.alert(
          "Payment Status",
          "If you completed payment, your credits will show up within a minute.",
          [{ text: "OK" }]
        );
      }
    } catch (e: any) {
      const msg = e?.message ?? "Purchase failed. Please try again.";
      if (!msg.toLowerCase().includes("cancel")) {
        Alert.alert("Purchase Failed", msg);
      }
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <SafeAreaView style={[S.container, { backgroundColor: pageBg }]} edges={["bottom"]}>
      {isDarkMode && (
        <LinearGradient colors={["#060612", "#0d0d24", "#060612"]} style={StyleSheet.absoluteFillObject} />
      )}

      <AiGuruHeader
        title="AI Guru Credits"
        rightElement={
          <TouchableOpacity onPress={() => router.push("/ai-guru/subscription" as any)}>
            <View style={S.subLink}>
              <Ionicons name="sparkles" size={12} color="#fbbf24" />
              <Text style={S.subLinkText}>Go Unlimited</Text>
            </View>
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        {/* ── Balance hero ── */}
        <Animated.View entering={FadeInDown.duration(450).delay(80)}>
          <LinearGradient colors={["#1e1b4b", "#312e81", "#4f46e5"]} style={S.hero}>
            <Ionicons name="flash" size={36} color="#a5b4fc" />
            <Text style={S.heroBalance}>{balance ?? "—"}</Text>
            <Text style={S.heroLabel}>AI Guru credits</Text>
            <Text style={S.heroSub}>
              Pay only for what you use — no subscription needed. 1 credit unlocks one
              AI Guru action once you've used today's free ones.
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Pack grid ── */}
        <Text style={[S.sectionTitle, { color: textMain }]}>Buy Credits</Text>
        {configLoading ? (
          <View style={S.centerBlock}>
            <ActivityIndicator color="#6366f1" />
          </View>
        ) : creditPacks.length === 0 ? (
          <View style={S.centerBlock}>
            <Text style={{ color: textSec, fontSize: 13, textAlign: "center" }}>
              Credit packs aren't available right now. Check back soon!
            </Text>
          </View>
        ) : (
          creditPacks.map((pack, idx) => {
            const totalCredits = pack.credits + (pack.bonusCredits ?? 0);
            const rupees = pack.pricePaise / 100;
            const isBuying = purchasingId === pack.id;
            return (
              <Animated.View key={pack.id} entering={FadeInDown.duration(380).delay(160 + idx * 60)}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!!purchasingId}
                  onPress={() => handleBuy(pack)}
                >
                  <LinearGradient
                    colors={pack.gradient as any}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[S.packCard, pack.highlight && S.packCardHighlight]}
                  >
                    {pack.highlight && (
                      <View style={S.bestValueBadge}>
                        <Text style={S.bestValueBadgeText}>⭐ Best Value</Text>
                      </View>
                    )}
                    <View style={S.packRow}>
                      <Text style={S.packEmoji}>{pack.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={S.packName}>{pack.name}</Text>
                        <Text style={S.packCredits}>
                          {totalCredits} credits
                          {pack.bonusCredits > 0 && ` (${pack.credits} + ${pack.bonusCredits} bonus)`}
                        </Text>
                        {pack.description ? <Text style={S.packDesc}>{pack.description}</Text> : null}
                      </View>
                      {isBuying
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={S.packPrice}>₹{rupees.toLocaleString("en-IN")}</Text>
                      }
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}

        {/* ── Ledger ── */}
        {transactions.length > 0 && (
          <>
            <Text style={[S.sectionTitle, { color: textMain, marginTop: 20 }]}>Recent Activity</Text>
            {transactions.map((tx) => (
              <View key={tx.id} style={[S.txRow, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
                <View style={[S.txIconCircle, { backgroundColor: tx.type === "CREDIT" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)" }]}>
                  <Ionicons
                    name={tx.type === "CREDIT" ? "add" : "flash"}
                    size={16}
                    color={tx.type === "CREDIT" ? "#10b981" : "#ef4444"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.txTitle, { color: textMain }]} numberOfLines={1}>{tx.title}</Text>
                  <Text style={[S.txDate, { color: textSec }]}>
                    {formatTxDate(tx.createdAt)}{tx.status === "REVERSED" ? " · refunded" : ""}
                  </Text>
                </View>
                <Text style={[S.txAmount, { color: tx.type === "CREDIT" ? "#10b981" : textMain }]}>
                  {tx.type === "CREDIT" ? "+" : "−"}{tx.amount}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 16, paddingBottom: 24 },

  subLink:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#fbbf24" },
  subLinkText: { color: "#fbbf24", fontSize: 10, fontWeight: "900" },

  hero:        { borderRadius: 20, padding: 24, alignItems: "center", gap: 6, marginBottom: 20 },
  heroBalance: { color: "#fff", fontSize: 40, fontWeight: "900" },
  heroLabel:   { color: "#a5b4fc", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  heroSub:     { color: "rgba(255,255,255,0.65)", fontSize: 12, textAlign: "center", lineHeight: 18, maxWidth: 280 },

  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 12 },
  centerBlock:  { alignItems: "center", paddingVertical: 24 },

  packCard:          { borderRadius: 16, padding: 16, marginBottom: 10 },
  packCardHighlight: { borderWidth: 2, borderColor: "#fbbf24" },
  bestValueBadge:    { backgroundColor: "#f59e0b", alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  bestValueBadgeText:{ color: "#fff", fontSize: 10, fontWeight: "800" },
  packRow:     { flexDirection: "row", alignItems: "center", gap: 12 },
  packEmoji:   { fontSize: 26 },
  packName:    { color: "#f1f5f9", fontSize: 15, fontWeight: "900" },
  packCredits: { color: "#e0e7ff", fontSize: 12, fontWeight: "600", marginTop: 2 },
  packDesc:    { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 },
  packPrice:   { color: "#fff", fontSize: 18, fontWeight: "900" },

  txRow:       { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  txIconCircle:{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  txTitle:     { fontSize: 13, fontWeight: "700" },
  txDate:      { fontSize: 11, marginTop: 1 },
  txAmount:    { fontSize: 14, fontWeight: "800" },
});
