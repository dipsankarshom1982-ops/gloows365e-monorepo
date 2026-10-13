// PATH: components/dailyStreakQuiz/ConfettiBurst.tsx
//
// Lightweight confetti celebration — no new dependency added (the app has
// no confetti package installed; see lottie-react-native / reanimated
// already in package.json). Pure Reanimated piece animation, mirrors the
// imperative-ref pattern used by components/seekho/XPToast.tsx so it can be
// dropped into any screen and triggered with `ref.current?.fire()`.

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export interface ConfettiBurstRef {
  fire: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#f97316"];
const PIECE_COUNT = 36;

interface ConfettiPieceProps {
  active: number;
  seed: number;
}

function ConfettiPiece({ active, seed }: ConfettiPieceProps) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  // re-derive a pseudo-random per-piece trajectory each time `active` ticks
  const startX = (seed * 97) % SCREEN_W;
  const drift = ((seed * 53) % 160) - 80;
  const duration = 1400 + ((seed * 31) % 900);
  const delay = (seed * 13) % 220;
  const color = COLORS[seed % COLORS.length];
  const size = 6 + (seed % 3) * 3;
  const isCircle = seed % 2 === 0;

  useEffect(() => {
    if (active <= 0) return;

    translateY.value = -20;
    translateX.value = 0;
    rotate.value = 0;
    opacity.value = 1;

    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_H * 0.75, { duration, easing: Easing.out(Easing.quad) })
    );
    translateX.value = withDelay(delay, withTiming(drift, { duration }));
    rotate.value = withDelay(
      delay,
      withTiming(360 + seed * 7, { duration, easing: Easing.linear })
    );
    opacity.value = withDelay(delay + duration * 0.6, withTiming(0, { duration: duration * 0.4 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: startX + translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: isCircle ? size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

const ConfettiBurst = forwardRef<ConfettiBurstRef>((_props, ref) => {
  const [active, setActive] = useState(0);

  useImperativeHandle(ref, () => ({
    fire() {
      setActive((n) => n + 1);
    },
  }));

  if (active === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: PIECE_COUNT }).map((_, i) => {
        const seed = i + active * 1000;
        return <ConfettiPiece key={`${active}-${i}`} active={active} seed={seed} />;
      })}
    </View>
  );
});

ConfettiBurst.displayName = "ConfettiBurst";
export default ConfettiBurst;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  piece: {
    position: "absolute",
    top: 0,
  },
});
