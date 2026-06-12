// components/VCoinsHeaderBadge.tsx

import { formatVCoins } from "@/utils/formatVCoins";
import { subscribeToVCoinsBalance } from "@/services/vCoinsService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";

interface Props {
  uid: string | null;
  onPress?: () => void;
}

export default function VCoinsHeaderBadge({ uid, onPress }: Props) {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // ── Real-time balance subscription ───────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToVCoinsBalance(uid, (val) => setBalance(val));
    return unsub;
  }, [uid]);

  // ── Loading skeleton pulse ────────────────────────────────────────────────
  useEffect(() => {
    if (balance !== null) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [balance, pulseAnim]);

  if (!uid) return null;

  const handlePress = () => {
    if (onPress) { onPress(); return; }
    router.push("/vcoins/wallet");
  };

  if (balance === null) {
    return (
      <Animated.View style={[styles.skeleton, { opacity: pulseAnim }]} />
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <LinearGradient
        colors={["#F59E0B", "#D97706"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.pill}
      >
        <Ionicons name="logo-bitcoin" size={13} color="#fff" />
        <Text style={styles.label}>{formatVCoins(balance)}</Text>
        <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.75)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  label: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  skeleton: {
    width: 72,
    height: 28,
    borderRadius: 20,
    backgroundColor: "#F59E0B",
  },
});
