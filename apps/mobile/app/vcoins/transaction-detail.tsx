// app/vcoins/transaction-detail.tsx

import {
  formatVCoins,
  formatTransactionDate,
  getTransactionColor,
  getVCoinsSourceIcon,
  getVCoinsSourceIconBg,
  getVCoinsSourceIconColor,
  getVCoinsSourceLabel,
  getStatusColor,
} from "@/utils/formatVCoins";
import { VCoinTransaction } from "@/services/vCoinsService";
import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function VCoinsTransactionDetailScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();

  const [tx, setTx]           = useState<VCoinTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !id) { setLoading(false); return; }

    getDoc(doc(db, "users", uid, "vCoinTransactions", id))
      .then((snap) => {
        if (snap.exists()) {
          setTx({ id: snap.id, ...snap.data() } as VCoinTransaction);
        } else {
          setError("Transaction not found");
        }
      })
      .catch(() => setError("Failed to load transaction"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (error || !tx) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error ?? "Transaction not found"}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const amountColor = getTransactionColor(tx.type, tx.status);
  const iconName    = getVCoinsSourceIcon(tx.source) as any;
  const iconBg      = getVCoinsSourceIconBg(tx.source);
  const iconColor   = getVCoinsSourceIconColor(tx.source);
  const statusColor = getStatusColor(tx.status);
  const prefix      = tx.type === "CREDIT" ? "+" : "-";
  const sourceLabel = getVCoinsSourceLabel(tx.source);

  const usefulMeta = Object.entries(tx.metadata ?? {}).filter(
    ([k]) => !["uid", "source"].includes(k)
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Transaction Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* Amount hero */}
        <View style={styles.heroCard}>
          <View style={[styles.heroIcon, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={28} color={iconColor} />
          </View>
          <Text style={[styles.heroAmount, { color: amountColor }]}>
            {prefix}{formatVCoins(tx.amount)} V-Coins
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: tx.type === "CREDIT" ? "#D1FAE5" : "#FEE2E2" }]}>
            <Text style={[styles.typeBadgeText, { color: tx.type === "CREDIT" ? "#065F46" : "#991B1B" }]}>
              {tx.type}
            </Text>
          </View>
        </View>

        {/* Detail rows */}
        <View style={styles.card}>
          <DetailRow label="Source"      value={sourceLabel} />
          <DetailRow label="Status"      value={tx.status} valueColor={statusColor} />
          <DetailRow label="Title"       value={tx.title} />
          {tx.description ? <DetailRow label="Description" value={tx.description} /> : null}
          <DetailRow label="Date"        value={formatTransactionDate(tx.createdAt)} />
          {tx.referenceId ? <DetailRow label="Reference ID" value={tx.referenceId} mono /> : null}
        </View>

        {/* Metadata */}
        {usefulMeta.length > 0 && (
          <>
            <Text style={styles.metaHeader}>Additional Info</Text>
            <View style={styles.card}>
              {usefulMeta.map(([k, v]) => (
                <DetailRow key={k} label={k} value={String(v)} mono />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  valueColor,
  mono,
}: {
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          valueColor ? { color: valueColor, fontWeight: "700" } : null,
          mono ? styles.mono : null,
        ]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#F9FAFB" },
  centered:{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn:     { width: 36, alignItems: "flex-start" },
  screenTitle: { fontSize: 17, fontWeight: "700", color: "#111" },

  content: { padding: 16, gap: 12 },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  heroIcon:   { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  heroAmount: { fontSize: 32, fontWeight: "800" },
  typeBadge:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  typeBadgeText: { fontSize: 12, fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: "#6B7280", flex: 1 },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#111", flex: 2, textAlign: "right" },
  mono:        { fontFamily: "monospace", fontSize: 11 },

  metaHeader: { fontSize: 13, fontWeight: "700", color: "#6B7280", marginTop: 4 },

  errorText:    { fontSize: 15, color: "#374151", textAlign: "center" },
  backLink:     { marginTop: 8 },
  backLinkText: { fontSize: 14, color: "#7C3AED", fontWeight: "600" },
});
