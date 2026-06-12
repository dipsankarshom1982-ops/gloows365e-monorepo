import { useTheme } from "@/context/ThemeContext";
import { useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity } from "react-native";

const categories = [
  "All",
  "Science",
  "Maths",
  "History",
  "Geography",
  "Dance",
  "Art & Craft",
];

export default function Chips() {
  const { colors } = useTheme();
  const [selectedChip, setSelectedChip] = useState("All");

  return (
    <FlatList
      data={categories}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity 
          style={[
            styles.chip,
            {
              backgroundColor: selectedChip === item ? colors.accent : colors.card,
              borderColor: colors.border,
              borderWidth: 1,
            }
          ]}
          onPress={() => setSelectedChip(item)}
        >
          <Text style={[
            styles.text,
            { color: selectedChip === item ? "#fff" : colors.textSecondary }
          ]}>
            {item}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  text: {
    color: "#fff",
  },
});