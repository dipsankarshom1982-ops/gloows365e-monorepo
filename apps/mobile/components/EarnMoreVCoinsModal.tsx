// PATH: apps/mobile/components/EarnMoreVCoinsModal.tsx
// Shown from vidyastar.tsx when joinContest() reports insufficient_balance.
// Rather than a dead-end error, it advises the student on exactly how to
// earn the shortfall — each option routes to a screen that actually
// credits V-Coins for that action (see services/vCoinsService.ts):
//   • Reels / Videos   → rewardForWatchCompletion via app/(drawer)/(tabs)/reels.tsx
//   • Daily Streak Quiz → submitDailyStreakQuizAnswer Cloud Function
//   • Skill Battle      → rewardForSkillBattleWin / claimSkillBattleRewards

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  required: number;
  balance: number;
  contestTitle?: string;
}

const EARN_OPTIONS = [
  {
    key: "reels",
    icon: "play-circle" as const,
    label: "Watch Reels",
    sub: "+1 V-Coin per reel",
    colors: ["#7c2d12", "#ea580c"] as [string, string],
    route: "/(drawer)/(tabs)/reels",
  },
  {
    key: "quiz",
    icon: "help-circle" as const,
    label: "Daily Streak Quiz",
    sub: "Answer today's question",
    colors: ["#7c3aed", "#a855f7"] as [string, string],
    route: "/daily-streak-quiz",
  },
  {
    key: "video",
    icon: "videocam" as const,
    label: "Watch Videos",
    sub: "+3 V-Coins per video",
    colors: ["#1e40af", "#3b82f6"] as [string, string],
    route: "/(drawer)/(tabs)/reels",
  },
  {
    key: "skillbattle",
    icon: "flash" as const,
    label: "Skill Battle",
    sub: "Win up to 50 V-Coins",
    colors: ["#065f46", "#059669"] as [string, string],
    route: "/(drawer)/(tabs)/skillbattle",
  },
];

export default function EarnMoreVCoinsModal({ visible, onClose, required, balance, contestTitle }: Props) {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const router = useRouter();
  const shortfall = Math.max(0, required - balance);

  const goEarn = (route: string) => {
    onClose();
    router.push(route as any);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={S.backdrop} onPress={onClose}>
        <Pressable style={[S.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={S.handle} />

          <LinearGradient colors={["#92400e", "#d97706", "#f59e0b"]} style={S.hero}>
            <Text style={S.heroEmoji}>🪙</Text>
            <Text style={S.heroTitle}>{t("notEnoughVCoins") ?? "Not enough V-Coins"}</Text>
            <Text style={S.heroSub}>
              {contestTitle
                ? `"${contestTitle}" needs ${required} V-Coins — you have ${balance}.`
                : `This contest needs ${required} V-Coins — you have ${balance}.`}
            </Text>
            <View style={S.shortfallPill}>
              <Text style={S.shortfallText}>Earn {shortfall} more to join</Text>
            </View>
          </LinearGradient>

          <Text style={[S.optionsTitle, { color: colors.text }]}>
            {t("waysToEarn") ?? "Ways to earn V-Coins"}
          </Text>

          <View style={S.grid}>
            {EARN_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.85}
                onPress={() => goEarn(opt.route)}
                style={S.optionWrap}
              >
                <LinearGradient colors={opt.colors} style={S.optionCard}>
                  <Ionicons name={opt.icon} size={26} color="#fff" />
                  <Text style={S.optionLabel}>{opt.label}</Text>
                  <Text style={S.optionSub}>{opt.sub}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={onClose} style={[S.closeBtn, { borderColor: colors.border }]}>
            <Text style={[S.closeBtnText, { color: colors.textSecondary }]}>
              {t("maybeLater") ?? "Maybe later"}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 24, maxHeight: "88%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(148,163,184,0.4)", alignSelf: "center", marginTop: 10, marginBottom: 4 },

  hero: { margin: 16, borderRadius: 20, padding: 20, alignItems: "center" },
  heroEmoji: { fontSize: 36, marginBottom: 6 },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 6, lineHeight: 17 },
  shortfallPill: { marginTop: 12, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  shortfallText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  optionsTitle: { fontSize: 14, fontWeight: "800", marginLeft: 20, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 12, justifyContent: "space-between" },
  optionWrap: { width: "47%" },
  optionCard: { borderRadius: 16, padding: 14, gap: 4, minHeight: 100, justifyContent: "center" },
  optionLabel: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 6 },
  optionSub: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "600" },

  closeBtn: { marginTop: 18, marginHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  closeBtnText: { fontSize: 13, fontWeight: "700" },
});
