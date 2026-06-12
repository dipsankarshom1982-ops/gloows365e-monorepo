import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
} from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";

import { useEffect, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function HistoryScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "aiChats", user.uid, "messages"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setData(list);
    });

    return unsub;
  }, [user]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerText, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.accent }]}>🧠 Chat History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your recent conversations</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { 
                backgroundColor: colors.card, 
                borderColor: colors.border,
                borderWidth: 1,
              },
              item.role === "user" && { 
                backgroundColor: `${colors.accent}15`,
                borderColor: `${colors.accent}30`,
              },
            ]}
          >
            <Text style={[styles.role, { color: colors.accent }]}>
              {item.role === "user" ? "👤 You" : "🤖 AI Guru"}
            </Text>
            <Text style={[styles.text, { color: colors.text }]}>{item.text}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 15,
  },

  headerText: {
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 15,
  },

  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },

  subtitle: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },

  card: {
    backgroundColor: "#1E293B",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },

  role: {
    color: "#7b61ff",
    fontSize: 12,
    marginBottom: 5,
  },

  text: {
    color: "#fff",
    fontSize: 14,
  },

});