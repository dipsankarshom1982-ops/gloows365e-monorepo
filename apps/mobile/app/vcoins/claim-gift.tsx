// PATH: app/vcoins/claim-gift.tsx
// New screen: users can claim their surprise gift by providing postal address.
// Gift data is on users/{uid}.surpriseGift

import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

interface SurpriseGift {
  available: boolean;
  year: number;
  claimed: boolean;
  giftDescription?: string;
  claimedAt?: any;
  deliveryAddress?: PostalAddress;
}

interface PostalAddress {
  fullName:    string;
  phone:       string;
  addressLine1: string;
  addressLine2: string;
  city:        string;
  state:       string;
  pincode:     string;
}

export default function ClaimGiftScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [gift, setGift]         = useState<SurpriseGift | null>(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [address, setAddress] = useState<PostalAddress>({
    fullName: "", phone: "", addressLine1: "",
    addressLine2: "", city: "", state: "", pincode: "",
  });

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const d = snap.data();
      const g = d.surpriseGift as SurpriseGift | undefined;
      setGift(g || null);

      // Pre-fill address if already submitted
      if (g?.deliveryAddress) setAddress(g.deliveryAddress);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleClaim = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Validation
    if (!address.fullName.trim() || !address.phone.trim() || !address.addressLine1.trim() ||
        !address.city.trim() || !address.state.trim() || !address.pincode.trim()) {
      Alert.alert("Missing Info", "Please fill in all required fields.");
      return;
    }
    if (!/^\d{10}$/.test(address.phone.trim())) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!/^\d{6}$/.test(address.pincode.trim())) {
      Alert.alert("Invalid Pincode", "Please enter a valid 6-digit pincode.");
      return;
    }

    setSubmitting(true);
    try {
      await updateDoc(doc(db, "users", uid), {
        "surpriseGift.claimed":         true,
        "surpriseGift.claimedAt":       new Date(),
        "surpriseGift.deliveryAddress": address,
      });
      Alert.alert(
        "🎉 Gift Claimed!",
        "Your surprise gift has been claimed. We'll deliver it to your address shortly!",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert("Error", "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#D97706" />
      </View>
    );
  }

  if (!gift?.available) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Surprise Gift</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>🎁</Text>
          <Text style={styles.noGiftText}>No gift available at the moment.</Text>
          <Text style={styles.noGiftSub}>Keep earning V-Coins to unlock rewards!</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Claim Your Gift</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {/* Gift Banner */}
          <LinearGradient
            colors={["#d97706", "#f59e0b", "#fbbf24"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.giftBanner}
          >
            <Text style={styles.giftEmoji}>🎁</Text>
            <Text style={styles.giftTitle}>Surprise Gift!</Text>
            {gift.giftDescription ? (
              <Text style={styles.giftDesc}>{gift.giftDescription}</Text>
            ) : (
              <Text style={styles.giftDesc}>You've earned a special reward for {gift.year}!</Text>
            )}
            {gift.claimed && (
              <View style={styles.claimedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.claimedText}>Already Claimed</Text>
              </View>
            )}
          </LinearGradient>

          {/* Address Form */}
          {!gift.claimed ? (
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>📦 Delivery Address</Text>
              <Text style={styles.formSub}>Enter your address and we'll ship your gift right away!</Text>

              <Field label="Full Name *" value={address.fullName}
                onChangeText={(v) => setAddress((a) => ({ ...a, fullName: v }))}
                placeholder="Enter your full name" />

              <Field label="Mobile Number *" value={address.phone}
                onChangeText={(v) => setAddress((a) => ({ ...a, phone: v }))}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad" />

              <Field label="Address Line 1 *" value={address.addressLine1}
                onChangeText={(v) => setAddress((a) => ({ ...a, addressLine1: v }))}
                placeholder="House No., Street, Area" />

              <Field label="Address Line 2" value={address.addressLine2}
                onChangeText={(v) => setAddress((a) => ({ ...a, addressLine2: v }))}
                placeholder="Landmark, Colony (optional)" />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field label="City *" value={address.city}
                    onChangeText={(v) => setAddress((a) => ({ ...a, city: v }))}
                    placeholder="City" />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Field label="Pincode *" value={address.pincode}
                    onChangeText={(v) => setAddress((a) => ({ ...a, pincode: v }))}
                    placeholder="6-digit pincode"
                    keyboardType="numeric" />
                </View>
              </View>

              <Field label="State *" value={address.state}
                onChangeText={(v) => setAddress((a) => ({ ...a, state: v }))}
                placeholder="State" />

              <TouchableOpacity
                style={[styles.claimBtn, submitting && styles.claimBtnDisabled]}
                onPress={handleClaim}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="gift-outline" size={20} color="#fff" />
                    <Text style={styles.claimBtnText}>Claim My Gift</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* Already claimed — show address */
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>✅ Delivery Address Submitted</Text>
              <View style={styles.addressPreview}>
                <Text style={styles.addrLine}>{address.fullName}</Text>
                <Text style={styles.addrLine}>{address.phone}</Text>
                <Text style={styles.addrLine}>{address.addressLine1}</Text>
                {!!address.addressLine2 && <Text style={styles.addrLine}>{address.addressLine2}</Text>}
                <Text style={styles.addrLine}>{address.city}, {address.pincode}</Text>
                <Text style={styles.addrLine}>{address.state}</Text>
              </View>
              <Text style={styles.deliveryNote}>
                🚚 Your gift is being processed and will be delivered soon!
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || "default"}
        style={styles.fieldInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: "#F9FAFB" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  backBtn:     { width: 36, alignItems: "flex-start" },
  screenTitle: { fontSize: 17, fontWeight: "700", color: "#111" },

  giftBanner: {
    margin: 16, borderRadius: 20, padding: 24, alignItems: "center", gap: 6,
  },
  giftEmoji:  { fontSize: 52 },
  giftTitle:  { color: "#fff", fontSize: 22, fontWeight: "800" },
  giftDesc:   { color: "rgba(255,255,255,0.9)", fontSize: 14, textAlign: "center" },
  claimedBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 4,
  },
  claimedText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  formSection: {
    marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 20, padding: 20,
  },
  formTitle:  { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 4 },
  formSub:    { fontSize: 13, color: "#6B7280", marginBottom: 16 },

  fieldWrap:  { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: "#111", backgroundColor: "#F9FAFB",
  },
  row: { flexDirection: "row" },

  claimBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#D97706", borderRadius: 14, paddingVertical: 14, marginTop: 8,
  },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  addressPreview: {
    backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16,
    marginVertical: 12, borderWidth: 1, borderColor: "#E5E7EB",
  },
  addrLine:     { fontSize: 14, color: "#374151", fontWeight: "500", marginBottom: 2 },
  deliveryNote: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 8 },

  noGiftText: { fontSize: 18, fontWeight: "700", color: "#374151" },
  noGiftSub:  { fontSize: 13, color: "#9CA3AF" },
});
