import { useTheme } from "@/context/ThemeContext";
import { StyleSheet, Text, View } from "react-native";

export default function AdsCard() {
  const { colors } = useTheme();
  return (
    <View style={[styles.ad, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
      <Text style={{ color: colors.text }}>🔥 Your Promotion Ad</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ad: {
    backgroundColor: "#334155",
    padding: 20,
    borderRadius: 15,
    marginVertical: 10,
  },
});