import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface Props {
  speaking?: boolean;
  size?: number;
}

export default function AiGuruAvatar({ speaking = false, size = 64 }: Props) {
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Idle breathing
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.00, duration: 1800, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, []);

  useEffect(() => {
    if (speaking) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [speaking]);

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(99,102,241,0.3)", "rgba(99,102,241,0.9)"],
  });

  return (
    <View style={[styles.wrapper, { width: size + 24, height: size + 24 }]}>
      <Animated.View
        style={[
          styles.glow,
          { width: size + 24, height: size + 24, borderRadius: (size + 24) / 2, backgroundColor: glowColor },
        ]}
      />
      <Animated.View
        style={[
          styles.avatarWrap,
          { width: size, height: size, borderRadius: size / 2, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={[styles.emoji, { fontSize: size * 0.55 }]}>🤖</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { alignItems: "center", justifyContent: "center" },
  glow:       { position: "absolute" },
  avatarWrap: { backgroundColor: "#1e1b4b", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#6366f1" },
  emoji:      { textAlign: "center" },
});
