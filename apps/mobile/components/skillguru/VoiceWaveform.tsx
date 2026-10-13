import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const MAX_HEIGHT = 36;
const MIN_HEIGHT = 4;
const DURATIONS  = [340, 280, 420, 260, 380, 300, 360];

interface Props {
  recording: boolean;
}

function WaveBar({ duration, recording }: { duration: number; recording: boolean }) {
  const h = useSharedValue(MIN_HEIGHT);

  useEffect(() => {
    if (recording) {
      h.value = withRepeat(
        withSequence(
          withTiming(MIN_HEIGHT + Math.floor(Math.random() * (MAX_HEIGHT - MIN_HEIGHT)), { duration }),
          withTiming(MIN_HEIGHT, { duration })
        ),
        -1,
        true
      );
    } else {
      h.value = withTiming(MIN_HEIGHT, { duration: 200 });
    }
  }, [recording]);

  const anim = useAnimatedStyle(() => ({ height: h.value }));

  return (
    <Animated.View
      style={[
        { width: 4, borderRadius: 3, backgroundColor: recording ? "#818cf8" : "#334155" },
        anim,
      ]}
    />
  );
}

export default function VoiceWaveform({ recording }: Props) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: MAX_HEIGHT + 4 }}>
      {DURATIONS.map((dur, i) => (
        <WaveBar key={i} duration={dur} recording={recording} />
      ))}
    </View>
  );
}
