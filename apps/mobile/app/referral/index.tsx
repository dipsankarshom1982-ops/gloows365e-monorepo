// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/referral/index.tsx
// PATH: app/referral/index.tsx
// FIXES: "VidyaAI" → "Gloows365E", vidyaai.app → gloows365e.app
// ─────────────────────────────────────────────────────────────────────────────

import { useAppTranslation } from "@/context/LanguageContext";
import { useReferral } from "@/hooks/useReferral";
import { ReferralDoc } from "@/services/referralService";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReferralScreen() {
  const { t } = useAppTranslation();
  const {
    referralCode,
    referralCount,
    referralCoinsEarned,
    referrals,
    config,
    nextMilestone,
    loading,
  } = useReferral();

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    await Share.share({
      message: `Join me on Gloows365E — India's smartest learning app! 🚀\n\nUse my referral code: ${referralCode}\n\nYou'll get ${config.refereeCoins} VCoins as a welcome bonus!\n\nDownload now: https://gloows365.in`,
      title: "Join Gloows365E with my code",
    });
  };

  const completedReferrals = referrals.filter((r) => r.status === "completed");
  const pendingReferrals   = referrals.filter((r) => r.status === "pending");

  const progressPercent = nextMilestone
    ? Math.min((nextMilestone.progressCount / nextMilestone.every) * 100, 100)
    : 0;

  const renderReferralItem = ({ item }: { item: ReferralDoc }) => (
    <View style={S.referralItem}>
      <View style={S.referralAvatar}>
        <Ionicons name="person" size={18} color="#7C3AED" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={S.referralId}>Friend {item.refereeId.slice(0, 8)}…</Text>
        <Text style={S.referralDate}>
          {item.createdAt?.toDate
            ? item.createdAt.toDate().toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })
            : "—"}
        </Text>
      </View>
      <View style={[S.statusBadge, item.status === "completed" ? S.badgeGreen : S.badgeAmber]}>
        <Text style={[S.statusText, item.status === "completed" ? S.textGreen : S.textAmber]}>
          {item.status === "completed" ? "✓ " + (t("joinedLabel") ?? "Joined") : t("pendingLabel") ?? "Pending"}
        </Text>
      </View>
      {item.status === "completed" && (
        <Text style={S.coinsEarned}>+{config.referrerCoins} 🪙</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070412" }}>
      <LinearGradient colors={["#070412", "#1A0A3B", "#070412"]} style={{ flex: 1 }}>

        {/* Header */}
        <View style={S.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={S.navTitle}>Refer & Earn</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>

          {/* Hero banner */}
          <LinearGradient colors={["#3B0764", "#6D28D9"]} style={S.heroBanner}>
            <Text style={S.heroEmoji}>🎁</Text>
            <Text style={S.heroTitle}>Invite friends, earn VCoins!</Text>
            <Text style={S.heroSub}>
              You get {config.referrerCoins} VCoins · Your friend gets {config.refereeCoins} VCoins
            </Text>
            {config.giftEnabled && config.giftLabel ? (
              <View style={S.giftPill}>
                <Text style={S.giftPillText}>🎀 Friend also gets: {config.giftLabel}</Text>
              </View>
            ) : null}
          </LinearGradient>

          {/* Stats */}
          <View style={S.statsRow}>
            <View style={S.statCard}>
              <Text style={S.statNum}>{referralCount}</Text>
              <Text style={S.statLabel}>{t("totalReferred") ?? "Total referred"}</Text>
            </View>
            <View style={S.statCard}>
              <Text style={[S.statNum, { color: "#A78BFA" }]}>{referralCoinsEarned}</Text>
              <Text style={S.statLabel}>{t("vCoinsEarned") ?? "VCoins earned"}</Text>
            </View>
            <View style={S.statCard}>
              <Text style={[S.statNum, { color: "#34D399" }]}>{completedReferrals.length}</Text>
              <Text style={S.statLabel}>{t("completed") ?? "Completed"}</Text>
            </View>
          </View>

          {/* Milestone progress */}
          {nextMilestone && (
            <View style={S.milestoneCard}>
              <View style={S.milestoneTop}>
                <Text style={S.milestoneTitle}>🏆 Next reward: {nextMilestone.giftLabel}</Text>
                <Text style={S.milestonePct}>{nextMilestone.progressCount}/{nextMilestone.every}</Text>
              </View>
              <View style={S.progressBar}>
                <View style={[S.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={S.milestoneHint}>
                {nextMilestone.every - nextMilestone.progressCount} {t("moreReferralsToUnlock") ?? "more referrals to unlock"}
              </Text>
            </View>
          )}

          {/* Your code */}
          <View style={S.codeCard}>
            <Text style={S.codeCardTitle}>Your referral code</Text>
            <View style={S.codeRow}>
              <Text style={S.codeText}>{referralCode}</Text>
              <TouchableOpacity style={S.copyBtn} onPress={handleCopy}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? "#34D399" : "#A78BFA"} />
                <Text style={[S.copyText, copied && { color: "#34D399" }]}>
                  {copied ? t("copiedLabel") ?? "Copied!" : t("copyLabel") ?? "Copy"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={S.codeHint}>Share this code with friends. They enter it during signup.</Text>
          </View>

          {/* How it works */}
          <View style={S.howCard}>
            <Text style={S.howTitle}>How it works</Text>
            {[
              { icon: "share-social", step: "1", text: "Share your code with a friend" },
              { icon: "person-add",   step: "2", text: "Friend signs up with your code" },
              { icon: "gift",         step: "3", text: `You get ${config.referrerCoins} VCoins — they get ${config.refereeCoins} VCoins` },
            ].map((item) => (
              <View key={item.step} style={S.howStep}>
                <View style={S.howIcon}>
                  <Ionicons name={item.icon as any} size={18} color="#7C3AED" />
                </View>
                <View style={S.howTextWrap}>
                  <Text style={S.howStepNum}>{t("stepLabel") ?? "Step"} {item.step}</Text>
                  <Text style={S.howStepText}>{item.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Referral history */}
          {referrals.length > 0 && (
            <View style={S.historyCard}>
              <Text style={S.historyTitle}>
                Referral history ({referrals.length})
              </Text>
              {referrals.slice(0, 10).map((item) => (
                <View key={item.id}>
                  {renderReferralItem({ item })}
                </View>
              ))}
            </View>
          )}

        </ScrollView>

        {/* Share CTA — sticky bottom */}
        <View style={S.stickyFooter}>
          <TouchableOpacity style={S.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-social" size={20} color="#fff" />
            <Text style={S.shareBtnText}>{t("shareEarn") ?? "Share & Earn"} {config.referrerCoins} VCoins</Text>
          </TouchableOpacity>
        </View>

      </LinearGradient>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  scroll:     { paddingBottom: 100 },
  navBar:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  backBtn:    { width: 40, height: 40, justifyContent: "center" },
  navTitle:   { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },

  heroBanner: { marginHorizontal: 14, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 16 },
  heroEmoji:  { fontSize: 44, marginBottom: 8 },
  heroTitle:  { color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  heroSub:    { color: "rgba(255,255,255,0.75)", fontSize: 14, textAlign: "center" },
  giftPill:   { marginTop: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  giftPillText: { color: "#FDE68A", fontSize: 13 },

  statsRow:  { flexDirection: "row", gap: 10, marginHorizontal: 14, marginBottom: 14 },
  statCard:  { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, alignItems: "center" },
  statNum:   { color: "#fff", fontSize: 24, fontWeight: "800" },
  statLabel: { color: "#94a3b8", fontSize: 11, marginTop: 4 },

  milestoneCard:  { marginHorizontal: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 14 },
  milestoneTop:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  milestoneTitle: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  milestonePct:   { color: "#A78BFA", fontSize: 13, fontWeight: "700" },
  progressBar:    { height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  progressFill:   { height: "100%", backgroundColor: "#7C3AED", borderRadius: 6 },
  milestoneHint:  { color: "#64748b", fontSize: 11 },

  codeCard:      { marginHorizontal: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 14 },
  codeCardTitle: { color: "#94a3b8", fontSize: 12, marginBottom: 10 },
  codeRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeText:      { color: "#A78BFA", fontSize: 28, fontWeight: "900", letterSpacing: 3 },
  copyBtn:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(124,58,237,0.2)", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  copyText:      { color: "#A78BFA", fontWeight: "600", fontSize: 14 },
  codeHint:      { color: "#64748b", fontSize: 11, marginTop: 10 },

  howCard:     { marginHorizontal: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 14 },
  howTitle:    { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 14 },
  howStep:     { flexDirection: "row", gap: 14, marginBottom: 14 },
  howIcon:     { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(124,58,237,0.15)", alignItems: "center", justifyContent: "center" },
  howTextWrap: { flex: 1, justifyContent: "center" },
  howStepNum:  { color: "#94a3b8", fontSize: 11 },
  howStepText: { color: "#fff", fontSize: 13, fontWeight: "600", marginTop: 1 },

  historyCard:  { marginHorizontal: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 14 },
  historyTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 14 },
  referralItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  referralAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(124,58,237,0.15)", alignItems: "center", justifyContent: "center" },
  referralId:   { color: "#fff", fontSize: 13, fontWeight: "600" },
  referralDate: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  statusBadge:  { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGreen:   { backgroundColor: "rgba(52,211,153,0.15)" },
  badgeAmber:   { backgroundColor: "rgba(251,191,36,0.15)" },
  statusText:   { fontSize: 11, fontWeight: "600" },
  textGreen:    { color: "#34D399" },
  textAmber:    { color: "#FBBF24" },
  coinsEarned:  { color: "#A78BFA", fontSize: 13, fontWeight: "700" },

  stickyFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "rgba(7,4,18,0.95)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  shareBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#7C3AED", paddingVertical: 16, borderRadius: 16 },
  shareBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});