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
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function BookmarkScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "bookmarks", user.uid, "saved"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setData(list);
    });

    return unsub;
  }, [user]);

  // 🔍 FILTER LOGIC
  const filteredData = data.filter((item) => {
    const matchSearch = item.text
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchFilter =
      filter === "all" ? true : item.role === filter;

    return matchSearch && matchFilter;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerText, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.accent }]}>⭐ Saved Answers</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your favorite responses</Text>
      </View>

      {/* 🔍 SEARCH BAR */}
      <TextInput
        style={[styles.search, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
        placeholder="Search bookmarks..."
        placeholderTextColor={colors.textSecondary}
        value={search}
        onChangeText={setSearch}
      />

      {/* 🎯 FILTER BUTTONS */}
      <View style={styles.filterRow}>
        {["all", "ai", "user"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              filter === f && { backgroundColor: colors.accent, borderColor: colors.accent },
              { backgroundColor: filter !== f ? colors.card : undefined, borderColor: colors.border },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.activeFilterText,
                { color: filter !== f ? colors.textSecondary : "#fff" },
              ]}
            >
              {f === "ai" ? "🤖 AI" : f === "user" ? "👤 Me" : "📋 All"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 📋 LIST */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              item.role === "user" && { backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}30` },
            ]}
          >
            <Text style={[styles.role, { color: colors.accent }]}>
              {item.role === "user" ? "👤 You" : "🤖 AI Guru"}
            </Text>
            <Text style={[styles.text, { color: colors.text }]}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textSecondary }]}>No results found</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  headerText: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(56, 189, 248, 0.1)",
  },

  title: {
    color: "#38bdf8",
    fontSize: 24,
    fontWeight: "800",
  },

  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },

  search: {
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.15)",
  },

  filterRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 15,
    marginBottom: 12,
    gap: 8,
  },

  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.15)",
    alignItems: "center",
  },

  activeFilter: {
    backgroundColor: "#0ea5e9",
    borderColor: "#0ea5e9",
  },

  filterText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },

  activeFilterText: {
    color: "#fff",
    fontWeight: "600",
  },

  userCard: {
    backgroundColor: "rgba(123, 97, 255, 0.1)",
    borderColor: "rgba(123, 97, 255, 0.2)",
    borderWidth: 1,
  },

  card: {
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.1)",
  },

  role: {
    color: "#38bdf8",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "700",
  },

  text: {
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 20,
  },

  empty: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
    fontWeight: "500",
  },

});