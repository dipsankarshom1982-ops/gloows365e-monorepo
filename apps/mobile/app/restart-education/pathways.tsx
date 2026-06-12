// PATH: app/restart-education/pathways.tsx
// Dynamic educational pathways from Firestore educationPathways/ collection.
// Admin can add/disable pathways without code changes.

import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

interface Pathway {
  id:           string;
  title:        string;
  description:  string;
  emoji:        string;
  color:        string;
  isActive:     boolean;
  learnMoreUrl: string;
  order:        number;
  tags?:        string[];
}

// Built-in fallback pathways (shown if Firestore has none)
const FALLBACK_PATHWAYS: Pathway[] = [
  { id: "nios", title: "NIOS Open Schooling", description: "Complete Class 10 or 12 through National Institute of Open Schooling at your own pace from anywhere in India.", emoji: "📖", color: "#1d4ed8", isActive: true, learnMoreUrl: "https://www.nios.ac.in", order: 1, tags: ["Class 10", "Class 12", "Government"] },
  { id: "ignou", title: "IGNOU Distance Learning", description: "Pursue graduation and post-graduation through India's largest open university. Flexible schedules, affordable fees.", emoji: "🎓", color: "#7c3aed", isActive: true, learnMoreUrl: "https://www.ignou.ac.in", order: 2, tags: ["Graduation", "Post-Grad", "Government"] },
  { id: "iti", title: "ITI Vocational Training", description: "Gain practical skills in trades like electrician, plumber, mechanic, and more. Government-recognised certification.", emoji: "🛠️", color: "#b45309", isActive: true, learnMoreUrl: "https://www.dget.nic.in", order: 3, tags: ["Vocational", "Skills", "Government"] },
  { id: "skill-india", title: "Skill India / PMKVY", description: "Free skill development training under Pradhan Mantri Kaushal Vikas Yojana. 300+ courses across industries.", emoji: "⚡", color: "#15803d", isActive: true, learnMoreUrl: "https://www.pmkvyofficial.org", order: 4, tags: ["Free", "Skills", "Government"] },
  { id: "state-open", title: "State Open Schools", description: "Many states have their own open schools for Class 10 and 12. Often easier to access than NIOS for local learners.", emoji: "🏫", color: "#0e7490", isActive: true, learnMoreUrl: "https://www.nios.ac.in/state-open-schools.aspx", order: 5, tags: ["Class 10", "Class 12", "State"] },
];

export default function Pathways() {
  const router = useRouter();
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "educationPathways"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setPathways(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pathway)));
      } else {
        setPathways(FALLBACK_PATHWAYS);
      }
      setLoading(false);
    }, () => {
      setPathways(FALLBACK_PATHWAYS);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={pw.container}>
        <View style={pw.header}>
          <TouchableOpacity onPress={() => router.back()} style={pw.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={pw.headerTitle}>🎓 Education Pathways</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1d4ed8" style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={pathways}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
            ListHeaderComponent={
              <Text style={pw.intro}>
                Every pathway below is a legitimate, government-recognised way to continue your education.
                Tap any card to learn more.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={pw.card}
                onPress={() => {
                  if (item.learnMoreUrl) {
                    Linking.openURL(item.learnMoreUrl).catch(() => {});
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={[pw.cardLeft, { backgroundColor: `${item.color}20` }]}>
                  <Text style={pw.cardEmoji}>{item.emoji}</Text>
                </View>
                <View style={pw.cardContent}>
                  <Text style={pw.cardTitle}>{item.title}</Text>
                  <Text style={pw.cardDesc} numberOfLines={3}>{item.description}</Text>
                  {item.tags && (
                    <View style={pw.tags}>
                      {item.tags.map((tag) => (
                        <View key={tag} style={[pw.tag, { backgroundColor: `${item.color}15` }]}>
                          <Text style={[pw.tagText, { color: item.color }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {item.learnMoreUrl ? (
                    <Text style={[pw.learnMore, { color: item.color }]}>Learn more →</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const pw = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F9FAFB" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  backBtn:     { width: 36, alignItems: "flex-start" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  intro:       { fontSize: 13, color: "#6B7280", lineHeight: 20, marginBottom: 8 },
  card:        { flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 14, borderWidth: 1, borderColor: "#F3F4F6" },
  cardLeft:    { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardEmoji:   { fontSize: 26 },
  cardContent: { flex: 1, gap: 4 },
  cardTitle:   { fontSize: 15, fontWeight: "700", color: "#111" },
  cardDesc:    { fontSize: 12, color: "#6B7280", lineHeight: 18 },
  tags:        { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagText:     { fontSize: 10, fontWeight: "700" },
  learnMore:   { fontSize: 12, fontWeight: "700", marginTop: 4 },
});
