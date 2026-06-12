import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { GuruState } from "@/lib/vidyaguru/types";

interface Props {
  state: GuruState;
  size?: number;
}

export default function GuruAvatar({ state, size = 120 }: Props) {
  const blinkOpacity  = useSharedValue(1);
  const mouthH        = useSharedValue(3);
  const glowOpacity   = useSharedValue(0.4);
  const bobY          = useSharedValue(0);

  // Blink every ~4s
  useEffect(() => {
    blinkOpacity.value = withRepeat(
      withSequence(
        withDelay(3800, withTiming(0, { duration: 80 })),
        withTiming(1, { duration: 80 })
      ),
      -1,
      false
    );
  }, []);

  // Mouth + bob + glow driven by state
  useEffect(() => {
    if (state === "speaking") {
      mouthH.value = withRepeat(
        withSequence(
          withTiming(12, { duration: 180 }),
          withTiming(3,  { duration: 180 })
        ),
        -1,
        true
      );
      bobY.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 500 }),
          withTiming(0,  { duration: 500 })
        ),
        -1,
        true
      );
      glowOpacity.value = withTiming(1, { duration: 300 });
    } else if (state === "thinking") {
      mouthH.value    = withTiming(3, { duration: 200 });
      bobY.value      = withTiming(0, { duration: 200 });
      glowOpacity.value = withTiming(0.6, { duration: 300 });
    } else if (state === "listening") {
      mouthH.value    = withTiming(3, { duration: 200 });
      bobY.value      = withTiming(0, { duration: 200 });
      glowOpacity.value = withTiming(0.9, { duration: 300 });
    } else {
      mouthH.value    = withTiming(3, { duration: 200 });
      bobY.value      = withTiming(0, { duration: 200 });
      glowOpacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [state]);

  const faceAnim   = useAnimatedStyle(() => ({ transform: [{ translateY: bobY.value }] }));
  const eyeAnim    = useAnimatedStyle(() => ({ opacity: blinkOpacity.value }));
  const mouthAnim  = useAnimatedStyle(() => ({ height: mouthH.value }));
  const glowAnim   = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const s = size;
  const eyeSize   = s * 0.12;
  const eyeOffset = s * 0.15;
  const eyeY      = s * 0.08;

  return (
    <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
      {/* Glow ring */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: s / 2, backgroundColor: "#6366f1" },
          glowAnim,
        ]}
      />

      {/* Face */}
      <Animated.View
        style={[
          {
            width: s * 0.82,
            height: s * 0.82,
            borderRadius: s * 0.41,
            backgroundColor: "#fbbf24",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          },
          faceAnim,
        ]}
      >
        {/* Eyes row */}
        <Animated.View
          style={[
            {
              flexDirection: "row",
              gap: eyeOffset * 2,
              marginBottom: s * 0.04,
              marginTop: -eyeY,
            },
            eyeAnim,
          ]}
        >
          <View style={[S.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }]} />
          <View style={[S.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }]} />
        </Animated.View>

        {/* Mouth */}
        <Animated.View
          style={[
            {
              width: s * 0.3,
              borderRadius: 4,
              backgroundColor: "#92400e",
              marginTop: s * 0.02,
            },
            mouthAnim,
          ]}
        />
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  eye: { backgroundColor: "#1e1b4b" },
});
