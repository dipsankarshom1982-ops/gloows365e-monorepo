// PATH: app/restart-education/success-stories.tsx

import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

interface Story {
  id:           string;
  name:         string;
  age:          number;
  state:        string;
  lastClass:    string;
  achievement:  string;
  story:        string;
  emoji:        string;
  isActive:     boolean;
  order:        number;
}

const FALLBACK: Story[] = [
  { id: "1", name: "Ravi Kumar", age: 26, state: "Bihar", lastClass: "Class 10 (Failed)", achievement: "Passed Class 12 via NIOS", story: "I failed Class 10 twice and had to start working at a factory. At 24, I discovered NIOS and studied at night after work. Two years later, I cleared Class 12 with 72% marks. Now I'm applying for a diploma in electrical work.", emoji: "⚡", isActive: true, order: 1 },
  { id: "2", name: "Sunita Devi", age: 31, state: "Uttar Pradesh", lastClass: "Class 8", achievement: "Completed Class 10 through State Open School", story: "I got married at 16 and never went back to school. At 29, with my husband's support, I joined the UP Open School. My children now see their mother studying. I passed Class 10 last year and am continuing to Class 12.", emoji: "🌸", isActive: true, order: 2 },
  { id: "3", name: "Mohammed Arif", age: 28, state: "West Bengal", lastClass: "Class 12 (Failed)", achievement: "Completed Skill India certification, now employed", story: "I failed my Class 12 boards and felt my future was over. A friend told me about PMKVY. I did a 3-month mobile repair course for free. Today I run my own small shop and earn more than most of my friends who went to college.", emoji: "📱", isActive: true, order: 3 },
  { id: "4", name: "Priya Nair", age: 34, state: "Kerala", lastClass: "Graduate (incomplete)", achievement: "Completed graduation from IGNOU", story: "I had to drop out of college in second year due to financial problems. At 31, I enrolled in IGNOU and completed my BA. It took 3 years but I did it while working. This opened the door to a government job.", emoji: "🎓", isActive: true, order: 4 },
];

export default function SuccessStories() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "restartSuccessStories"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(q,
      (snap) => {
        setStories(snap.empty ? FALLBACK : snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story)));
        setLoading(false);
      },
      () => { setStories(FALLBACK); setLoading(false); }
    );
    return () => unsub();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0a0a1a" }}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>🌟 Success Stories</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#fbbf24" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <LinearGradient
              colors={["#1a1040", "#2d1a0a"]}
              style={S.heroBanner}
            >
              <Text style={S.heroText}>
                Real people. Real struggles. Real victories.
              </Text>
              <Text style={S.heroSub}>
                These stories are from learners just like you who restarted their education journey.
              </Text>
            </LinearGradient>
          }
          renderItem={({ item }) => (
            <View style={S.card}>
              <View style={S.cardHeader}>
                <View style={S.avatarCircle}>
                  <Text style={S.avatarEmoji}>{item.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.name}>{item.name}</Text>
                  <Text style={S.meta}>{item.age} yrs · {item.state}</Text>
                  <Text style={S.lastClass}>Started from: {item.lastClass}</Text>
                </View>
              </View>
              <View style={S.achievementBadge}>
                <Text style={S.achievementText}>✓ {item.achievement}</Text>
              </View>
              <Text style={S.storyText}>"{item.story}"</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={S.footer}>
              <Text style={S.footerText}>
                Your story could inspire someone else.{"\n"}
                Talk to our AI Advisor to start your journey.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  backBtn:     { width: 36, alignItems: "flex-start" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  heroBanner:  { borderRadius: 16, padding: 20, marginBottom: 4, gap: 6 },
  heroText:    { color: "#fbbf24", fontSize: 16, fontWeight: "800", lineHeight: 24 },
  heroSub:     { color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 19 },
  card:        { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 18, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cardHeader:  { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatarCircle:{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(251,191,36,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(251,191,36,0.3)" },
  avatarEmoji: { fontSize: 24 },
  name:        { color: "#fff", fontSize: 16, fontWeight: "800" },
  meta:        { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  lastClass:   { color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 1 },
  achievementBadge: { backgroundColor: "rgba(22,163,74,0.15)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(22,163,74,0.25)" },
  achievementText:  { color: "#4ade80", fontSize: 13, fontWeight: "700" },
  storyText:   { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 21, fontStyle: "italic" },
  footer:      { marginTop: 8, alignItems: "center", padding: 20, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16 },
  footerText:  { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", lineHeight: 20 },
});
