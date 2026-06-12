// components/learnfun/MysteryBoxModal.tsx

import { useTheme } from "@/context/ThemeContext";
import { MissionReward } from "@/lib/learnfun/types";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface MysteryBoxModalProps {
  visible: boolean;
  onClose: () => void;
  reward: MissionReward;
}

export default function MysteryBoxModal({ visible, onClose, reward }: MysteryBoxModalProps) {
  const { colors } = useTheme();
  const [opened, setOpened] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setOpened(false);
      scaleAnim.setValue(0);
      revealAnim.setValue(0);
      rotateAnim.setValue(0);

      // Entry animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 120,
      }).start();

      // Box wiggle
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: -1, duration: 150, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.delay(600),
        ]),
        { iterations: 3 }
      ).start();
    }
  }, [visible, scaleAnim, revealAnim, rotateAnim]);

  const handleOpenBox = () => {
    if (opened) return;
    setOpened(true);

    Animated.parallel([
      Animated.spring(bounceAnim, {
        toValue: 1.3,
        useNativeDriver: true,
        damping: 5,
        stiffness: 200,
      }),
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.spring(bounceAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
      }).start();
    });
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={opened ? onClose : undefined}>
        <Animated.View
          style={[
            styles.container,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Header */}
          <Text style={[styles.title, { color: colors.text }]}>
            {opened ? "🎉 Reward Unlocked!" : "🎁 Mystery Box!"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {opened ? "You earned these rewards!" : "Tap the box to reveal your reward!"}
          </Text>

          {/* Box */}
          {!opened ? (
            <TouchableOpacity onPress={handleOpenBox} activeOpacity={0.85}>
              <Animated.View
                style={[
                  styles.boxContainer,
                  { transform: [{ rotate }, { scale: bounceAnim }] },
                ]}
              >
                <Text style={styles.boxEmoji}>📦</Text>
                <Text style={[styles.tapText, { color: colors.textSecondary }]}>
                  Tap to open!
                </Text>
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <Animated.View style={[styles.rewardContainer, { opacity: revealAnim }]}>
              {/* Coins */}
              <View style={styles.rewardItem}>
                <View style={[styles.rewardIconBg, { backgroundColor: "rgba(245,158,11,0.2)" }]}>
                  <Text style={styles.rewardItemEmoji}>🪙</Text>
                </View>
                <Text style={[styles.rewardAmount, { color: "#F59E0B" }]}>
                  +{reward.coins} Coins
                </Text>
              </View>

              {/* XP */}
              <View style={styles.rewardItem}>
                <View style={[styles.rewardIconBg, { backgroundColor: "rgba(56,189,248,0.2)" }]}>
                  <Text style={styles.rewardItemEmoji}>⚡</Text>
                </View>
                <Text style={[styles.rewardAmount, { color: "#38BDF8" }]}>
                  +{reward.xp} XP
                </Text>
              </View>

              {/* Badge (if any) */}
              {reward.badge && (
                <View style={styles.rewardItem}>
                  <View style={[styles.rewardIconBg, { backgroundColor: "rgba(139,92,246,0.2)" }]}>
                    <Text style={styles.rewardItemEmoji}>🏅</Text>
                  </View>
                  <Text style={[styles.rewardAmount, { color: "#8B5CF6" }]}>
                    New Badge!
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Close button */}
          {opened && (
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.closeBtnText}>🚀 Continue</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#1E293B",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    gap: 20,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  boxContainer: {
    alignItems: "center",
    gap: 8,
  },
  boxEmoji: {
    fontSize: 80,
  },
  tapText: {
    fontSize: 14,
    fontWeight: "600",
  },
  rewardContainer: {
    gap: 16,
    width: "100%",
  },
  rewardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
  },
  rewardIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardItemEmoji: {
    fontSize: 24,
  },
  rewardAmount: {
    fontSize: 20,
    fontWeight: "800",
  },
  closeBtn: {
    backgroundColor: "#38BDF8",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
