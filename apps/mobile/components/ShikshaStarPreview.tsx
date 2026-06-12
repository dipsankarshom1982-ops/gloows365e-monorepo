import { useTheme } from "@/context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Shikshastar() {
  const { colors } = useTheme();
  const contests = [
    {
      id: "1",
      title: "Mega Learning Battle",
      prize: "₹9,000",
      time: "02:10:25",
    },
    {
      id: "2",
      title: "Maths Champion",
      prize: "₹5,000",
      time: "01:05:10",
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>🎯 Shikshastar</Text>

      {contests.map((c) => (
        <TouchableOpacity key={c.id}>
          <LinearGradient
            colors={["#7b61ff", "#00c6ff"]}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{c.title}</Text>

            <Text style={styles.prize}>🏆 {c.prize}</Text>

            <Text style={styles.timer}>⏳ {c.time}</Text>

            <View style={styles.joinBtn}>
              <Text style={styles.joinText}>Join Now</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },

  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },

  card: {
    padding: 16,
    borderRadius: 15,
    marginBottom: 10,
  },

  cardTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  prize: {
    color: "#fff",
    marginTop: 5,
  },

  timer: {
    color: "#eee",
    marginTop: 5,
  },

  joinBtn: {
    marginTop: 10,
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },

  joinText: {
    color: "#000",
    fontWeight: "bold",
  },
});