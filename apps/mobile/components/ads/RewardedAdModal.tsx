import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { recordWatchStart } from "@/services/adService";
import type { Ad } from "@/lib/ads/types";

const { width: W, height: H } = Dimensions.get("window");

interface Props {
  visible: boolean;
  ad: Ad | null;
  onClose: () => void;
  onRewardClaimed: (coins: number) => void;
  onWatchComplete: () => Promise<{ coins: number; message: string } | null>;
}

export default function RewardedAdModal({ visible, ad, onClose, onRewardClaimed, onWatchComplete }: Props) {
  const watchDuration = ad?.reward?.watchDurationSeconds ?? 15;

  const [progress, setProgress]         = useState(0);       // 0–1
  const [canClaim, setCanClaim]         = useState(false);
  const [claiming, setClaiming]         = useState(false);
  const [showReward, setShowReward]     = useState(false);
  const [rewardCoins, setRewardCoins]   = useState(0);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const rewardScale  = useRef(new Animated.Value(0)).current;
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (!visible || !ad) return;
    setProgress(0);
    setCanClaim(false);
    setShowReward(false);
    progressAnim.setValue(0);
    recordWatchStart(ad.id, "rewarded");

    // Start progress timer
    const step    = 100 / (watchDuration * 10); // every 100ms
    let current   = 0;
    intervalRef.current = setInterval(() => {
      current += step;
      if (current >= 100) {
        current = 100;
        clearInterval(intervalRef.current!);
        setCanClaim(true);
      }
      setProgress(current / 100);
      progressAnim.setValue(current / 100);
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, ad]);

  const handleClaim = async () => {
    if (!canClaim || claiming) return;
    setClaiming(true);
    try {
      const result = await onWatchComplete();
      if (result) {
        setRewardCoins(result.coins);
        showRewardPopup();
        onRewardClaimed(result.coins);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to claim reward");
    } finally {
      setClaiming(false);
    }
  };

  const showRewardPopup = () => {
    setShowReward(true);
    rewardScale.setValue(0);
    Animated.spring(rewardScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 6 }).start();
    setTimeout(() => {
      setShowReward(false);
      onClose();
    }, 2000);
  };

  if (!ad) return null;

  const secondsRemaining = Math.ceil((1 - progress) * watchDuration);
  const barWidth = W - 64;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={canClaim ? onClose : undefined}>
      <View style={S.overlay}>
        <LinearGradient colors={["#0a0a1a", "#1e1b4b"]} style={S.container}>

          {/* Header */}
          <View style={S.header}>
            <Text style={S.headerTitle}>🎬 Watch to Earn</Text>
            {canClaim && (
              <TouchableOpacity onPress={onClose} style={S.closeBtn}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Reward chip */}
          <View style={S.rewardChip}>
            <Text style={S.rewardChipText}>
              🪙 +{ad.reward?.coins ?? 0} V-Coins
            </Text>
          </View>

          {/* Video placeholder (replace with expo-video when available) */}
          <LinearGradient
            colors={["#1e293b", "#312e81"]}
            style={S.videoPlaceholder}
          >
            <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={S.adTitle} numberOfLines={2}>{ad.title}</Text>
            <Text style={S.sponsorName}>{ad.sponsorName}</Text>
          </LinearGradient>

          {/* Progress bar */}
          <View style={S.progressSection}>
            <View style={[S.progressTrack, { width: barWidth }]}>
              <Animated.View
                style={[
                  S.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, barWidth],
                    }),
                  },
                ]}
              />
            </View>
            {!canClaim && (
              <Text style={S.timerText}>Skip in {secondsRemaining}s</Text>
            )}
          </View>

          {/* Claim button */}
          <TouchableOpacity
            onPress={handleClaim}
            disabled={!canClaim || claiming}
            style={[S.claimBtn, (!canClaim || claiming) && S.claimBtnDisabled]}
          >
            <LinearGradient
              colors={canClaim ? ["#059669", "#10b981"] : ["#334155", "#334155"]}
              style={S.claimGradient}
            >
              <Text style={S.claimText}>
                {claiming ? "Claiming..." : canClaim ? `🎁 Claim ${ad.reward?.coins ?? 0} V-Coins` : `Watch ${secondsRemaining}s more`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

        </LinearGradient>

        {/* Reward popup */}
        {showReward && (
          <Animated.View style={[S.rewardPopup, { transform: [{ scale: rewardScale }] }]}>
            <Text style={S.rewardPopupEmoji}>🎉</Text>
            <Text style={S.rewardPopupText}>+{rewardCoins} V-Coins Earned!</Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  container:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 16 },

  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  headerTitle:      { color: "#f1f5f9", fontSize: 17, fontWeight: "900" },
  closeBtn:         { width: 36, height: 36, justifyContent: "center", alignItems: "center" },

  rewardChip:       { alignSelf: "center", backgroundColor: "rgba(251,191,36,0.15)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: "#fbbf24", marginBottom: 16 },
  rewardChipText:   { color: "#fbbf24", fontSize: 14, fontWeight: "700" },

  videoPlaceholder: { height: 200, borderRadius: 16, justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 20 },
  adTitle:          { color: "#f1f5f9", fontSize: 16, fontWeight: "800", textAlign: "center", paddingHorizontal: 20 },
  sponsorName:      { color: "rgba(255,255,255,0.55)", fontSize: 12 },

  progressSection:  { alignItems: "center", gap: 8, marginBottom: 20 },
  progressTrack:    { height: 6, backgroundColor: "#334155", borderRadius: 3, overflow: "hidden" },
  progressFill:     { height: "100%", backgroundColor: "#10b981", borderRadius: 3 },
  timerText:        { color: "#94a3b8", fontSize: 12, fontWeight: "600" },

  claimBtn:         { borderRadius: 16, overflow: "hidden" },
  claimBtnDisabled: { opacity: 0.7 },
  claimGradient:    { paddingVertical: 16, alignItems: "center" },
  claimText:        { color: "#fff", fontSize: 16, fontWeight: "800" },

  rewardPopup:      {
    position: "absolute", alignSelf: "center", top: "35%",
    backgroundColor: "#064e3b", borderRadius: 20, padding: 24,
    alignItems: "center", gap: 8, shadowColor: "#10b981", shadowOpacity: 0.6, shadowRadius: 20, elevation: 20,
  },
  rewardPopupEmoji: { fontSize: 48 },
  rewardPopupText:  { color: "#fff", fontSize: 20, fontWeight: "900" },
});
