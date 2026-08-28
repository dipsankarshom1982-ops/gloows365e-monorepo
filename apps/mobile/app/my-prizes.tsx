// PATH: app/my-prizes.tsx
// Student-facing view of VidyaStar Starboard prizes — each prizeClaims doc
// is created by the admin's Starboard Payouts screen when a prize is
// awarded (see apps/admin/src/pages/StarboardPayouts.tsx). VCoins prizes
// are auto-credited and just show up here as a receipt; gift_voucher and
// physical prizes need the student to submit delivery details before
// admin can ship them (see PrizeDeliveries.tsx on the admin side).

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/header";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { auth, db } from "@/lib/firebase";

type PrizeStatus = "auto_credited" | "unclaimed" | "claimed" | "shipped" | "delivered";

interface ClaimInfo {
  name: string;
  address: string;
  whatsapp: string;
  email: string;
  claimedAt?: any;
}

interface DeliveryInfo {
  courierName?: string;
  trackingId?: string;
  shippedAt?: any;
  deliveredAt?: any;
}

interface PrizeClaim {
  id: string;
  uid: string;
  prizeType: "gift_voucher" | "physical" | "vcoin";
  prizeValue: string;
  medalEmoji?: string;
  rank: number;
  periodType: string;
  periodKey: string;
  payoutLabel: string;
  wonAt?: { toDate?: () => Date };
  status: PrizeStatus;
  claimInfo?: ClaimInfo;
  deliveryInfo?: DeliveryInfo;
  // "YYYY-MM-DD" — admin-set once they've reviewed the claim, shown below
  // regardless of whether it's shipped yet. See PrizeDeliveries.tsx.
  expectedDeliveryDate?: string;
}

