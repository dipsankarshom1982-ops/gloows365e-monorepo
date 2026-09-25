// PATH: apps/mobile/app/shikshahub/credits.tsx
// ShikshaHub Phase 4 — tutor credits (funds Instant Help). RN mirror of
// apps/web's shikshahub/credits/page.tsx, styled after
// app/ai-guru/credits.tsx's balance-hero/pack-grid/ledger layout.

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { fetchTutorCreditPacks } from "@/lib/shikshahub";
import { purchaseTutorCreditPack, type TutorCreditPackLite } from "@/services/tutorCreditsService";
import { useTutorCreditsBalance } from "@gloows/shared-logic";
import type { TutorCreditPack } from "@gloows/shared-logic";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatTxDate(ts: any): string {
  const d: Date | null = ts?.toDate ? ts.toDate() : null;
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function TutorCreditsScreen() {
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();
  const { balance, transactions } = useTutorCreditsBalance();

  const [packs, setPacks] = useState<TutorCreditPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTutorCreditPacks().then(setPacks).finally(() => setPacksLoading(false));
  }, []);

  const handleBuy = async (pack: TutorCreditPack) => {
    setPurchasingId(pack.id!);
    try {
      const lite: TutorCreditPackLite = { id: pack.id!, name: pack.name, pricePaise: pack.pricePaise };
      const result = await purchaseTutorCreditPack(lite);
      if (result.activated) {
        Alert.alert("Credits added! ⚡", `You now have ${result.newBalance} credits.`);
      } else {
        Alert.alert("Payment Status", "If you completed payment, your credits will show up within a minute.", [{ text: "OK" }]);
      }
    } catch (e: any) {
      const msg = e?.message ?? "Purchase failed. Please try again.";
      if (!msg.toLowerCase().includes("cancel")) Alert.alert("Purchase Failed", msg);
    } finally {
      setPurchasingId(null);
    }
  };

  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;
  const textMain  = colors.text;
  const textSec   = colors.textSecondary;

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={[S.backBtn, { backgroundColor: surfaceBg }]}>
          <Ionicons name="chevron-back" size={20} color={textSec} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: textMain }]}>{t("instantHelpCreditsTitle") ?? "Instant Help Credits"}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        <LinearGradient colors={["#0f766e", "#0d9488", "#14b8a6"]} style={S.hero}>
          <Ionicons name="flash" size={36} color="#99f6e4" />
          <Text style={S.heroBalance}>{balance ?? "—"}</Text>
          <Text style={S.heroLabel}>{t("instantHelpCreditsBalance") ?? "Tutor credits"}</Text>
          <Text style={S.heroSub}>
            {t("instantHelpCreditsExplain") ?? "Credits fund Instant Help — billed per minute while a session is active."}
          </Text>
        </LinearGradient>

        <Text style={[S.sectionTitle, { color: textMain }]}>{t("instantHelpBuyCredits") ?? "Buy Credits"}</Text>
        {packsLoading ? (
          <View style={S.centerBlock}><ActivityIndicator color="#14b8a6" /></View>
        ) : packs.length === 0 ? (
          <View style={S.centerBlock}>
            <Text style={{ color: textSec, fontSize: 13, textAlign: "center" }}>
              {t("instantHelpNoPacks") ?? "Credit packs aren't available right now. Check back soon!"}
            </Text>
          </View>
        ) : (
          packs.map((pack) => {
            const totalCredits = pack.credits + (pack.bonusCredits ?? 0);
            const rupees = pack.pricePaise / 100;
            const isBuying = purchasingId === pack.id;
            return (
              <TouchableOpacity key={pack.id} activeOpacity={0.85} disabled={!!purchasingId} onPress={() => handleBuy(pack)}>
                <View style={[S.packCard, { backgroundColor: surfaceBg, borderColor: pack.highlight ? "#14b8a6" : borderCol, borderWidth: pack.highlight ? 2 : 1 }]}>
                  {pack.highlight && (
                    <View style={S.bestValueBadge}><Text style={S.bestValueBadgeText}>⭐ Best Value</Text></View>
                  )}
                  <View style={S.packRow}>
                    <Text style={S.packEmoji}>{pack.emoji ?? "⚡"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[S.packName, { color: textMain }]}>{pack.name}</Text>
                      <Text style={[S.packCredits, { color: textSec }]}>
                        {totalCredits} credits{(pack.bonusCredits ?? 0) > 0 ? ` (+${pack.bonusCredits} bonus)` : ""}
                      </Text>
                    </View>
                    {isBuying ? <ActivityIndicator color="#14b8a6" size="small" /> : <Text style={[S.packPrice, { color: textMain }]}>₹{rupees.toLocaleString("en-IN")}</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {transactions.length > 0 && (
          <>
            <Text style={[S.sectionTitle, { color: textMain, marginTop: 20 }]}>{t("recentActivity") ?? "Recent Activity"}</Text>
            {transactions.map((tx) => (
              <View key={tx.id} style={[S.txRow, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
                <View style={[S.txIconCircle, { backgroundColor: tx.type === "CREDIT" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)" }]}>
                  <Ionicons name={tx.type === "CREDIT" ? "add" : "flash"} size={16} color={tx.type === "CREDIT" ? "#10b981" : "#ef4444"} />
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
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "900" },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  hero: { borderRadius: 20, padding: 24, alignItems: "center", gap: 6, marginBottom: 20 },
  heroBalance: { color: "#fff", fontSize: 40, fontWeight: "900" },
  heroLabel: { color: "#99f6e4", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, textAlign: "center", lineHeight: 18, maxWidth: 280 },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 12 },
  centerBlock: { alignItems: "center", paddingVertical: 24 },
  packCard: { borderRadius: 16, padding: 16, marginBottom: 10 },
  bestValueBadge: { backgroundColor: "#0d9488", alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  bestValueBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  packRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  packEmoji: { fontSize: 26 },
  packName: { fontSize: 15, fontWeight: "900" },
  packCredits: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  packPrice: { fontSize: 18, fontWeight: "900" },
  txRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  txIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  txTitle: { fontSize: 13, fontWeight: "700" },
  txDate: { fontSize: 11, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: "800" },
});
