// PATH: components/vidyastar/ContestCardSkeleton.tsx
//
// Loading placeholder shaped like a real ContestCard (hero, title, metadata
// row, action button) so the list doesn't jump when real data arrives, and
// the user sees something resembling content instead of a blank screen or
// a single centered spinner. Same opacity-pulse technique already used by
// VCoinsHeaderBadge's skeleton — no shimmer-sweep library, cheap to run on
// low-end Android devices, and skipped entirely under reduced-motion.

import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

interface Props {
  colors: { card: string; border: string };
}

export default function ContestCardSkeleton({ colors }: Props) {
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, pulse]);

  const opacity = reduceMotion ? 0.7 : pulse;
  const blockColor = colors.border;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Animated.View style={[s.hero, { backgroundColor: blockColor, opacity }]} />
      <View style={s.body}>
        <Animated.View style={[s.line, { width: "70%", backgroundColor: blockColor, opacity }]} />
        <Animated.View style={[s.line, { width: "45%", backgroundColor: blockColor, opacity, marginTop: 8 }]} />
        <Animated.View style={[s.button, { backgroundColor: blockColor, opacity, marginTop: 16 }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:   { borderRadius: 24, borderWidth: 1, overflow: "hidden", marginBottom: 18 },
  hero:   { height: 130 },
  body:   { padding: 18 },
  line:   { height: 12, borderRadius: 6 },
  button: { height: 46, borderRadius: 16 },
});
