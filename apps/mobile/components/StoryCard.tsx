// PATH: components/StoryCard.tsx
// Reusable square card component for the educational story strip.
// Replaces the old circular StoryAvatar entirely.
//
// Props:
//   category   — StoryCategory object (icon + gradient + label)
//   count      — number of stories in this category
//   hasUnread  — show red unread dot
//   isNew      — show "NEW" badge (story added in last 24h)
//   onPress    — open viewer for this category
//   size       — card size in px (default 100)

import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StoryCategory } from "@/lib/storyCategories";

// ─── Animated unread pulse ────────────────────────────────────────────────────

const UnreadDot = React.memo(() => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.35, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <View style={styles.dotWrap}>
      {/* Outer pulse ring */}
      <Animated.View style={[styles.dotRing, { transform: [{ scale }] }]} />
      {/* Solid red dot */}
      <View style={styles.dot} />
    </View>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

interface StoryCardProps {
  category:  StoryCategory;
  count:     number;
  hasUnread: boolean;
  isNew:     boolean;
  onPress:   () => void;
  size?:     number;
}

export const StoryCard = React.memo(function StoryCard({
  category,
  count,
  hasUnread,
  isNew,
  onPress,
  size = 100,
}: StoryCardProps) {
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const cardHeight = Math.round(size * 1.18);

  return (
    <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[styles.wrapper, { width: size, marginHorizontal: 5 }]}
      >
        {/* Card body */}
        <LinearGradient
          colors={category.gradient}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.card, { width: size, height: cardHeight, borderRadius: 14 }]}
        >
          {/* Subtle shimmer overlay */}
          <View style={styles.shimmer} />

          {/* Top-left: NEW badge */}
          {isNew && !hasUnread && (
            <View style={styles.newBadge}>
              <Text style={styles.newText}>NEW</Text>
            </View>
          )}

          {/* Top-right: unread indicator */}
          {hasUnread && <UnreadDot />}

          {/* Count pill (bottom-left, shows if > 1 story) */}
          {count > 1 && (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          )}

          {/* Category icon */}
          <Text style={[styles.emoji, { fontSize: size * 0.28 }]}>
            {category.emoji}
          </Text>
        </LinearGradient>

        {/* Label below card */}
        <Text style={styles.label} numberOfLines={1}>
          {category.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Add Story card ───────────────────────────────────────────────────────────

interface AddStoryCardProps {
  onPress: () => void;
  size?:   number;
}

export const AddStoryCard = React.memo(function AddStoryCard({
  onPress,
  size = 100,
}: AddStoryCardProps) {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const cardHeight = Math.round(size * 1.18);

  return (
    <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(pressAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
        }
        onPressOut={() =>
          Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start()
        }
        activeOpacity={1}
        style={[styles.wrapper, { width: size, marginHorizontal: 5 }]}
      >
        <View
          style={[
            styles.addCard,
            { width: size, height: cardHeight, borderRadius: 14 },
          ]}
        >
          <Text style={styles.addPlus}>+</Text>
        </View>
        <Text style={styles.label}>Your Story</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },
  card: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 12,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Diagonal light strip — static shimmer (no animation to keep it lightweight)
    backgroundColor: "transparent",
    borderRadius: 14,
    // Top-left corner lightness
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.18)",
    borderLeftColor: "rgba(255,255,255,0.12)",
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  emoji: {
    marginBottom: 8,
  },

  // Unread dot
  dotWrap: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dotRing: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255, 78, 78, 0.35)",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#FF4E4E",
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  // NEW badge
  newBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  // Count pill
  countPill: {
    position: "absolute",
    bottom: 10,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  countText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },

  // Label
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
    marginTop: 6,
    textAlign: "center",
    maxWidth: 96,
  },

  // Add card
  addCard: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(99,102,241,0.4)",
    backgroundColor: "rgba(99,102,241,0.04)",
  },
  addPlus: {
    fontSize: 26,
    color: "#6366f1",
    fontWeight: "300",
    lineHeight: 32,
  },
});
