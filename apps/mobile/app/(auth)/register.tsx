// PATH: app/(auth)/register.tsx

import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  DateTimePicker = require("@react-native-community/datetimepicker").default;
}

import { SafeAreaView } from "react-native-safe-area-context";

import { INDIAN_LANGUAGES } from "@/app/language-settings";
import { auth, db, firebaseConfig } from "@/lib/firebase";
import { ensureReferralCode } from "@/lib/initUser";
import { applyReferral } from "@/services/referralService";
import { Ionicons } from "@expo/vector-icons";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, initializeAuth, signInWithPhoneNumber } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

// ─── Restart Education full-screen block ──────────────────────────────────────
// Shown only when user taps Continue and age >= 18

function RestartEducationBlock({
  age,
  onRestart,
}: {
  age: number;
  onRestart: () => void;
}) {
  return (
    <LinearGradient
      colors={["#0a0a1a", "#1a1040", "#0d2a1a"]}
      style={block.container}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={block.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={block.iconCircle}>
          <Text style={block.iconEmoji}>🎓</Text>
        </View>

        <Text style={block.headline}>Welcome!</Text>
        <Text style={block.subhead}>A different learning path awaits you</Text>

        <View style={block.card}>
          <Text style={block.cardTitle}>About this platform</Text>
          <Text style={block.cardBody}>
            GLOOWS365E is designed for current school students in Class 6–12
            (under 18 years of age).{"\n\n"}
            Based on your age ({age} years), you are eligible for our{" "}
            <Text style={block.highlight}>Restart My Education</Text> programme
            — a dedicated space for learners who want to continue their
            education journey after a break.
          </Text>
        </View>

        <View style={block.featuresCard}>
          <Text style={block.featuresTitle}>What Restart My Education offers:</Text>
          {[
            { emoji: "📖", text: "Open Schooling guidance (NIOS & State boards)" },
            { emoji: "🎓", text: "Distance Learning pathways" },
            { emoji: "🛠️", text: "Vocational & skill development options" },
            { emoji: "🤖", text: "Personalised AI Education Advisor" },
            { emoji: "🌟", text: "Real success stories from learners like you" },
            { emoji: "🎯", text: "Education Opportunities & scholarships" },
            { emoji: "🆓", text: "Free personal guidance from our team" },
          ].map((f) => (
            <View key={f.text} style={block.featureRow}>
              <Text style={block.featureEmoji}>{f.emoji}</Text>
              <Text style={block.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={block.ctaBtn}
          onPress={onRestart}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#16a34a", "#15803d"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={block.ctaGradient}
          >
            <Text style={block.ctaText}>Explore Restart My Education →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={block.note}>
          "No dream should stop because of circumstances."
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const block = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { padding: 24, alignItems: "center", paddingBottom: 48, paddingTop: 60 },
  iconCircle:   {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(22,163,74,0.15)",
    borderWidth: 2, borderColor: "rgba(22,163,74,0.4)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  iconEmoji:    { fontSize: 48 },
  headline:     { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 6 },
  subhead:      { color: "#86efac", fontSize: 15, textAlign: "center", marginBottom: 28 },
  card:         {
    width: "100%", backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  cardTitle:    { color: "#a3e635", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  cardBody:     { color: "#d1fae5", fontSize: 14, lineHeight: 22 },
  highlight:    { color: "#4ade80", fontWeight: "700" },
  featuresCard: {
    width: "100%", backgroundColor: "rgba(22,163,74,0.08)",
    borderRadius: 16, padding: 18, marginBottom: 28,
    borderWidth: 1, borderColor: "rgba(22,163,74,0.2)",
  },
  featuresTitle:{ color: "#86efac", fontSize: 13, fontWeight: "700", marginBottom: 12 },
  featureRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  featureEmoji: { fontSize: 18, width: 24 },
  featureText:  { color: "#d1fae5", fontSize: 13, lineHeight: 20, flex: 1 },
  ctaBtn:       { width: "100%", borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  ctaGradient:  { paddingVertical: 18, alignItems: "center" },
  ctaText:      { color: "#fff", fontSize: 17, fontWeight: "800" },
  note:         { color: "rgba(134,239,172,0.6)", fontSize: 12, textAlign: "center", fontStyle: "italic" },
});

// ─── Secondary Firebase app for parent phone OTP ──────────────────────────────

function getPhoneVerifyAuth() {
  const existing = getApps().find((a) => a.name === "phone-verify");
  const app = existing ?? initializeApp(firebaseConfig, "phone-verify");
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    return getAuth(app);
  }
}

// ─── Main registration component ─────────────────────────────────────────────

export default function StudentRegister() {
  const router = useRouter();

  const [name,              setName]              = useState("");
  const [phone,             setPhone]             = useState("");
  const [pincode,           setPincode]           = useState("");
  const [school,            setSchool]            = useState("");
  const [board,             setBoard]             = useState("");
  const [section,           setSection]           = useState("");
  const [studentClass,      setStudentClass]      = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [profilePic,        setProfilePic]        = useState<string | null>(null);

  const [stateVal,  setStateVal]  = useState("");
  const [district,  setDistrict]  = useState("");
  const [area,      setArea]      = useState("");

  const [dob,            setDob]            = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate,   setSelectedDate]   = useState(new Date());

  const [interests,       setInterests]       = useState<string[]>([]);
  const [customInterest,  setCustomInterest]  = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const [referralCode, setReferralCode] = useState("");

  // Restart Education state — shown only after Continue is tapped
  const [showRestartBlock, setShowRestartBlock] = useState(false);
  const [detectedAge,      setDetectedAge]      = useState<number>(0);

  // Parent phone OTP
  const [confirmationResult,  setConfirmResult]       = useState<any>(null);
  const [otp,                 setOtp]                 = useState("");
  const [otpSent,             setOtpSent]             = useState(false);
  const [sendingOtp,          setSendingOtp]          = useState(false);
  const [verifyingOtp,        setVerifyingOtp]        = useState(false);
  const [parentPhoneVerified, setParentPhoneVerified] = useState(false);
  const [otpError,            setOtpError]            = useState("");

  const boards       = ["CBSE", "ICSE", "State Board", "Other"];
  const classOptions = ["6", "7", "8", "9", "10", "11", "12"];

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const calculateAge = (dobString: string): number => {
    const [day, month, year] = dobString.split("/").map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;
    if (
      today.getMonth() < month - 1 ||
      (today.getMonth() === month - 1 && today.getDate() < day)
    ) age--;
    return age;
  };

  const fetchLocation = async (pin: string) => {
    if (pin.length !== 6) return;
    try {
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data[0].Status === "Success") {
        const info = data[0].PostOffice[0];
        setStateVal(info.State);
        setDistrict(info.District);
        setArea(info.Name);
      }
    } catch { /* ignore */ }
  };

  const pickProfilePicture = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled) setProfilePic(result.assets[0].uri);
    } catch { /* ignore */ }
  };

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // DOB change — just store the value, NO age gate here
  const handleDateChange = (event: any, date: any) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      setDob(`${d}/${m}/${date.getFullYear()}`);
    }
  };

  // ── OTP ──────────────────────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setOtpError("Enter a valid 10-digit parent phone number first");
      return;
    }
    setSendingOtp(true);
    setOtpError("");
    try {
      const phoneAuth = getPhoneVerifyAuth();
      const result = await signInWithPhoneNumber(phoneAuth, `+91${phone}`, undefined as any);
      setConfirmResult(result);
      setOtpSent(true);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("TOO_SHORT") || msg.includes("INVALID_PHONE")) {
        setOtpError("Invalid phone number");
      } else if (msg.includes("TOO_MANY_REQUESTS")) {
        setOtpError("Too many attempts. Try again later.");
      } else {
        setOtpError("Failed to send OTP. Please try again.");
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setOtpError("Enter the 6-digit OTP"); return; }
    setVerifyingOtp(true);
    setOtpError("");
    try {
      await confirmationResult.confirm(otp);
      setParentPhoneVerified(true);
      setOtpError("");
    } catch {
      setOtpError("Incorrect OTP. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── Validation (for normal student path only) ─────────────────────────────

  const validate = () => {
    if (!name || !phone || !pincode || !school || !board || !dob || !studentClass || !preferredLanguage) {
      return "Please fill all required fields";
    }
    if (!/^[6-9]\d{9}$/.test(phone))         return "Invalid parent phone number";
    if (!parentPhoneVerified)                  return "Please verify parent phone number";
    if (!/^\d{6}$/.test(pincode))             return "Invalid pincode";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob))  return "Invalid date of birth";
    const age = calculateAge(dob);
    if (age < 5)  return "Age must be at least 5 years";
    return null;
  };

  // ── Continue button handler ───────────────────────────────────────────────
  // Age gate check happens HERE — not on DOB input

  const handleRegister = async () => {
    // 1. Basic DOB check first
    if (!dob || !/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
      setError("Please enter a valid date of birth");
      return;
    }

    // 2. Age gate — if >= 18, show Restart My Education screen
    const age = calculateAge(dob);
    if (age >= 18) {
      setDetectedAge(age);
      setShowRestartBlock(true);
      return;
    }

    // 3. Normal student validation
    const err = validate();
    if (err) { setError(err); return; }

    // 4. Register as student
    try {
      setLoading(true);
      setError("");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const user = auth.currentUser;
      if (!user) { setError("User not logged in. Please login first."); return; }

      const finalInterests = interests.includes("Other")
        ? [...interests.filter((i) => i !== "Other"), customInterest]
        : interests;

      let profilePicUrl = "";
      if (profilePic && profilePic.startsWith("file://")) {
        try {
          const storage    = getStorage();
          const storageRef = ref(storage, `profilePics/${user.uid}/profile-${Date.now()}.jpg`);
          const blob: Blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload  = () => resolve(xhr.response);
            xhr.onerror = () => reject(new Error("Network request failed"));
            xhr.responseType = "blob";
            xhr.open("GET", profilePic, true);
            xhr.send(null);
          });
          await uploadBytes(storageRef, blob);
          profilePicUrl = await getDownloadURL(storageRef);
        } catch { /* continue without pic */ }
      } else if (profilePic) {
        profilePicUrl = profilePic;
      }

      await setDoc(doc(db, "students", user.uid), {
        name, phone, school, board, section,
        class: studentClass, preferredLanguage,
        profilePic: profilePicUrl,
        parentPhone: phone,
        parentPhoneVerified: true,
        dob, age,
        location: { state: stateVal, district, area, pincode },
        interests: finalInterests,
        stats:           { xp: 0, level: 1, coins: 200, streak: 0 },
        learningProfile: { goal: "Improve learning", dailyTarget: 30 },
        onboardingComplete: true,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", user.uid), {
        role: "student", roles: ["student"],
        profileType: "student",
        coins: 200, onboardingComplete: true,
        createdAt: serverTimestamp(),
      }, { merge: true });

      await ensureReferralCode(user.uid);

      if (referralCode.length === 8) {
        try { await applyReferral({ code: referralCode }); } catch { /* non-fatal */ }
      }

      router.replace("/(drawer)/(tabs)/home" as any);
    } catch (e: any) {
      setError(e.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Restart redirect handler ──────────────────────────────────────────────

  const handleRestartRedirect = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          name,
          preferredLanguage,
          dob,
          age: detectedAge,
          profileType:        "restartEducation",
          onboardingComplete: false,
          createdAt:          serverTimestamp(),
        }, { merge: true });
      }
    } catch { /* non-fatal */ }
    router.replace("/restart-education/onboarding" as any);
  };

  // ── Show restart block (after Continue tapped with age >= 18) ─────────────

  if (showRestartBlock) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <RestartEducationBlock
          age={detectedAge}
          onRestart={handleRestartRedirect}
        />
      </SafeAreaView>
    );
  }

  // ── Normal registration form ──────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#020617", "#1E1B4B", "#312E81"]} style={S.container}>
        <StatusBar barStyle="light-content" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={S.brand}>Vidya<Text style={S.gold}>AI</Text></Text>
          <Text style={S.title}>Create Your Profile 🚀</Text>

          {/* Profile picture */}
          <TouchableOpacity style={S.profilePicContainer} onPress={pickProfilePicture}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={S.profilePicPreview} />
            ) : (
              <View style={S.profilePicPlaceholder}>
                <Text style={S.profilePicText}>📸</Text>
                <Text style={S.profilePicLabel}>Add Profile Picture</Text>
              </View>
            )}
          </TouchableOpacity>

          <TextInput
            style={S.input} placeholder="Full Name *"
            placeholderTextColor="#aaa" value={name} onChangeText={setName}
          />

          {/* Parent Phone + OTP */}
          <View style={S.phoneRow}>
            <TextInput
              style={[S.input, S.phoneInput, parentPhoneVerified && S.inputVerified]}
              placeholder="Parent Phone *"
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor="#aaa"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                if (parentPhoneVerified) setParentPhoneVerified(false);
                if (otpSent) setOtpSent(false);
                setConfirmResult(null);
                setOtp(""); setOtpError("");
              }}
              editable={!parentPhoneVerified}
            />
            {parentPhoneVerified ? (
              <View style={S.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#34D399" />
                <Text style={S.verifiedText}>Verified</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[S.otpBtn, sendingOtp && { opacity: 0.6 }]}
                onPress={handleSendOtp}
                disabled={sendingOtp}
              >
                {sendingOtp
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={S.otpBtnText}>{otpSent ? "Resend" : "Send OTP"}</Text>
                }
              </TouchableOpacity>
            )}
          </View>

          {otpSent && !parentPhoneVerified && (
            <View style={S.otpSection}>
              <Text style={S.otpHint}>Enter the 6-digit OTP sent to +91 {phone}</Text>
              <View style={S.otpRow}>
                <TextInput
                  style={[S.input, S.otpInput]}
                  placeholder="6-digit OTP"
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor="#aaa"
                  value={otp}
                  onChangeText={setOtp}
                />
                <TouchableOpacity
                  style={[S.otpBtn, S.verifyBtn, verifyingOtp && { opacity: 0.6 }]}
                  onPress={handleVerifyOtp}
                  disabled={verifyingOtp}
                >
                  {verifyingOtp
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={S.otpBtnText}>Verify</Text>
                  }
                </TouchableOpacity>
              </View>
              {otpError ? <Text style={S.otpError}>{otpError}</Text> : null}
            </View>
          )}
          {otpError && !otpSent ? <Text style={S.otpError}>{otpError}</Text> : null}

          {/* Pincode */}
          <TextInput
            style={S.input}
            placeholder="Pincode *"
            keyboardType="number-pad"
            maxLength={6}
            placeholderTextColor="#aaa"
            value={pincode}
            onChangeText={(text) => { setPincode(text); fetchLocation(text); }}
          />
          {stateVal ? <Text style={S.auto}>📍 {area}, {district}, {stateVal}</Text> : null}

          <TextInput
            style={S.input} placeholder="School Name *"
            placeholderTextColor="#aaa" value={school} onChangeText={setSchool}
          />

          {/* Date of birth — just stores value, no age check here */}
          {Platform.OS === "web" ? (
            <TextInput
              style={S.input}
              placeholder="Date of Birth * (DD/MM/YYYY)"
              placeholderTextColor="#aaa"
              value={dob}
              onChangeText={(text) => {
                let digits    = text.replace(/\D/g, "");
                let formatted = digits;
                if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
                if (digits.length > 4) formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
                setDob(formatted);
              }}
              maxLength={10}
              keyboardType="numeric"
            />
          ) : (
            <>
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <View style={S.input}>
                  <Text style={{ color: dob ? "#fff" : "#aaa" }}>
                    {dob || "Date of Birth * (DD/MM/YYYY)"}
                  </Text>
                </View>
              </TouchableOpacity>
              {showDatePicker && DateTimePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  textColor="#fff"
                />
              )}
              {Platform.OS === "ios" && showDatePicker && (
                <TouchableOpacity
                  style={S.closeDatePicker}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={S.closeDatePickerText}>Done</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Board */}
          <Text style={S.label}>Board *</Text>
          <View style={S.row}>
            {boards.map((b) => (
              <TouchableOpacity
                key={b} style={[S.chip, board === b && S.active]}
                onPress={() => setBoard(b)}
              >
                <Text style={S.chipText}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Class */}
          <Text style={S.label}>Class *</Text>
          <View style={S.row}>
            {classOptions.map((c) => (
              <TouchableOpacity
                key={c} style={[S.chip, studentClass === c && S.active]}
                onPress={() => setStudentClass(c)}
              >
                <Text style={S.chipText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Language */}
          <Text style={S.label}>Preferred Language *</Text>
          <View style={S.row}>
            {INDIAN_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.name}
                style={[S.chip, S.langChip, preferredLanguage === lang.name && S.active]}
                onPress={() => setPreferredLanguage(lang.name)}
              >
                <Text style={S.langNative}>{lang.native}</Text>
                <Text style={S.chipText}>{lang.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Interests */}
          <Text style={S.label}>Interests</Text>
          <View style={S.row}>
            {["Maths","Science","Coding","AI","Robotics","Cricket","Football","Art","Music","GK","Other"].map((i) => (
              <TouchableOpacity
                key={i} style={[S.chip, interests.includes(i) && S.active]}
                onPress={() => toggleInterest(i)}
              >
                <Text style={S.chipText}>{i}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {interests.includes("Other") && (
            <TextInput
              placeholder="Enter your interest"
              placeholderTextColor="#aaa"
              style={S.input}
              value={customInterest}
              onChangeText={setCustomInterest}
            />
          )}

          {/* Referral code */}
          <Text style={S.label}>Referral Code (optional)</Text>
          <View style={S.referralRow}>
            <Ionicons name="gift-outline" size={18} color="#a78bfa" style={S.referralIcon} />
            <TextInput
              style={[S.input, S.referralInput]}
              placeholder="Enter friend's referral code"
              placeholderTextColor="#6b7280"
              value={referralCode}
              onChangeText={(t) => setReferralCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>
          {referralCode.length > 0 && referralCode.length < 8 && (
            <Text style={S.referralHint}>Code must be 8 characters</Text>
          )}
          {referralCode.length === 8 && (
            <Text style={S.referralValid}>✓ Code looks good! You'll get a welcome bonus.</Text>
          )}

          {error ? <Text style={S.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[S.button, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={S.buttonInner}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.buttonText}>Continue →</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {!parentPhoneVerified && (
            <Text style={S.verifyNote}>
              * Verify parent phone to enable registration
            </Text>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container:    { flex: 1 },
  scrollContent:{ padding: 20, maxWidth: 600, width: "100%", alignSelf: "center", paddingBottom: 40 },
  brand:        { fontSize: 34, fontWeight: "900", color: "#fff", textAlign: "center" },
  gold:         { color: "#FFD700" },
  title:        { fontSize: 20, color: "#c7d2fe", textAlign: "center", marginBottom: 20 },
  profilePicContainer:  { marginBottom: 20, borderRadius: 14, overflow: "hidden", height: 140 },
  profilePicPreview:    { width: "100%", height: "100%", borderRadius: 14 },
  profilePicPlaceholder:{ width: "100%", height: "100%", backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center", alignItems: "center", borderWidth: 2, borderStyle: "dashed", borderColor: "#555", borderRadius: 14 },
  profilePicText:       { fontSize: 48, marginBottom: 8 },
  profilePicLabel:      { color: "#aaa", fontSize: 12 },
  input:         { backgroundColor: "rgba(255,255,255,0.06)", padding: 14, borderRadius: 14, marginBottom: 12, color: "#fff" },
  inputVerified: { borderWidth: 1, borderColor: "#34D399" },
  phoneRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  phoneInput:    { flex: 1, marginBottom: 0 },
  otpBtn:        { backgroundColor: "#6366F1", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  verifyBtn:     { backgroundColor: "#059669" },
  otpBtnText:    { color: "#fff", fontWeight: "700", fontSize: 13 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText:  { color: "#34D399", fontWeight: "700", fontSize: 13 },
  otpSection:    { marginBottom: 12 },
  otpHint:       { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  otpRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  otpInput:      { flex: 1, marginBottom: 0 },
  otpError:      { color: "#F87171", fontSize: 12, marginBottom: 8 },
  auto:          { color: "#34D399", marginBottom: 10 },
  label:         { color: "#c7d2fe", marginTop: 10, marginBottom: 6 },
  row:           { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#555" },
  langChip:      { flexDirection: "column", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
  langNative:    { color: "#c7d2fe", fontSize: 13, fontWeight: "700" },
  active:        { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  chipText:      { color: "#fff", fontSize: 12 },
  referralRow:   { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  referralIcon:  { position: "absolute", left: 14, zIndex: 1, top: 14 },
  referralInput: { flex: 1, paddingLeft: 40, letterSpacing: 2, fontWeight: "700" },
  referralHint:  { color: "#94a3b8", fontSize: 11, marginBottom: 8 },
  referralValid: { color: "#34D399", fontSize: 11, marginBottom: 8 },
  error:         { color: "#F87171", marginTop: 10, textAlign: "center" },
  verifyNote:    { color: "#64748b", fontSize: 11, textAlign: "center", marginTop: 8 },
  button:        { marginTop: 20, borderRadius: 30, overflow: "hidden" },
  buttonInner:   { paddingVertical: 16, alignItems: "center" },
  buttonText:    { color: "#fff", fontWeight: "700", fontSize: 16 },
  closeDatePicker:     { backgroundColor: "#6366F1", paddingVertical: 12, borderRadius: 10, marginTop: 10, alignItems: "center" },
  closeDatePickerText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
