// PATH: app/restart-education/guidance.tsx
// Shows user's submitted guidance requests with current status.

import { auth, db } from "@/lib/firebase";
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
import LeadCaptureModal from "@/components/restart/LeadCaptureModal";

interface Lead {
  id:              string;
  name:            string;
  mobile:          string;
  state:           string;
  district:        string;
  status:          string;
  assignedPartner: string;
  notes:           string;
  createdAt:       any;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  New:       { color: "#1d4ed8", bg: "#DBEAFE", label: "New — Under review" },
  Verified:  { color: "#7c3aed", bg: "#EDE9FE", label: "Verified" },
  Assigned:  { color: "#b45309", bg: "#FEF3C7", label: "Assigned to advisor" },
  Contacted: { color: "#0e7490", bg: "#CFFAFE", label: "Team contacted you" },
  Admitted:  { color: "#15803d", bg: "#DCFCE7", label: "Admitted to programme" },
  Closed:    { color: "#6B7280", bg: "#F3F4F6", label: "Closed" },
};

export default function GuidanceRequests() {
  const router  = useRouter();
  const [leads,      setLeads]      = useState<Lead[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, "educationLeads"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={S.container}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={S.headerTitle}>🤝 My Guidance Requests</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 60 }} />
        ) : leads.length === 0 ? (
          <View style={S.empty}>
            <Text style={S.emptyEmoji}>🤝</Text>
            <Text style={S.emptyTitle}>No requests yet</Text>
            <Text style={S.emptySub}>
              Submit a guidance request and our team will reach out to help you for free.
            </Text>
            <TouchableOpacity style={S.requestBtn} onPress={() => setShowModal(true)}>
              <LinearGradient colors={["#16a34a", "#15803d"]} style={S.requestGradient}>
                <Text style={S.requestBtnText}>Request Free Guidance</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={leads}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
            ListHeaderComponent={
              <TouchableOpacity style={S.newRequestBtn} onPress={() => setShowModal(true)}>
                <Ionicons name="add-circle-outline" size={18} color="#16a34a" />
                <Text style={S.newRequestText}>Submit Another Request</Text>
              </TouchableOpacity>
            }
            renderItem={({ item }) => {
              const statusConf = STATUS_CONFIG[item.status] ?? STATUS_CONFIG["New"];
              const date = item.createdAt?.toDate?.()?.toLocaleDateString("en-IN") ?? "";
              return (
                <View style={S.card}>
                  <View style={S.cardTop}>
                    <View style={[S.statusPill, { backgroundColor: statusConf.bg }]}>
                      <Text style={[S.statusText, { color: statusConf.color }]}>
                        {statusConf.label}
                      </Text>
                    </View>
                    {!!date && <Text style={S.dateText}>{date}</Text>}
                  </View>
                  <Text style={S.cardName}>{item.name}</Text>
                  <Text style={S.cardLocation}>{item.district}, {item.state}</Text>
                  {!!item.assignedPartner && (
                    <Text style={S.assignedText}>Advisor: {item.assignedPartner}</Text>
                  )}
                  {!!item.notes && (
                    <View style={S.notesBox}>
                      <Text style={S.notesLabel}>Team note:</Text>
                      <Text style={S.notesText}>{item.notes}</Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}

        <LeadCaptureModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          onSubmitted={() => setShowModal(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F9FAFB" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  backBtn:      { width: 36, alignItems: "flex-start" },
  headerTitle:  { fontSize: 17, fontWeight: "700", color: "#111" },
  empty:        { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyEmoji:   { fontSize: 52 },
  emptyTitle:   { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptySub:     { fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 20 },
  requestBtn:   { borderRadius: 14, overflow: "hidden", marginTop: 8, width: "100%" },
  requestGradient: { paddingVertical: 14, alignItems: "center" },
  requestBtnText:  { color: "#fff", fontSize: 15, fontWeight: "700" },
  newRequestBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: "#bbf7d0" },
  newRequestText:{ color: "#16a34a", fontSize: 14, fontWeight: "600" },
  card:         { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: "#F3F4F6" },
  cardTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:   { fontSize: 11, fontWeight: "700" },
  dateText:     { fontSize: 11, color: "#9CA3AF" },
  cardName:     { fontSize: 15, fontWeight: "700", color: "#111" },
  cardLocation: { fontSize: 12, color: "#6B7280" },
  assignedText: { fontSize: 12, color: "#7c3aed", fontWeight: "600" },
  notesBox:     { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  notesLabel:   { fontSize: 11, fontWeight: "700", color: "#374151", marginBottom: 2 },
  notesText:    { fontSize: 12, color: "#6B7280", lineHeight: 18 },
});
