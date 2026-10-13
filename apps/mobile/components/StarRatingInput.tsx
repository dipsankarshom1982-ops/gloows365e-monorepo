// PATH: apps/mobile/components/StarRatingInput.tsx
// Mirrors web src/components/StarRatingInput.tsx — reusable tappable 5-star
// input, pure controlled component, no Firestore knowledge, so it's
// reusable wherever a rating needs collecting (currently just the Feedback
// & Ratings screen, but built generic enough for e.g. a future contextual
// "rate this" popup too).

import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  value: number;               // 0-5, 0 = unrated
  onChange: (v: number) => void;
  size?: number;                // default 28
  color?: string;                 // filled star color
  emptyColor?: string;            // outline star color
  disabled?: boolean;
  label?: string;
}

export default function StarRatingInput({
  value, onChange, size = 28, color = "#f59e0b", emptyColor, disabled, label,
}: Props) {
  const { colors } = useTheme();
  const empty = emptyColor ?? colors.border;

  return (
    <View>
      {label && <Text style={[S.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View style={S.row}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity
            key={i}
            disabled={disabled}
            onPress={() => onChange(i)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            activeOpacity={0.7}
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            <Ionicons name={i <= value ? "star" : "star-outline"} size={size} color={i <= value ? color : empty} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  row: { flexDirection: "row", gap: 6 },
});
