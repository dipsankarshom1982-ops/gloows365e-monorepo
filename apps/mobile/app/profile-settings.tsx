import { INDIAN_LANGUAGES } from "@/app/language-settings";
import Header from "@/components/header";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { auth, db, firebaseConfig, storage } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getApps, initializeApp } from "firebase/app";
import { ConfirmationResult, deleteUser, getAuth, initializeAuth, inMemoryPersistence, signInWithPhoneNumber, User } from "firebase/auth";
import { deleteDoc, doc, DocumentData, getDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Constants ─────────────────────────────────────────────
const CLASS_OPTIONS: string[] = ["4", "6", "7", "8", "9", "10", "11", "12"];
const BOARDS: string[] = ["CBSE", "ICSE", "State Board", "IB", "IGCSE"];
const INTEREST_OPTIONS: string[] = ["GK", "Science", "Math", "History", "Geography", "English", "Coding", "Arts"];

// ─── Types ─────────────────────────────────────────────────
type IconName = React.ComponentProps<typeof Ionicons>["name"];
type KeyboardType = "default" | "numeric" | "email-address" | "phone-pad";
type AutoCapitalize = "none" | "sentences" | "words" | "characters";

interface StudentLocation { area?: string; city?: string; district: string; pincode: string; state: string; }

interface StudentData extends DocumentData {
  name?: string; phone?: string; school?: string; class?: string | number;
  board?: string; age?: number; dob?: string; preferredLanguage?: string;
  profilePic?: string; interests?: string[]; location?: StudentLocation; updatedAt?: string;
}

interface ThemeColors {
  accent: string; card: string; border: string;
  text: string; textSecondary: string; background: string;
}

interface SectionTitleProps { icon: string; label: string; colors: ThemeColors; }
interface FieldProps {
  label: string; icon: IconName; value: string;
  onChangeText: (text: string) => void; placeholder: string;
  keyboardType?: KeyboardType; autoCapitalize?: AutoCapitalize;
  isEditing: boolean; colors: ThemeColors;
}
interface ChipRowProps {
  label: string; options: string[]; selected: string[];
  onToggle: (opt: string) => void; isEditing: boolean; colors: ThemeColors;
}

// ─── Sub-components (outside to prevent keyboard dismissal on re-render) ──
const SectionTitle = ({ icon, label, colors }: SectionTitleProps) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionIcon}>{icon}</Text>
    <Text style={[styles.sectionLabel, { color: colors.accent }]}>{label}</Text>
  </View>
);

const Field = ({
  label, icon, value, onChangeText, placeholder,
  keyboardType = "default", autoCapitalize = "words", isEditing, colors,
}: FieldProps) => (
  <View style={styles.fieldWrapper}>
    <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: isEditing ? colors.accent : colors.border }]}>
      <Ionicons name={icon} size={17} color={isEditing ? colors.accent : colors.textSecondary} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={isEditing}
      />
      {!isEditing && <Ionicons name="lock-closed-outline" size={13} color={colors.border} />}
    </View>
  </View>
);

const ChipRow = ({ label, options, selected, onToggle, isEditing, colors }: ChipRowProps) => (
  <View style={styles.fieldWrapper}>
    <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onToggle(opt)}
            style={[styles.chip, {
              backgroundColor: active ? colors.accent : colors.card,
              borderColor: active ? colors.accent : colors.border,
              opacity: !isEditing && !active ? 0.4 : 1,
            }]}
          >
            <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// ─── Secondary Firebase app for phone OTP (doesn't touch main auth session) ──
function getPhoneVerifyAuth() {
  const existing = getApps().find((a) => a.name === "phone-verify");
  const app = existing ?? initializeApp(firebaseConfig, "phone-verify");
  try { return initializeAuth(app, { persistence: inMemoryPersistence }); }
  catch { return getAuth(app); }
}

