import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { auth } from "@/lib/firebase";
import { generateLesson } from "@/services/aiGuruApi";
import { getRemainingLessons } from "@/services/aiGuruFirestore";
import PremiumLock from "@/components/aiGuru/PremiumLock";

type Tab = "text" | "image" | "topic";

export default function ContentScreen() {
  const params = useLocalSearchParams<{
    board: string; classLevel: string; subject: string;
    chapter: string; topic: string; language: string;
    difficulty: string; lessonStyle: string;
  }>();

  const [activeTab, setTab]         = useState<Tab>("text");
  const [inputText, setInputText]   = useState("");
  const [imageUri, setImageUri]     = useState<string | null>(null);
  const [imageBase64, setBase64]    = useState<string | null>(null);
  const [imageMime, setMime]        = useState<string>("image/jpeg");
  const [generating, setGenerating] = useState(false);
  const [remaining, setRemaining]   = useState<number>(2);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getRemainingLessons(uid).then((rem) => {
      setRemaining(rem);
      if (rem === 0) setLimitReached(true);
    });
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setBase64(asset.base64 ?? null);
    const ext = asset.uri.split(".").pop()?.toLowerCase();
    setMime(ext === "png" ? "image/png" : "image/jpeg");
  };

  const handleGenerate = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { Alert.alert("Not signed in"); return; }
    if (remaining === 0) { setLimitReached(true); return; }

    if (activeTab === "text" && !inputText.trim()) {
      Alert.alert("Empty Input", "Please paste some text content to generate a lesson.");
      return;
    }
    if (activeTab === "image" && !imageBase64) {
      Alert.alert("No Image", "Please upload an image first.");
      return;
    }

    setGenerating(true);
    try {
      const setup = {
        board: params.board,
        classLevel: params.classLevel,
        subject: params.subject,
        chapter: params.chapter,
        topic: params.topic ?? "",
        language: params.language,
        difficulty: params.difficulty as any,
        lessonStyle: params.lessonStyle as any,
      };
      const text = activeTab === "text" ? inputText.trim() : "";
      const b64  = activeTab === "image" ? imageBase64 ?? undefined : undefined;
      const mime = activeTab === "image" ? imageMime : undefined;

      const { lessonId } = await generateLesson(setup, text, b64, mime);
      router.replace({ pathname: "/ai-guru/generating", params: { lessonId } });
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("FREE_LIMIT_REACHED")) {
        setLimitReached(true);
      } else {
        Alert.alert("Generation Failed", msg || "Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  };

  if (limitReached) {
    return (
      <PremiumLock
        feature="unlimited AI lesson generation"
        onUpgrade={() => {}}
        onDismiss={() => setLimitReached(false)}
      />
    );
  }

  return (
    <LinearGradient colors={["#0a0a1a", "#0f172a"]} style={S.bg}>
      <SafeAreaView style={S.safeArea}>
        <KeyboardAvoidingView
          style={S.safeArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={S.header}>
            <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#94a3b8" />
            </TouchableOpacity>
            <Text style={S.headerTitle}>Add Content</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Lesson info summary */}
          <View style={S.infoBar}>
            <Text style={S.infoText} numberOfLines={1}>
              {params.subject} • {params.chapter} • Class {params.classLevel} • {params.board}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={S.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Tabs */}
            <View style={S.tabs}>
              {(["text", "image", "topic"] as Tab[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[S.tab, activeTab === t && S.tabActive]}
                  onPress={() => setTab(t)}
                >
                  <Text style={[S.tabText, activeTab === t && S.tabTextActive]}>
                    {t === "text" ? "📋 Paste Text" : t === "image" ? "📷 Upload Image" : "💡 Topic Only"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab content */}
            {activeTab === "text" && (
              <View style={S.inputSection}>
                <Text style={S.inputLabel}>Paste your chapter content, notes, or textbook text:</Text>
                <TextInput
                  style={S.bigInput}
                  placeholder="Paste text here (up to 5000 characters)..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={12}
                  textAlignVertical="top"
                  scrollEnabled
                  value={inputText}
                  onChangeText={(t) => setInputText(t.slice(0, 5000))}
                />
                <Text style={S.charCount}>{inputText.length} / 5000</Text>
              </View>
            )}

            {activeTab === "image" && (
              <View style={S.inputSection}>
                <Text style={S.inputLabel}>Upload a photo of your textbook page or notes:</Text>
                <TouchableOpacity style={S.imagePicker} onPress={pickImage} activeOpacity={0.8}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={S.imagePreview} resizeMode="contain" />
                  ) : (
                    <View style={S.imageEmpty}>
                      <Ionicons name="camera-outline" size={40} color="#475569" />
                      <Text style={S.imageEmptyText}>Tap to choose image</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {imageUri && (
                  <TouchableOpacity style={S.changeImageBtn} onPress={pickImage}>
                    <Text style={S.changeImageText}>Change Image</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {activeTab === "topic" && (
              <View style={S.inputSection}>
                <View style={S.topicOnlyCard}>
                  <Ionicons name="sparkles-outline" size={32} color="#6366f1" />
                  <Text style={S.topicOnlyTitle}>AI will create a complete lesson</Text>
                  <Text style={S.topicOnlyDesc}>
                    Based on your chapter "{params.chapter}" and subject "{params.subject}", the AI Guru will
                    generate a full interactive lesson without requiring any additional content from you.
                  </Text>
                </View>
              </View>
            )}

            {/* Free usage info */}
            <View style={S.usageInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#475569" />
              <Text style={S.usageInfoText}>
                {remaining === Infinity
                  ? "Unlimited generations (Premium)"
                  : `${remaining} free generation${remaining !== 1 ? "s" : ""} remaining today`}
              </Text>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Generate button */}
          <View style={S.footer}>
            <TouchableOpacity style={S.generateBtn} onPress={handleGenerate} disabled={generating} activeOpacity={0.88}>
              <LinearGradient
                colors={generating ? ["#1e293b", "#1e293b"] : ["#4f46e5", "#7c3aed"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={S.generateBtnGrad}
              >
                {generating ? (
                  <ActivityIndicator color="#6366f1" size="small" />
                ) : (
                  <Ionicons name="sparkles" size={20} color="#fff" />
                )}
                <Text style={[S.generateBtnText, generating && { color: "#475569" }]}>
                  {generating ? "Sending to AI..." : "Generate Lesson ✨"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const S = StyleSheet.create({
  bg:               { flex: 1 },
  safeArea:         { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16 },
  backBtn:          { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  headerTitle:      { color: "#f1f5f9", fontSize: 18, fontWeight: "800" },
  infoBar:          { paddingHorizontal: 16, paddingBottom: 12 },
  infoText:         { color: "#475569", fontSize: 12 },
  scroll:           { paddingHorizontal: 16 },
  tabs:             { flexDirection: "row", backgroundColor: "#1e293b", borderRadius: 14, padding: 4, gap: 2, marginBottom: 20 },
  tab:              { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabActive:        { backgroundColor: "#312e81" },
  tabText:          { color: "#475569", fontSize: 12, fontWeight: "700" },
  tabTextActive:    { color: "#a5b4fc" },
  inputSection:     { gap: 12 },
  inputLabel:       { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  bigInput:         { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, color: "#f1f5f9", fontSize: 14, lineHeight: 22, minHeight: 220, borderWidth: 1, borderColor: "#334155" },
  charCount:        { color: "#334155", fontSize: 11, textAlign: "right" },
  imagePicker:      { backgroundColor: "#1e293b", borderRadius: 16, borderWidth: 1, borderColor: "#334155", minHeight: 220, overflow: "hidden" },
  imagePreview:     { width: "100%", height: 220 },
  imageEmpty:       { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, minHeight: 220 },
  imageEmptyText:   { color: "#475569", fontSize: 14 },
  changeImageBtn:   { alignSelf: "center" },
  changeImageText:  { color: "#6366f1", fontSize: 13, fontWeight: "700" },
  topicOnlyCard:    { backgroundColor: "#1e293b", borderRadius: 20, padding: 28, alignItems: "center", gap: 14, borderWidth: 1, borderColor: "#334155" },
  topicOnlyTitle:   { color: "#f1f5f9", fontSize: 18, fontWeight: "800", textAlign: "center" },
  topicOnlyDesc:    { color: "#64748b", fontSize: 14, textAlign: "center", lineHeight: 22 },
  usageInfo:        { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
  usageInfoText:    { color: "#475569", fontSize: 12 },
  footer:           { padding: 16, backgroundColor: "rgba(10,10,26,0.95)" },
  generateBtn:      { borderRadius: 16, overflow: "hidden" },
  generateBtnGrad:  { flexDirection: "row", paddingVertical: 16, alignItems: "center", justifyContent: "center", gap: 10 },
  generateBtnText:  { color: "#fff", fontSize: 17, fontWeight: "900" },
});