const STATUS_CFG: Record<PrizeStatus, { label: string; color: string; bg: string }> = {
  auto_credited: { label: "Credited to V-Coins", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  unclaimed:     { label: "Claim Now",            color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  claimed:       { label: "Claimed",               color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  shipped:       { label: "Shipped",               color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
  delivered:     { label: "Delivered",             color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

function formatExpectedDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// "🎁 Surprise Gift" for the V-Coins reward, "Rank #N · Monthly" for a
// Starboard placement — a bare "Rank #0" would be meaningless for a gift
// that was never about a leaderboard position.
function prizeMetaLine(p: PrizeClaim): string {
  return p.periodType === "surprise_gift"
    ? `🎁 Surprise Gift · ${formatDate(p.wonAt)}`
    : `Rank #${p.rank} · ${p.periodType.charAt(0).toUpperCase() + p.periodType.slice(1)} · ${formatDate(p.wonAt)}`;
}

function formatDate(ts?: { toDate?: () => Date }): string {
  return ts?.toDate ? ts.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

// ─── Currently-winning preview — same rank→prize matching admin's
// Starboard Payouts screen uses (prizeRowForRank in
// apps/admin/src/pages/StarboardPayouts.tsx) and the Starboard screen
// itself. Only monthly/yearly periods carry real prizes (see Starboard's
// isPrizeTab) — this is a live, provisional preview of what a student
// would win if the period ended right now; the actual prizeClaims doc
// above only appears once admin runs the payout at period end.
type PeriodTab = "monthly" | "yearly";
const PRIZE_TABS: PeriodTab[] = ["monthly", "yearly"];
type PrizeType = "gift_voucher" | "physical" | "vcoin";
interface PrizeRow { rankMin: number; rankMax: number; prizeType: PrizeType; prizeValue: string; medalEmoji: string; badge: string; }

const pad = (n: number) => String(n).padStart(2, "0");
function currentPeriodKey(type: PeriodTab): string {
  const d = new Date();
  if (type === "monthly") return `monthly_${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return `yearly_${d.getFullYear()}`;
}
function prizeRowForRank(rows: PrizeRow[], rank: number): PrizeRow | null {
  return rows.find((r) => rank >= r.rankMin && rank <= r.rankMax) ?? null;
}
function formatPrizeReward(row: PrizeRow): string {
  return row.prizeType === "vcoin" ? `${row.prizeValue} V-Coins` : row.prizeValue;
}

interface CurrentStanding { tab: PeriodTab; rank: number; prizeRow: PrizeRow; }

// One-shot (not live-ticking) — this is a supplementary preview, not the
// primary Starboard ranking view, so a snapshot on screen load is enough.
function useCurrentStandings(uid: string, userClass: string | null): CurrentStanding[] | null {
  const [standings, setStandings] = useState<CurrentStanding[] | null>(null);
  useEffect(() => {
    if (!uid) { setStandings([]); return; }
    let cancelled = false;
    (async () => {
      const results: CurrentStanding[] = [];
      for (const tab of PRIZE_TABS) {
        try {
          const col = collection(db, "leaderboard", tab, "entries");
          const q = userClass
            ? query(col, where("class", "==", userClass), orderBy("points", "desc"), limit(100))
            : query(col, orderBy("points", "desc"), limit(100));
          const [entriesSnap, configSnap] = await Promise.all([
            getDocs(q),
            getDoc(doc(db, "vidyastarConfig", currentPeriodKey(tab))),
          ]);
          const rank = entriesSnap.docs.findIndex((d) => d.id === uid) + 1;
          if (rank <= 0) continue;
          const rows = (configSnap.exists() ? (configSnap.data()?.prizeRows ?? []) : []) as PrizeRow[];
          const prizeRow = prizeRowForRank(rows, rank);
          if (prizeRow) results.push({ tab, rank, prizeRow });
        } catch { /* skip this tab on error, don't block the others */ }
      }
      if (!cancelled) setStandings(results);
    })();
    return () => { cancelled = true; };
  }, [uid, userClass]);
  return standings;
}

export default function MyPrizesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { studentProfile } = useStudentProfile();
  const uid = auth.currentUser?.uid ?? "";
  const userClass = studentProfile?.class != null ? String(studentProfile.class) : null;
  const standings = useCurrentStandings(uid, userClass);

  const [prizes, setPrizes]   = useState<PrizeClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const [claiming, setClaiming] = useState<PrizeClaim | null>(null);
  const [name, setName]         = useState("");
  const [address, setAddress]   = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, "prizeClaims"), where("uid", "==", uid), orderBy("wonAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPrizes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrizeClaim)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  const openClaim = (prize: PrizeClaim) => {
    setClaiming(prize);
    setName(studentProfile?.name ?? "");
    setAddress("");
    setWhatsapp(studentProfile?.phone ?? "");
    setEmail(studentProfile?.email ?? auth.currentUser?.email ?? "");
  };

  const submitClaim = async () => {
    if (!claiming) return;
    if (!name.trim() || !address.trim() || !whatsapp.trim() || !email.trim()) {
      Alert.alert("Missing details", "Please fill in your name, address, WhatsApp number, and email.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(whatsapp.trim())) {
      Alert.alert("Invalid number", "Enter a valid 10-digit WhatsApp number.");
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "prizeClaims", claiming.id), {
        status: "claimed",
        claimInfo: {
          name: name.trim(),
          address: address.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim().toLowerCase(),
          claimedAt: serverTimestamp(),
        },
      });
      setClaiming(null);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Couldn't submit your claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu={true} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <Text style={[styles.title, { color: colors.accent }]}>🏆 My Prizes</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Prizes you've won on the VidyaStar Starboard
          </Text>
        </View>

        {standings && standings.length > 0 && (
          <View style={styles.standingsWrap}>
            <Text style={[styles.standingsHeading, { color: colors.textSecondary }]}>🔮 Currently Winning</Text>
            {standings.map((s) => (
              <View key={s.tab} style={styles.standingCard}>
                <Text style={{ fontSize: 22 }}>{s.prizeRow.medalEmoji || "🎁"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.standingPrize, { color: colors.text }]}>
                    {s.prizeRow.prizeType === "vcoin" ? `🪙 ${formatPrizeReward(s.prizeRow)}` : formatPrizeReward(s.prizeRow)}
                  </Text>
                  <Text style={[styles.standingMeta, { color: colors.textSecondary }]}>
                    Rank #{s.rank} · {s.tab.charAt(0).toUpperCase() + s.tab.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
            <Text style={[styles.standingsNote, { color: colors.textSecondary }]}>
              * Based on your current rank — confirmed once the period ends and admin pays out.
            </Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : prizes.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎁</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No prizes yet — climb the Starboard leaderboard to start winning!
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {prizes.map((p) => {
              const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.unclaimed;
              return (
                <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.medal}>{p.medalEmoji ?? "🎁"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.prizeValue, { color: colors.text }]}>{p.prizeType === "vcoin" ? `🪙 ${p.prizeValue} V-Coins` : p.prizeValue}</Text>
                      <Text style={[styles.prizeMeta, { color: colors.textSecondary }]}>
                        {prizeMetaLine(p)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>

                  {p.status === "unclaimed" && (
                    <TouchableOpacity
                      style={[styles.claimBtn, { backgroundColor: colors.accent }]}
                      onPress={() => openClaim(p)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="gift-outline" size={16} color="#fff" />
                      <Text style={styles.claimBtnText}>Claim Prize</Text>
                    </TouchableOpacity>
                  )}

                  {(p.status === "claimed" || p.status === "shipped" || p.status === "delivered") && p.claimInfo && (
                    <View style={[styles.infoBox, { borderColor: colors.border }]}>
                      <Text style={[styles.infoLine, { color: colors.textSecondary }]}>📍 Delivering to: {p.claimInfo.name}, {p.claimInfo.address}</Text>
                      <Text style={[styles.infoLine, { color: colors.textSecondary }]}>📱 {p.claimInfo.whatsapp} · ✉️ {p.claimInfo.email}</Text>
                      {p.status !== "delivered" && p.expectedDeliveryDate && (
                        <Text style={[styles.infoLine, { color: "#f59e0b", fontWeight: "700", marginTop: 2 }]}>
                          📅 Expected to reach you by {formatExpectedDate(p.expectedDeliveryDate)}
                        </Text>
                      )}
                    </View>
                  )}

                  {(p.status === "shipped" || p.status === "delivered") && p.deliveryInfo?.trackingId && (
                    <View style={[styles.infoBox, { borderColor: colors.border, marginTop: 6 }]}>
                      <Text style={[styles.infoLine, { color: colors.text, fontWeight: "700" }]}>
                        🚚 {p.deliveryInfo.courierName ?? "Courier"} — {p.deliveryInfo.trackingId}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Claim form */}
      <Modal visible={!!claiming} transparent animationType="slide" onRequestClose={() => setClaiming(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Claim your prize</Text>
              <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                {claiming?.prizeType === "physical" ? "We'll ship this to your address." : "We'll email/deliver your voucher using these details."}
              </Text>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Full Name</Text>
              <TextInput
                value={name} onChangeText={setName}
                placeholder="Your full name" placeholderTextColor="#888"
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Delivery Address</Text>
              <TextInput
                value={address} onChangeText={setAddress}
                placeholder="House no., street, city, state, pincode" placeholderTextColor="#888"
                multiline numberOfLines={3}
                style={[styles.input, styles.inputMultiline, { color: colors.text, borderColor: colors.border }]}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WhatsApp Number</Text>
              <TextInput
                value={whatsapp} onChangeText={setWhatsapp}
                placeholder="10-digit mobile number" placeholderTextColor="#888"
                keyboardType="phone-pad" maxLength={10}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email ID</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="you@example.com" placeholderTextColor="#888"
                keyboardType="email-address" autoCapitalize="none"
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 }]}
                onPress={submitClaim}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Claim</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setClaiming(null)} disabled={submitting}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  pageHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: "500" },

  standingsWrap: { paddingHorizontal: 20, marginBottom: 8 },
  standingsHeading: { fontSize: 13, fontWeight: "800", marginBottom: 8 },
  standingCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(251,191,36,0.1)", borderWidth: 1, borderColor: "rgba(251,191,36,0.3)", borderRadius: 12, padding: 12, marginBottom: 8 },
  standingPrize: { fontSize: 13, fontWeight: "800" },
  standingMeta: { fontSize: 11, marginTop: 2 },
  standingsNote: { fontSize: 10, marginTop: 2 },

  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  list: { paddingHorizontal: 20, gap: 12, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  medal: { fontSize: 30 },
  prizeValue: { fontSize: 15, fontWeight: "800" },
  prizeMeta: { fontSize: 12, fontWeight: "500", marginTop: 2 },

  statusBadge: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: "800" },

  claimBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 11 },
  claimBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  infoBox: { borderTopWidth: 1, paddingTop: 8, gap: 3 },
  infoLine: { fontSize: 12, lineHeight: 17 },

  backBtn: { marginHorizontal: 20, marginTop: 24, paddingVertical: 14, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  backBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: "85%" },
  modalTitle: { fontSize: 19, fontWeight: "800", marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 18, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  submitBtn: { marginTop: 22, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  cancelBtn: { marginTop: 12, alignItems: "center", paddingVertical: 8 },
  cancelBtnText: { fontSize: 13, fontWeight: "600" },
});
