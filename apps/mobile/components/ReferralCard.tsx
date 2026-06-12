// PATH: components/ReferralCard.tsx
// FIXES: "VidyaAI" → "Gloows365E", vidyaai.app → gloows365e.app

import { useAppTranslation } from "@/context/LanguageContext";
import { useReferral } from "@/hooks/useReferral";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ReferralCard() {
  const { referralCode, referralCount, referralCoinsEarned, config, nextMilestone, loading } = useReferral();
  const { t } = useAppTranslation();
  const [copied, setCopied] = useState(false);

  if (loading || !config.isActive) return null;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${t("referEarn") ?? "Refer & Earn"} — India's smartest learning app! 🚀\n\nUse my referral code: ${referralCode}\n\nYou'll get ${config.refereeCoins} VCoins as a welcome bonus!\n\nDownload now: https://gloows365.in`,
        title: `Join Gloows365E with my code`,
      });
    } catch { /* ignore */ }
  };

  const progressPercent = nextMilestone
    ? Math.min((nextMilestone.progressCount / nextMilestone.every) * 100, 100)
    : 0;

  return (
    <View style={S.card}>
      {/* Header */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <View style={S.iconBg}>
            <Ionicons name="people" size={20} color="#7C3AED" />
          </View>
          <View>
            <Text style={S.title}>{t("referEarn") ?? "Refer & Earn"}</Text>
            <Text style={S.subtitle}>{t("referEarnSub") ?? "Earn VCoins for every friend who joins"}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push("/referral" as any)} style={S.viewAll}>
          <Text style={S.viewAllText}>{t("viewAllLabel") ?? "View all"}</Text>
          <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={S.statsRow}>
        <View style={S.statBox}>
          <Text style={S.statNum}>{referralCount}</Text>
          <Text style={S.statLabel}>{t("friendsJoined") ?? "Friends joined"}</Text>
        </View>
        <View style={S.statDivider} />
        <View style={S.statBox}>
          <Text style={S.statNum}>{referralCoinsEarned}</Text>
          <Text style={S.statLabel}>{t("vCoinsEarned") ?? "VCoins earned"}</Text>
        </View>
        <View style={S.statDivider} />
        <View style={S.statBox}>
          <Text style={S.statNum}>+{config.referrerCoins}</Text>
          <Text style={S.statLabel}>{t("perReferral") ?? "Per referral"}</Text>
        </View>
      </View>

      {/* Referral code */}
      <View style={S.codeRow}>
        <View style={S.codeBox}>
          <Text style={S.codeLabel}>{t("yourCode") ?? "Your code"}</Text>
          <Text style={S.codeText}>{referralCode}</Text>
        </View>
        <TouchableOpacity style={S.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? "#16A34A" : "#7C3AED"} />
          <Text style={[S.copyText, copied && S.copiedText]}>
            {copied ? (t("copiedLabel") ?? "Copied!") : (t("copyLabel") ?? "Copy")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Milestone progress */}
      {nextMilestone && (
        <View style={S.milestoneWrap}>
          <View style={S.milestoneHeader}>
            <Text style={S.milestoneLabel}>
              🎁 {nextMilestone.progressCount}/{nextMilestone.every} — unlock: {nextMilestone.giftLabel}
            </Text>
          </View>
          <View style={S.progressBar}>
            <View style={[S.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}

      {/* Gift badge */}
      {config.giftEnabled && config.giftLabel ? (
        <View style={S.giftBadge}>
          <Ionicons name="gift" size={14} color="#CA8A04" />
          <Text style={S.giftText}>{t("friendAlsoGets") ?? "Friend also gets"}: {config.giftLabel}</Text>
        </View>
      ) : null}

      {/* CTA */}
      <TouchableOpacity style={S.shareBtn} onPress={handleShare} activeOpacity={0.85}>
        <Ionicons name="share-social" size={18} color="#fff" />
        <Text style={S.shareBtnText}>{t("referMoreFriends") ?? "Refer More Friends"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const S = StyleSheet.create({
  card: { backgroundColor: "#0F0B2E", borderRadius: 20, padding: 16, marginHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconBg: { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(124,58,237,0.15)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 15, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 12, marginTop: 1 },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewAllText: { color: "#7C3AED", fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  statBox: { flex: 1, alignItems: "center" },
  statNum: { color: "#fff", fontSize: 20, fontWeight: "800" },
  statLabel: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.1)" },
  codeRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12, gap: 12 },
  codeBox: { flex: 1 },
  codeLabel: { color: "#94a3b8", fontSize: 11, marginBottom: 2 },
  codeText: { color: "#a78bfa", fontSize: 20, fontWeight: "800", letterSpacing: 2 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(124,58,237,0.15)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  copyText: { color: "#7C3AED", fontSize: 13, fontWeight: "600" },
  copiedText: { color: "#16A34A" },
  milestoneWrap: { marginBottom: 10 },
  milestoneHeader: { marginBottom: 5 },
  milestoneLabel: { color: "#94a3b8", fontSize: 11 },
  progressBar: { height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#7C3AED", borderRadius: 4 },
  giftBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(202,138,4,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, alignSelf: "flex-start" },
  giftText: { color: "#FBBF24", fontSize: 12 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7C3AED", paddingVertical: 13, borderRadius: 14 },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});