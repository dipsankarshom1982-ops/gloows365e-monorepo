// components/aiGuru/CreditBalanceBadge.tsx
// AI Guru credit balance pill — structural copy of components/
// VCoinsHeaderBadge.tsx (live onSnapshot, pulse skeleton while loading),
// recolored to AI Guru's indigo/violet instead of V-Coin amber. Only shown
// when the student has a non-zero balance (see app/ai-guru/index.tsx) —
// students who've never bought credits don't need an empty pill cluttering
// the header.

import { subscribeToCreditBalance } from "@/services/aiGuruCreditsService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";

interface Props {
  uid: string | null;
  onPress?: () => void;
}

export default function CreditBalanceBadge({ uid, onPress }: Props) {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToCreditBalance(uid, (val) => setBalance(val));
    return unsub;
  }, [uid]);

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
  // Still loading — show the skeleton so it doesn't pop in/out once the
  // balance resolves to zero (nothing renders at all in that case).
  if (balance === null) {
    return <Animated.View style={[styles.skeleton, { opacity: pulseAnim }]} />;
  }
  if (balance <= 0) return null;

  const handlePress = () => {
    if (onPress) { onPress(); return; }
    router.push("/ai-guru/credits" as any);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <LinearGradient
        colors={["#4F46E5", "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.pill}
      >
        <Ionicons name="flash" size={13} color="#fff" />
        <Text style={styles.label}>{balance}</Text>
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
    width: 60,
    height: 28,
    borderRadius: 20,
    backgroundColor: "#4F46E5",
  },
});
