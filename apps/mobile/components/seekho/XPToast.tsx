import { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from "react-native-reanimated";

export interface XPToastRef {
  show: (xp?: number) => void;
}

const XPToast = forwardRef<XPToastRef>((_, ref) => {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const xpRef = { current: 200 };

  useImperativeHandle(ref, () => ({
    show(xp = 200) {
      xpRef.current = xp;
      translateY.value = withSequence(
        withTiming(0, { duration: 400 }),
        withDelay(1800, withTiming(-100, { duration: 350 }))
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(1900, withTiming(0, { duration: 300 }))
      );
    },
  }));

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[S.toast, animStyle]} pointerEvents="none">
      <View style={S.inner}>
        <Text style={S.sparkle}>✨</Text>
        <Text style={S.text}>+{xpRef.current} XP</Text>
        <Text style={S.sub}>Chapter Complete!</Text>
      </View>
    </Animated.View>
  );
});

XPToast.displayName = "XPToast";
export default XPToast;

const S = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 56,
    alignSelf: "center",
    zIndex: 999,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1.5,
    borderColor: "#6366f1",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    elevation: 8,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  sparkle: { fontSize: 18 },
  text: { color: "#fbbf24", fontSize: 16, fontWeight: "900" },
  sub: { color: "#a5b4fc", fontSize: 12, fontWeight: "600" },
});
