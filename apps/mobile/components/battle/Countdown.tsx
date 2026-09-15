// PATH: components/battle/Countdown.tsx
// Phase 2D-3 — purely presentational. Ticks off an authoritative
// deadline it's given; never invents one, never writes battle state, and
// stops cleanly at zero rather than showing a negative/garbage duration.

import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes / 60) % 24);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export default function Countdown({ deadline, style }: { deadline: Date | null; style?: object }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    // Minute-granularity display doesn't need a sub-second tick — avoids
    // unnecessary re-renders on a screen that may list many battle cards.
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={styles.text}>Ongoing</Text>
      </View>
    );
  }

  const remaining = deadline.getTime() - now;
  return (
    <View style={[styles.wrap, style]} accessibilityLabel={remaining <= 0 ? "This battle has ended" : `Time remaining: ${formatRemaining(remaining)}`}>
      <Text style={styles.text}>{formatRemaining(remaining)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center" },
  text: { fontSize: 11, fontWeight: "700", color: "#ffd166" },
});