// ─── Main Component ─────────────────────────────────────────
export default function ProfileSettingsScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const router = useRouter();

  // ─── UI State ───────────────────────────────────────────
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [isEditing,       setIsEditing]       = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [isUploadingPhoto,setIsUploadingPhoto]= useState(false);

  // ─── Form State ─────────────────────────────────────────
  const [name,             setName]             = useState("");
  const [phone,            setPhone]            = useState("");
  const [school,           setSchool]           = useState("");
  const [studentClass,     setStudentClass]     = useState("");
  const [board,            setBoard]            = useState("");
  const [age,              setAge]              = useState("");
  const [dob,              setDob]              = useState("");
  const [preferredLanguage,setPreferredLanguage]= useState("");
  const [profilePic,       setProfilePic]       = useState("");
  const [localImage,       setLocalImage]       = useState<string | null>(null);
  const [interests,        setInterests]        = useState<string[]>([]);
  const [area,             setArea]             = useState("");
  const [district,         setDistrict]         = useState("");
  const [pincode,          setPincode]          = useState("");
  const [stateVal,         setStateVal]         = useState("");
  const [pincodeLoading,   setPincodeLoading]   = useState(false);
  const [original,         setOriginal]         = useState<StudentData | null>(null);

  // ─── Phone OTP State ────────────────────────────────────
  const [phoneVerified,     setPhoneVerified]     = useState(false);
  const [otpSent,           setOtpSent]           = useState(false);
  const [otpValue,          setOtpValue]          = useState("");
  const [sendingOtp,        setSendingOtp]        = useState(false);
  const [verifyingOtp,      setVerifyingOtp]      = useState(false);
  const [confirmationResult,setConfirmationResult]= useState<ConfirmationResult | null>(null);
  // expo-firebase-recaptcha removed — not compatible with Firebase SDK v12
  const recaptchaVerifier = { current: null };

  const originalPhone = original?.phone ?? "";
  const phoneDirty    = phone.trim() !== originalPhone.trim();

  // ─── Fetch profile ───────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) { Alert.alert("Error", "No user logged in."); router.back(); return; }
        const snap = await getDoc(doc(db, "students", uid));
        if (!snap.exists()) { Alert.alert("Error", "Profile not found."); return; }
        const d = snap.data() as StudentData;
        populateState(d);
        setOriginal(d);
      } catch (e: unknown) {
        Alert.alert("Error", e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const populateState = (d: StudentData) => {
    setName(d.name ?? "");
    setPhone(d.phone ?? "");
    setSchool(d.school ?? "");
    setStudentClass(d.class !== undefined ? String(d.class) : "");
    setBoard(d.board ?? "");
    setAge(d.age !== undefined ? String(d.age) : "");
    setDob(d.dob ?? "");
    setPreferredLanguage(d.preferredLanguage ?? "");
    setProfilePic(d.profilePic ?? "");
    setLocalImage(null);
    setInterests(d.interests ?? []);
    setArea(d.location?.area ?? (d.location as any)?.city ?? "");
    setDistrict(d.location?.district ?? "");
    setPincode(d.location?.pincode ?? "");
    setStateVal(d.location?.state ?? "");
  };

  const resetPhoneOtpState = () => {
    setPhoneVerified(false);
    setOtpSent(false);
    setOtpValue("");
    setConfirmationResult(null);
  };

  const fetchLocation = async (pin: string) => {
    if (pin.length !== 6) { setArea(""); setDistrict(""); setStateVal(""); return; }
    setPincodeLoading(true);
    try {
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data[0]?.Status === "Success") {
        const info = data[0].PostOffice[0];
        setArea(info.Name);
        setDistrict(info.District);
        setStateVal(info.State);
      } else {
        setArea(""); setDistrict(""); setStateVal("");
      }
    } catch { /* ignore network error */ }
    finally { setPincodeLoading(false); }
  };

  // ─── Phone OTP ──────────────────────────────────────────
  const handleSendOtp = async () => {
    const digits = phone.trim().replace(/\D/g, "");
    if (digits.length !== 10) {
      Alert.alert("Invalid Number", "Enter a valid 10-digit mobile number.");
      return;
    }
    setSendingOtp(true);
    try {
      const phoneAuth = getPhoneVerifyAuth();
      // expo-firebase-recaptcha removed — RN phone auth does not need DOM recaptcha
      const result = await signInWithPhoneNumber(phoneAuth, "+91" + digits, undefined as any);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (e: any) {
      Alert.alert("OTP Error", e.message ?? "Failed to send OTP. Try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!confirmationResult || otpValue.length < 6) return;
    setVerifyingOtp(true);
    try {
      await confirmationResult.confirm(otpValue);
      setPhoneVerified(true);
      setOtpSent(false);
      setOtpValue("");
    } catch {
      Alert.alert("Invalid OTP", "The code you entered is incorrect. Try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ─── Pick image ──────────────────────────────────────────
  const handlePickImage = async () => {
    if (!isEditing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission Denied", "Please allow access to your photo library."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) setLocalImage(result.assets[0].uri);
  };

  const uploadImageToStorage = async (localUri: string, uid: string): Promise<string> => {
    setIsUploadingPhoto(true);
    setUploadProgress(0);
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload  = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", localUri, true);
        xhr.send(null);
      });
      const storageRef = ref(storage, `profilePics/${uid}/profile.jpg`);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      return await new Promise<string>((resolve, reject) => {
        uploadTask.on("state_changed",
          (s) => setUploadProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
          (err) => reject(err),
          async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
        );
      });
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgress(0);
    }
  };

  const handleRemovePhoto = () => {
    if (!isEditing) return;
    Alert.alert("Remove Photo", "Remove your current profile photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { setLocalImage(null); setProfilePic(""); } },
    ]);
  };

  // ─── Save ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Validation", "Name is required."); return; }
    if (phoneDirty && !phoneVerified) {
      Alert.alert("Verify Phone", "Please verify your new phone number with OTP before saving.");
      return;
    }
    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not authenticated");

      let finalPhotoURL = profilePic;
      if (localImage) finalPhotoURL = await uploadImageToStorage(localImage, uid);
      if (!profilePic && !localImage && original?.profilePic) {
        try { await deleteObject(ref(storage, `profilePics/${uid}/profile.jpg`)); } catch { /* ok */ }
      }

      const updatePayload: StudentData = {
        name: name.trim(), phone: phone.trim(), school: school.trim(),
        class: studentClass.trim(), board: board.trim(),
        age: age ? parseInt(age, 10) : undefined,
        dob: dob.trim(), preferredLanguage, profilePic: finalPhotoURL, interests,
        location: { area: area.trim(), district: district.trim(), pincode: pincode.trim(), state: stateVal.trim() },
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, "students", uid), updatePayload);
      setProfilePic(finalPhotoURL);
      setLocalImage(null);
      setOriginal((prev) => ({ ...prev, ...updatePayload }));
      resetPhoneOtpState();
      setIsEditing(false);
      Alert.alert("✅ Saved", "Profile updated successfully.");
    } catch (e: unknown) {
      Alert.alert("Error", "Failed to save: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (original) populateState(original);
    resetPhoneOtpState();
    setIsEditing(false);
  };

  const toggleInterest = (item: string) => {
    if (!isEditing) return;
    setInterests((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]);
  };

  const handleDelete = () => {
    Alert.alert("⚠️ Delete Account", "This permanently deletes your GLOOWS365E profile and cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error("Not authenticated");
            try { await deleteObject(ref(storage, `profilePics/${uid}/profile.jpg`)); } catch { /* ok */ }
            await deleteDoc(doc(db, "students", uid));
            await deleteUser(auth.currentUser as User);
            router.replace("/");
          } catch (e: unknown) {
            const err = e as { code?: string; message?: string };
            if (err.code === "auth/requires-recent-login")
              Alert.alert("Re-login Required", "Please log out and log back in, then try again.");
            else
              Alert.alert("Error", err.message ?? "Unknown error");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const displayImage = localImage ?? profilePic ?? null;

  // ─── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu={true} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main UI ─────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

      <Header hideMenu={true} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── PAGE TITLE + EDIT BUTTON ─────────────── */}
          <View style={styles.titleRow}>
            <View style={styles.titleTextBlock}>
              <Text style={[styles.title, { color: colors.accent }]}>👤 Profile Settings</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isEditing ? "Editing your details..." : "View and update your personal details"}
              </Text>
            </View>
            {!isEditing && (
              <TouchableOpacity
                style={[styles.editIconBtn, { backgroundColor: colors.accent }]}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="create-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* ── AVATAR ───────────────────────────────── */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={[styles.avatarImage, { borderColor: colors.accent }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: `${colors.accent}20`, borderColor: colors.accent }]}>
                  <Text style={[styles.avatarInitial, { color: colors.accent }]}>
                    {name ? name.charAt(0).toUpperCase() : "S"}
                  </Text>
                </View>
              )}
              {isEditing && (
                <TouchableOpacity style={[styles.cameraButton, { backgroundColor: colors.accent }]} onPress={handlePickImage}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.avatarName, { color: colors.text }]}>{name || "Student"}</Text>

            {isUploadingPhoto && (
              <>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${uploadProgress}%` as `${number}%`, backgroundColor: colors.accent }]} />
                </View>
                <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Uploading... {uploadProgress}%</Text>
              </>
            )}

            <View style={styles.avatarBadgeRow}>
              {studentClass ? (
                <View style={[styles.badge, { backgroundColor: `${colors.accent}20` }]}>
                  <Text style={[styles.badgeText, { color: colors.accent }]}>{studentClass}</Text>
                </View>
              ) : null}
              {board ? (
                <View style={[styles.badge, { backgroundColor: `${colors.accent}20` }]}>
                  <Text style={[styles.badgeText, { color: colors.accent }]}>{board}</Text>
                </View>
              ) : null}
            </View>

            {isEditing && (
              <View style={styles.photoActions}>
                <TouchableOpacity style={[styles.photoBtn, { borderColor: colors.accent }]} onPress={handlePickImage}>
                  <Ionicons name="image-outline" size={15} color={colors.accent} />
                  <Text style={[styles.photoBtnText, { color: colors.accent }]}>{localImage ? "Change Photo" : "Upload Photo"}</Text>
                </TouchableOpacity>
                {displayImage ? (
                  <TouchableOpacity style={[styles.photoBtn, { borderColor: "#FF4D4D" }]} onPress={handleRemovePhoto}>
                    <Ionicons name="trash-outline" size={15} color="#FF4D4D" />
                    <Text style={[styles.photoBtnText, { color: "#FF4D4D" }]}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          {/* ── FORM ─────────────────────────────────── */}
          <View style={styles.formContainer}>

            <SectionTitle icon="🧑" label={t("basicInfo")} colors={colors as ThemeColors} />
            <Field label="Full Name" icon="person-outline" value={name} onChangeText={setName}
              placeholder="Enter full name" isEditing={isEditing} colors={colors as ThemeColors} />

            {/* ── PHONE WITH OTP ──────────────────────── */}
            <View style={styles.fieldWrapper}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>PHONE NUMBER</Text>
              <View style={styles.phoneRow}>
                <View style={[styles.inputRow, styles.phoneInput, {
                  backgroundColor: colors.card,
                  borderColor: isEditing
                    ? (phoneVerified && phoneDirty ? "#22C55E" : colors.accent)
                    : colors.border,
                }]}>
                  <Ionicons name="call-outline" size={17}
                    color={isEditing ? (phoneVerified && phoneDirty ? "#22C55E" : colors.accent) : colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={phone}
                    onChangeText={(t) => { setPhone(t); resetPhoneOtpState(); }}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    editable={isEditing}
                  />
                  {phoneVerified && phoneDirty && (
                    <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                  )}
                  {!isEditing && <Ionicons name="lock-closed-outline" size={13} color={colors.border} />}
                </View>

                {isEditing && phoneDirty && !phoneVerified && (
                  <TouchableOpacity
                    style={[styles.otpSendBtn, { backgroundColor: colors.accent, opacity: sendingOtp ? 0.7 : 1 }]}
                    onPress={handleSendOtp}
                    disabled={sendingOtp}
                  >
                    {sendingOtp
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.otpSendBtnText}>Verify</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>

              {/* OTP input row */}
              {otpSent && !phoneVerified && (
                <View style={styles.otpRow}>
                  <TextInput
                    style={[styles.otpInput, { backgroundColor: colors.card, borderColor: colors.accent, color: colors.text }]}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={colors.textSecondary}
                    value={otpValue}
                    onChangeText={setOtpValue}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.otpConfirmBtn, { backgroundColor: "#22C55E", opacity: verifyingOtp ? 0.7 : 1 }]}
                    onPress={handleVerifyOtp}
                    disabled={verifyingOtp || otpValue.length < 6}
                  >
                    {verifyingOtp
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.otpConfirmBtnText}>Confirm</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Field label="Date of Birth" icon="calendar-outline" value={dob} onChangeText={setDob}
              placeholder="MM/DD/YYYY" autoCapitalize="none" isEditing={isEditing} colors={colors as ThemeColors} />
            <Field label="Age" icon="hourglass-outline" value={age} onChangeText={setAge}
              placeholder="Enter age" keyboardType="numeric" autoCapitalize="none"
              isEditing={isEditing} colors={colors as ThemeColors} />

            <SectionTitle icon="📚" label={t("academicDetails")} colors={colors as ThemeColors} />
            <Field label="School / Institution" icon="business-outline" value={school} onChangeText={setSchool}
              placeholder="Enter school name" isEditing={isEditing} colors={colors as ThemeColors} />

            <ChipRow label="Class / Grade" options={CLASS_OPTIONS}
              selected={studentClass ? [studentClass] : []}
              onToggle={(opt) => { if (isEditing) setStudentClass(opt === studentClass ? "" : opt); }}
              isEditing={isEditing} colors={colors as ThemeColors} />
            <ChipRow label="Board" options={BOARDS}
              selected={board ? [board] : []}
              onToggle={(opt) => { if (isEditing) setBoard(opt === board ? "" : opt); }}
              isEditing={isEditing} colors={colors as ThemeColors} />
            {/* Language — navigates to dedicated picker */}
            <View style={styles.fieldWrapper}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>PREFERRED LANGUAGE</Text>
              <TouchableOpacity
                style={[styles.langCard, {
                  backgroundColor: colors.card,
                  borderColor: isEditing ? colors.accent : colors.border,
                }]}
                onPress={() => { if (isEditing) router.push("/language-settings" as any); }}
                activeOpacity={isEditing ? 0.7 : 1}
              >
                {(() => {
                  const lang = INDIAN_LANGUAGES.find((l) => l.name === preferredLanguage);
                  return lang ? (
                    <>
                      <View style={[styles.langNativeBadge, { backgroundColor: `${colors.accent}20` }]}>
                        <Text style={[styles.langNativeText, { color: colors.accent }]}>{lang.native}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.langNameText, { color: colors.text }]}>{lang.name}</Text>
                        <Text style={[styles.langRegionText, { color: colors.textSecondary }]}>{lang.region}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={[styles.langNameText, { color: colors.textSecondary, flex: 1 }]}>
                      Not set — tap to choose
                    </Text>
                  );
                })()}
                {isEditing && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                {!isEditing && preferredLanguage && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
              </TouchableOpacity>
              {isEditing && (
                <Text style={[styles.langHint, { color: colors.textSecondary }]}>
                  All 22 constitutionally recognised Indian languages available
                </Text>
              )}
            </View>
            <ChipRow label="Interests" options={INTEREST_OPTIONS}
              selected={interests} onToggle={toggleInterest}
              isEditing={isEditing} colors={colors as ThemeColors} />

            <SectionTitle icon="📍" label="Location" colors={colors as ThemeColors} />

            {/* Pincode — editable, triggers auto-fetch */}
            <View style={styles.fieldWrapper}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>PINCODE</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: isEditing ? colors.accent : colors.border }]}>
                <Ionicons name="pin-outline" size={17} color={isEditing ? colors.accent : colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={pincode}
                  onChangeText={(t) => { setPincode(t); if (isEditing) fetchLocation(t); }}
                  placeholder="6-digit pincode"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  maxLength={6}
                  editable={isEditing}
                />
                {pincodeLoading && <ActivityIndicator size="small" color={colors.accent} />}
                {!isEditing && <Ionicons name="lock-closed-outline" size={13} color={colors.border} />}
              </View>
            </View>

            {/* Area, District, State — read-only, auto-filled from pincode */}
            {(area || district || stateVal) ? (
              <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="location" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  {area     && <Text style={[styles.locationLine, { color: colors.text }]}>📌 {area}</Text>}
                  {district && <Text style={[styles.locationLine, { color: colors.text }]}>🏛 {district}</Text>}
                  {stateVal && <Text style={[styles.locationLine, { color: colors.text }]}>🗺 {stateVal}</Text>}
                  <Text style={[styles.locationHint, { color: colors.textSecondary }]}>
                    Auto-filled from pincode
                  </Text>
                </View>
              </View>
            ) : isEditing ? (
              <Text style={[styles.locationHint, { color: colors.textSecondary, paddingHorizontal: 4 }]}>
                Enter a valid 6-digit pincode to auto-fill area, district &amp; state
              </Text>
            ) : null}
          </View>

          {/* ── SAVE / CANCEL (shown only when editing) ── */}
          {isEditing && (
            <View style={styles.actionsContainer}>
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={handleCancel} disabled={saving}
                >
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 }]}
                  onPress={handleSave} disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Ionicons name="checkmark-outline" size={20} color="#fff" /><Text style={styles.buttonText}>{t("saveChanges")}</Text></>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── DANGER ZONE ──────────────────────────── */}
          <View style={[styles.dangerZone, { borderColor: "#FF4D4D30", backgroundColor: "#FF4D4D08" }]}>
            <Text style={[styles.dangerTitle, { color: "#FF4D4D" }]}>⚠️ Danger Zone</Text>
            <Text style={[styles.dangerHint, { color: colors.textSecondary }]}>
              Deleting your account removes all your GLOOWS365E data permanently.
            </Text>
            <TouchableOpacity style={[styles.dangerRow, { opacity: deleting ? 0.6 : 1 }]}
              onPress={handleDelete} disabled={deleting}>
              {deleting
                ? <ActivityIndicator size="small" color="#FF4D4D" />
                : <Ionicons name="trash-outline" size={16} color="#FF4D4D" />
              }
              <Text style={styles.dangerText}>Delete My Account</Text>
            </TouchableOpacity>
          </View>

          {/* ── BACK BUTTON ──────────────────────────── */}
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={[styles.backText, { color: colors.text }]}>Back to Settings</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { fontSize: 14, fontWeight: "500" },

  // Title row with edit button
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15 },
  titleTextBlock: { flex: 1, marginRight: 12 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: "500" },
  editIconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },

  // Avatar
  avatarSection: { alignItems: "center", marginVertical: 16, gap: 6 },
  avatarWrapper: { position: "relative", marginBottom: 4 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 3 },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, justifyContent: "center", alignItems: "center" },
  avatarInitial: { fontSize: 40, fontWeight: "800" },
  cameraButton: { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  avatarName: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  avatarBadgeRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  photoActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  photoBtnText: { fontSize: 13, fontWeight: "600" },

  // Progress
  progressBar: { width: 180, height: 6, borderRadius: 3, overflow: "hidden", marginTop: 4 },
  progressFill: { height: "100%", borderRadius: 3 },
  uploadText: { fontSize: 12, fontWeight: "500", marginTop: 2 },

  // Form
  formContainer: { paddingHorizontal: 20, gap: 14, marginTop: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 2 },
  sectionIcon: { fontSize: 18 },
  sectionLabel: { fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  fieldWrapper: { gap: 5 },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: "500" },

  // Phone + OTP
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  phoneInput: { flex: 1 },
  otpSendBtn: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, minWidth: 76, alignItems: "center", justifyContent: "center" },
  otpSendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  otpRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  otpInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontWeight: "600", letterSpacing: 4 },
  otpConfirmBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  otpConfirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },

  // Actions
  actionsContainer: { paddingHorizontal: 20, marginTop: 24, marginBottom: 4 },
  editActions: { flexDirection: "row", gap: 12 },
  cancelButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" },
  saveButton: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Danger
  dangerZone: { marginHorizontal: 20, marginTop: 28, padding: 16, borderRadius: 12, borderWidth: 1, gap: 8 },
  dangerTitle: { fontSize: 14, fontWeight: "700" },
  dangerHint: { fontSize: 12, fontWeight: "500", lineHeight: 18 },
  dangerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  dangerText: { color: "#FF4D4D", fontSize: 14, fontWeight: "600" },

  // Back
  backButton: { marginHorizontal: 20, marginTop: 20, marginBottom: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  backText: { fontSize: 15, fontWeight: "600" },

  // Location card (read-only)
  locationCard: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "flex-start" },
  locationLine: { fontSize: 14, fontWeight: "600", marginBottom: 3 },
  locationHint: { fontSize: 11, marginTop: 4 },

  // Language card
  langCard:        { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  langNativeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  langNativeText:  { fontSize: 15, fontWeight: "700" },
  langNameText:    { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  langRegionText:  { fontSize: 12, fontWeight: "500" },
  langHint:        { fontSize: 11, marginTop: 5, paddingHorizontal: 2 },
});