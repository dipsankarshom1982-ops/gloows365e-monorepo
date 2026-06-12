// PATH: app/restart-education/opportunities.tsx

import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
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

interface Opportunity {
  id:          string;
  title:       string;
  description: string;
  emoji:       string;
  type:        string;
  deadline?:   string;
  link?:       string;
  isActive:    boolean;
  order:       number;
}

const FALLBACK: Opportunity[] = [
  { id: "1", title: "NIOS Admission Open", description: "Enroll for Class 10 or Class 12 through NIOS open schooling. Applications accepted year-round.", emoji: "📖", type: "Admission", deadline: "Open year-round", link: "https://www.nios.ac.in", isActive: true, order: 1 },
  { id: "2", title: "PMKVY Free Skill Training", description: "Get free skill training under Pradhan Mantri Kaushal Vikas Yojana. Certificate recognised by government.", emoji: "⚡", type: "Free Training", deadline: "Ongoing", link: "https://www.pmkvyofficial.org", isActive: true, order: 2 },
  { id: "3", title: "IGNOU Admission", description: "Pursue graduation from India's largest open university at very affordable fees.", emoji: "🎓", type: "Admission", deadline: "Jan & Jul cycles", link: "https://www.ignou.ac.in", isActive: true, order: 3 },
  { id: "4", title: "National Scholarship Portal", description: "Find government scholarships for continuing education. Multiple schemes available.", emoji: "💰", type: "Scholarship", deadline: "Various", link: "https://scholarships.gov.in", isActive: true, order: 4 },
  { id: "5", title: "ITI Free Admission", description: "Industrial Training Institutes offer free vocational courses in many states.", emoji: "🛠️", type: "Free Training", deadline: "June–August", link: "https://www.dget.nic.in", isActive: true, order: 5 },
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Admission:    { bg: "#DBEAFE", text: "#1d4ed8" },
  "Free Training": { bg: "#DCFCE7", text: "#15803d" },
  Scholarship:  { bg: "#FEF3C7", text: "#b45309" },
  Scheme:       { bg: "#EDE9FE", text: "#7c3aed" },
};

export default function Opportunities() {
  const router = useRouter();
  const [items,   setItems]   = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "educationOpportunities"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(q,
      (snap) => {
        setItems(snap.empty ? FALLBACK : snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity)));
        setLoading(false);
      },
      () => { setItems(FALLBACK); setLoading(false); }
    );
    return () => unsub();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>🎯 Opportunities</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#15803d" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          ListHeaderComponent={
            <Text style={S.intro}>
              Scholarships, free training programmes, and admission opportunities for adult learners across India.
            </Text>
          }
          renderItem={({ item }) => {
            const typeColor = TYPE_COLORS[item.type] ?? { bg: "#F3F4F6", text: "#374151" };
            return (
              <TouchableOpacity
                style={S.card}
                onPress={() => item.link && Linking.openURL(item.link).catch(() => {})}
                activeOpacity={0.85}
              >
                <View style={S.cardTop}>
                  <Text style={S.cardEmoji}>{item.emoji}</Text>
                  <View style={[S.typePill, { backgroundColor: typeColor.bg }]}>
                    <Text style={[S.typeText, { color: typeColor.text }]}>{item.type}</Text>
                  </View>
                </View>
                <Text style={S.cardTitle}>{item.title}</Text>
                <Text style={S.cardDesc}>{item.description}</Text>
                {item.deadline && (
                  <Text style={S.deadline}>⏰ {item.deadline}</Text>
                )}
                {item.link && (
                  <Text style={S.learnMore}>Learn more →</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  backBtn:     { width: 36, alignItems: "flex-start" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  intro:       { fontSize: 13, color: "#6B7280", lineHeight: 20, marginBottom: 8 },
  card:        { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: "#F3F4F6" },
  cardTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardEmoji:   { fontSize: 28 },
  typePill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typeText:    { fontSize: 11, fontWeight: "700" },
  cardTitle:   { fontSize: 15, fontWeight: "700", color: "#111" },
  cardDesc:    { fontSize: 13, color: "#6B7280", lineHeight: 19 },
  deadline:    { fontSize: 12, color: "#b45309", fontWeight: "600" },
  learnMore:   { fontSize: 12, fontWeight: "700", color: "#1d4ed8" },
});
