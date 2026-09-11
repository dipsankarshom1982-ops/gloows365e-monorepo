// PATH: components/vidyastar/ContestFilterTabs.tsx
//
// Compact segmented control for the All / Live / Upcoming / Completed
// filter — replaces the old individually-bordered pill chips with a single
// neutral "track" the active pill slides visual weight across. Wrapped in
// a horizontal ScrollView (unchanged from before) so it never overflows on
// very small screens even though four labels usually fit without scrolling.

import { LinearGradient } from "expo-linear-gradient";
import { useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

export interface ContestFilterTab {
  id: string;
  label: string;
}

interface TabProps {
  tab: ContestFilterTab;
  active: boolean;
  onPress: () => void;
  trackColor: string;
  textColor: string;
}

function FilterPill({ tab, active, onPress, trackColor, textColor }: TabProps) {
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    onPress();
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 140, useNativeDriver: true }),
    ]).start();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {active ? (
          <LinearGradient colors={["#6366F1", "#8B5CF6", "#EC4899"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.pill}>
            <Text style={[s.label, { color: "#fff" }]}>{tab.label}</Text>
          </LinearGradient>
        ) : (
          <Animated.View style={[s.pill, { backgroundColor: trackColor }]}>
            <Text style={[s.label, { color: textColor }]}>{tab.label}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

interface Props {
  tabs: ContestFilterTab[];
  active: string;
  onChange: (id: string) => void;
  trackColor: string;
  textColor: string;
  containerColor: string;
}

export default function ContestFilterTabs({ tabs, active, onChange, trackColor, textColor, containerColor }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.track, { backgroundColor: containerColor }]}
    >
      {tabs.map((tab) => (
        <FilterPill
          key={tab.id}
          tab={tab}
          active={active === tab.id}
          onPress={() => onChange(tab.id)}
          trackColor={trackColor}
          textColor={textColor}
        />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: "row", gap: 6, padding: 4, borderRadius: 30 },
  pill:  { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 26, minHeight: 36, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 12.5, fontWeight: "700", letterSpacing: 0.2 },
});
