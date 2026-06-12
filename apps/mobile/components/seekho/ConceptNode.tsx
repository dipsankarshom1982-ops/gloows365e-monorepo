import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface Props {
  tag: string;
  state: "completed" | "active" | "locked";
  onPress?: () => void;
}

const STATE_COLORS = {
  completed: { bg: "#059669", border: "#10b981", text: "#fff" },
  active:    { bg: "#4f46e5", border: "#6366f1", text: "#fff" },
  locked:    { bg: "#1e293b", border: "#334155", text: "#64748b" },
};

export default function ConceptNode({ tag, state, onPress }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (state === "active") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800 }),
          withTiming(1.0, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [state]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const c = STATE_COLORS[state];

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[
          S.node,
          {
            backgroundColor: c.bg,
            borderColor: c.border,
            opacity: state === "locked" ? 0.55 : 1,
          },
        ]}
        onPress={onPress}
        activeOpacity={state === "locked" ? 1 : 0.8}
      >
        {state === "completed" && (
          <Ionicons name="checkmark" size={11} color="#fff" style={S.icon} />
        )}
        {state === "locked" && (
          <Ionicons name="lock-closed" size={10} color="#64748b" style={S.icon} />
        )}
        <Text style={[S.label, { color: c.text }]} numberOfLines={2}>
          {tag}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  node: {
    width: 90,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  icon: { marginBottom: 1 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
  },
});
