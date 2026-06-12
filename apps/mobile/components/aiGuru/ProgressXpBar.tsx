import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface Props {
  xp: number;
  maxXp?: number;
  label?: string;
}

export default function ProgressXpBar({ xp, maxXp = 100, label = "XP" }: Props) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pct = Math.min((xp / maxXp) * 100, 100);
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [xp, maxXp]);

  return (
    <View style={S.wrap}>
      <View style={S.row}>
        <Text style={S.label}>⚡ {label}</Text>
        <Text style={S.value}>{xp} / {maxXp}</Text>
      </View>
      <View style={S.track}>
        <Animated.View
          style={[
            S.fill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  wrap:  { gap: 4 },
  row:   { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#a5b4fc", fontSize: 12, fontWeight: "700" },
  value: { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  track: { height: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden" },
  fill:  { height: "100%", backgroundColor: "#6366f1", borderRadius: 6 },
});
