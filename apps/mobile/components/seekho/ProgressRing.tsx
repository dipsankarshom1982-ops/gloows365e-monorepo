import { StyleSheet, View } from "react-native";

interface Props {
  progress: number;     // 0–1
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
}

/**
 * Circular progress ring using the two-half-circle rotation technique.
 * No react-native-svg required.
 */
export default function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 5,
  color = "#6366f1",
  backgroundColor = "rgba(255,255,255,0.15)",
}: Props) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const halfSize = size / 2;
  const innerSize = size - strokeWidth * 2;

  // Left half rotates when progress > 50%
  const leftDeg = clampedProgress > 0.5 ? (clampedProgress - 0.5) * 360 : 0;
  // Right half is always the full right semicircle (first 50%)
  const showRight = clampedProgress > 0;

  return (
    <View style={[S.container, { width: size, height: size, borderRadius: halfSize }]}>
      {/* Background ring */}
      <View
        style={[
          S.bgRing,
          {
            width: size,
            height: size,
            borderRadius: halfSize,
            borderWidth: strokeWidth,
            borderColor: backgroundColor,
          },
        ]}
      />

      {/* Clip wrapper — clips right half */}
      <View
        style={[S.clipWrap, { width: halfSize, height: size, left: halfSize }]}
      >
        {/* Right semicircle */}
        {showRight && (
          <View
            style={[
              S.halfCircle,
              {
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: strokeWidth,
                borderColor: color,
                transform: [
                  { translateX: -halfSize },
                  {
                    rotate: `${Math.min(clampedProgress, 0.5) * 360}deg`,
                  },
                  { translateX: halfSize },
                ],
              },
            ]}
          />
        )}
      </View>

      {/* Clip wrapper — clips left half */}
      <View style={[S.clipWrap, { width: halfSize, height: size, left: 0 }]}>
        {clampedProgress > 0.5 && (
          <View
            style={[
              S.halfCircle,
              {
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: strokeWidth,
                borderColor: color,
                transform: [
                  { translateX: -halfSize },
                  { rotate: `${leftDeg}deg` },
                  { translateX: halfSize },
                ],
              },
            ]}
          />
        )}
      </View>

      {/* Inner circle creates the "donut" gap */}
      <View
        style={[
          S.inner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            top: strokeWidth,
            left: strokeWidth,
          },
        ]}
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  bgRing: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  clipWrap: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  halfCircle: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "transparent",
  },
  inner: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});
