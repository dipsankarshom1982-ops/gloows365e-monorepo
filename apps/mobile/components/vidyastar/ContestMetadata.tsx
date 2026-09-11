// PATH: components/vidyastar/ContestMetadata.tsx
//
// Compact "icon + text" metadata row — replaces the old stack of separately
// bordered/padded pill rows (prize, spots, topic, date each in their own
// box) with a single flowing line. Cuts a big chunk of the old card's
// vertical height while keeping every piece of information.

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export interface ContestMetadataItem {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color?: string;
  /** Cap this item's own line so one very long field can't push the rest
   *  of the row off-screen or force ugly wraps. Defaults to true. */
  clamp?: boolean;
}

interface Props {
  items: ContestMetadataItem[];
  textColor: string;
  iconColor: string;
}

export default function ContestMetadata({ items, textColor, iconColor }: Props) {
  const visible = items.filter((i) => !!i.text);
  if (visible.length === 0) return null;
  return (
    <View style={s.row}>
      {visible.map((item, i) => (
        <View key={i} style={s.item}>
          {i > 0 && <Text style={[s.dot, { color: textColor }]}>·</Text>}
          <Ionicons name={item.icon} size={13} color={item.color ?? iconColor} />
          <Text
            style={[s.text, { color: item.color ?? textColor }]}
            numberOfLines={item.clamp === false ? undefined : 1}
            ellipsizeMode="tail"
          >
            {item.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row:  { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%", marginRight: 4 },
  dot:  { fontSize: 13, marginRight: 4, opacity: 0.5 },
  text: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
});
