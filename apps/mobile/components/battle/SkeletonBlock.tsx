// PATH: components/battle/SkeletonBlock.tsx
// Phase 2D-3 — plain Animated.View opacity pulse (no new animation
// library — react-native's own Animated is already used elsewhere in
// this app, e.g. skillboard.tsx's claim toast). Respects reduced-motion
// by simply not animating when the OS setting is on, per §32/§27.

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";

export function SkeletonBlock({ width, height, radius = 8, style }: { width: number | string; height: number; radius?: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: "rgba(255,255,255,0.08)" },
        reduceMotion ? { opacity: 0.5 } : { opacity },
        style,
      ]}
    />
  );
}

export function BattleCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width="100%" height={110} radius={16} />
      <View style={{ padding: 14, gap: 8 }}>
        <SkeletonBlock width="70%" height={16} />
        <SkeletonBlock width="45%" height={12} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <SkeletonBlock width={70} height={22} radius={11} />
          <SkeletonBlock width={70} height={22} radius={11} />
        </View>
      </View>
    </View>
  );
}

export function BattleDetailsSkeleton() {
  return (
    <View style={{ padding: 16, gap: 20 }}>
      <SkeletonBlock width="100%" height={160} radius={20} />
      <SkeletonBlock width="60%" height={14} />
      <SkeletonBlock width="90%" height={60} radius={14} />
      <SkeletonBlock width="90%" height={60} radius={14} />
      <SkeletonBlock width="90%" height={44} radius={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
});
