// PATH: app/ai-guru/photo-solve.tsx
// PhotoSolve AI — snap/upload a question photo → instant step-by-step solution
// Premium: 50/day  |  Free: 3/day

import { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { solvePhotoQuestion, PhotoSolveSolution } from "@/services/photoSolveApi";

const FREE_DAILY = 3;

type Phase = "pick" | "solving" | "result" | "limit" | "error";

export default function PhotoSolveScreen() {
  const insets = useSafeAreaInsets();
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();

  const bg      = isDarkMode ? "#060612" : colors.background;
  const surface = isDarkMode ? "#1e293b" : colors.card;
  const border  = isDarkMode ? "#334155" : colors.border;
  const text    = isDarkMode ? "#f1f5f9" : colors.text;
  const muted   = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const dim     = isDarkMode ? "#64748b" : colors.textSecondary;
  const backBg  = isDarkMode ? "rgba(255,255,255,0.08)" : colors.card;

  const classLevel = String(studentProfile?.class ?? "10");
  const board      = studentProfile?.board ?? "CBSE";
  const language   = studentProfile?.preferredLanguage ?? "English";

  const [phase,    setPhase]    = useState<Phase>("pick");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [solution, setSolution] = useState<PhotoSolveSolution | null>(null);
  const [errMsg,   setErrMsg]   = useState("");
  const [remaining, setRemaining] = useState(FREE_DAILY);

  // ── Pick image ─────────────────────────────────────────────────────────────
  const pickImage = async (source: "camera" | "gallery") => {
    try {
      let result;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Camera access is required."); return; }
        result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.85 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.85,
        });
      }

      if (result.canceled || !result.assets[0]?.base64) return;

      const asset = result.assets[0];
      setImageUri(asset.uri);
      await solve(asset.base64!, asset.uri.toLowerCase().endsWith("png") ? "image/png" : "image/jpeg");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not pick image");
    }
  };

  const solve = async (base64: string, mimeType: string) => {
    setPhase("solving");
    setSolution(null);
    setErrMsg("");
    try {
      const result = await solvePhotoQuestion({ imageBase64: base64, imageMimeType: mimeType, classLevel, board, language });
      setSolution(result);
      setPhase("result");
      setRemaining((r) => Math.max(0, r - 1));
    } catch (e: any) {
      if (e?.code === "LIMIT_REACHED") {
        setPhase("limit");
      } else {
        setErrMsg(e?.message ?? "Something went wrong");
        setPhase("error");
      }
    }
  };

  const reset = () => { setPhase("pick"); setImageUri(null); setSolution(null); setErrMsg(""); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { backgroundColor: bg }]}>
      {isDarkMode && <LinearGradient colors={["#060612", "#0a0a1a"]} style={StyleSheet.absoluteFillObject} />}

      {/* Header */}
      <Animated.View entering={FadeIn.duration(350)} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[S.backBtn, { backgroundColor: backBg }]}>
          <Ionicons name="chevron-back" size={22} color={muted} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: text }]}>📸 PhotoSolve AI</Text>
          <Text style={[S.headerSub, { color: dim }]}>Snap any question for instant solution</Text>
        </View>
        <View style={[S.quotaBadge, { backgroundColor: surface, borderColor: remaining > 0 ? border : "rgba(239,68,68,0.4)" }]}>
          <View style={[S.quotaDot, { backgroundColor: remaining > 0 ? "#10b981" : "#ef4444" }]} />
          <Text style={[S.quotaText, { color: remaining > 0 ? "#10b981" : "#ef4444" }]}>
            {remaining}/{FREE_DAILY}
          </Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>

        {/* ── PICK PHASE ── */}
        {phase === "pick" && (
          <Animated.View entering={FadeInDown.duration(450).delay(100)}>
            {/* Hero banner */}
            <LinearGradient colors={["#92400e", "#d97706", "#fbbf24"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.heroBanner}>
              <View style={S.heroOrb} />
              <Text style={S.heroBannerEmoji}>📸</Text>
              <Text style={S.heroBannerTitle}>Snap. Solve. Understand.</Text>
              <Text style={S.heroBannerSub}>Point your camera at any textbook question, handwritten problem, or exam paper</Text>
            </LinearGradient>

            {/* Pick buttons */}
            <View style={S.pickRow}>
              <TouchableOpacity style={[S.pickCard, { backgroundColor: surface, borderColor: border }]} onPress={() => pickImage("camera")} activeOpacity={0.8}>
                <LinearGradient colors={["#1e3a5f", "#0284c7"]} style={S.pickCardGrad}>
                  <Ionicons name="camera" size={32} color="#fff" />
                </LinearGradient>
                <Text style={[S.pickCardLabel, { color: text }]}>Take Photo</Text>
                <Text style={[S.pickCardSub, { color: dim }]}>Use camera now</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[S.pickCard, { backgroundColor: surface, borderColor: border }]} onPress={() => pickImage("gallery")} activeOpacity={0.8}>
                <LinearGradient colors={["#312e81", "#6366f1"]} style={S.pickCardGrad}>
                  <Ionicons name="images" size={32} color="#fff" />
                </LinearGradient>
                <Text style={[S.pickCardLabel, { color: text }]}>From Gallery</Text>
                <Text style={[S.pickCardSub, { color: dim }]}>Pick saved photo</Text>
              </TouchableOpacity>
            </View>

            {/* Works with section */}
            <View style={[S.worksCard, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.worksTitle, { color: text }]}>✅ Works with</Text>
              {["Textbook problems & exercises", "Handwritten question papers", "Board exam previous year questions", "Formulae & derivation problems", "Diagram-based questions"].map((item) => (
                <View key={item} style={S.worksRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={[S.worksItem, { color: muted }]}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Board + Class context */}
            <View style={[S.contextBadge, { backgroundColor: surface, borderColor: border }]}>
              <Ionicons name="school-outline" size={14} color="#6366f1" />
              <Text style={[S.contextText, { color: dim }]}>Solving for Class {classLevel} · {board} · {language}</Text>
            </View>
          </Animated.View>
        )}

        {/* ── SOLVING PHASE ── */}
        {phase === "solving" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            {imageUri && <Image source={{ uri: imageUri }} style={S.previewThumb} resizeMode="cover" />}
            <LinearGradient colors={["#92400e", "#d97706"]} style={S.thinkingOrb}>
              <ActivityIndicator color="#fff" size="large" />
            </LinearGradient>
            <Text style={[S.thinkingTitle, { color: text }]}>Solving your question…</Text>
            <Text style={[S.thinkingNote, { color: dim }]}>Gemini Vision is reading and solving this for you</Text>
          </Animated.View>
        )}

        {/* ── RESULT PHASE ── */}
        {phase === "result" && solution && (
          <Animated.View entering={FadeInDown.duration(450)} style={S.resultBlock}>
            {/* Photo preview */}
            {imageUri && <Image source={{ uri: imageUri }} style={S.resultImage} resizeMode="cover" />}

            {/* Subject badge */}
            <View style={[S.subjectBadge, { backgroundColor: "rgba(99,102,241,0.15)", borderColor: "#6366f1" }]}>
              <Text style={S.subjectText}>{solution.subject}</Text>
            </View>

            {/* Question text */}
            <View style={[S.card, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.cardLabel, { color: dim }]}>📖 Question Read</Text>
              <Text style={[S.questionText, { color: text }]}>{solution.questionText}</Text>
            </View>

            {/* Step-by-step solution */}
            <View style={[S.card, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.cardLabel, { color: dim }]}>🔢 Step-by-Step Solution</Text>
              {solution.solution.steps.map((step, i) => (
                <View key={i} style={S.stepRow}>
                  <View style={S.stepBadge}>
                    <Text style={S.stepNum}>{i + 1}</Text>
                  </View>
                  <Text style={[S.stepText, { color: text }]}>{step}</Text>
                </View>
              ))}
              <View style={[S.finalAnswerBox, { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "#10b981" }]}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={S.finalAnswerText}>{solution.solution.finalAnswer}</Text>
              </View>
              {solution.solution.formula && (
                <View style={[S.formulaBox, { backgroundColor: "rgba(99,102,241,0.1)", borderColor: "#6366f1" }]}>
                  <Text style={[S.formulaLabel, { color: dim }]}>Formula used</Text>
                  <Text style={S.formulaText}>{solution.solution.formula}</Text>
                </View>
              )}
            </View>

            {/* Concept explained */}
            <View style={[S.card, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.cardLabel, { color: dim }]}>💡 Concept Explained</Text>
              <Text style={[S.conceptText, { color: text }]}>{solution.conceptExplained}</Text>
              <View style={[S.examTipBox, { backgroundColor: "rgba(251,191,36,0.1)", borderColor: "#fbbf24" }]}>
                <Ionicons name="bulb-outline" size={16} color="#fbbf24" />
                <Text style={[S.examTipText, { color: muted }]}>{solution.examTip}</Text>
              </View>
            </View>

            {/* Similar questions */}
            <View style={[S.card, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.cardLabel, { color: dim }]}>📝 Practice These Too</Text>
              {solution.similarQuestions.map((q, i) => (
                <View key={i} style={[S.simRow, { borderColor: border }]}>
                  <Text style={[S.simQ, { color: text }]}>{i + 1}. {q.question}</Text>
                  <Text style={[S.simHint, { color: dim }]}>💡 Hint: {q.hint}</Text>
                </View>
              ))}
            </View>

            {/* Actions */}
            <TouchableOpacity style={S.solveAnotherBtn} onPress={reset} activeOpacity={0.85}>
              <LinearGradient colors={["#92400e", "#d97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.solveAnotherGrad}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={S.solveAnotherText}>Solve Another Question</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/ai-guru/setup" as any)} style={[S.lessonBtn, { borderColor: border }]}>
              <Text style={[S.lessonBtnText, { color: "#818cf8" }]}>✨ Generate Full Lesson on this Topic</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── LIMIT PHASE ── */}
        {phase === "limit" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <Text style={S.limitEmoji}>⏰</Text>
            <Text style={[S.limitTitle, { color: text }]}>Daily limit reached</Text>
            <Text style={[S.limitBody, { color: muted }]}>
              You've used all {FREE_DAILY} free photo solves today. Upgrade to Premium for 50 solves/day.
            </Text>
            <TouchableOpacity style={S.upgradeWrap} onPress={() => router.push("/ai-guru/subscription" as any)}>
              <LinearGradient colors={["#92400e", "#d97706", "#fbbf24"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.upgradeBtn}>
                <Ionicons name="star" size={16} color="#fff" />
                <Text style={S.upgradeBtnText}>Upgrade to Premium</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── ERROR PHASE ── */}
        {phase === "error" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <Ionicons name="warning-outline" size={48} color="#f59e0b" />
            <Text style={[S.limitTitle, { color: text }]}>Couldn't solve this one</Text>
            <Text style={[S.limitBody, { color: muted }]}>{errMsg}</Text>
            <TouchableOpacity onPress={reset} style={[S.retryBtn, { borderColor: border }]}>
              <Text style={[S.retryText, { color: "#818cf8" }]}>Try Again</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  backBtn:{ width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 17, fontWeight: "900" },
  headerSub:    { fontSize: 11, marginTop: 1 },
  quotaBadge:   { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  quotaDot:     { width: 7, height: 7, borderRadius: 4 },
  quotaText:    { fontSize: 11, fontWeight: "800" },
  scroll:       { paddingHorizontal: 16, paddingTop: 8 },

  heroBanner:     { borderRadius: 20, padding: 22, marginBottom: 20, overflow: "hidden", gap: 6 },
  heroOrb:        { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.1)", top: -40, right: -40 },
  heroBannerEmoji:{ fontSize: 36 },
  heroBannerTitle:{ color: "#fff", fontSize: 20, fontWeight: "900" },
  heroBannerSub:  { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 20 },

  pickRow:  { flexDirection: "row", gap: 12, marginBottom: 16 },
  pickCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 18, alignItems: "center", gap: 10 },
  pickCardGrad: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  pickCardLabel:{ fontSize: 15, fontWeight: "800" },
  pickCardSub:  { fontSize: 11 },

  worksCard:  { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 8 },
  worksTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  worksRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  worksItem:  { fontSize: 13 },

  contextBadge: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  contextText:  { fontSize: 12 },

  centerBlock:  { alignItems: "center", paddingVertical: 60, gap: 16 },
  previewThumb: { width: 160, height: 120, borderRadius: 14, marginBottom: 8 },
  thinkingOrb:  { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  thinkingTitle:{ fontSize: 20, fontWeight: "800" },
  thinkingNote: { fontSize: 13, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  resultBlock:  { gap: 14, paddingTop: 4 },
  resultImage:  { width: "100%", height: 200, borderRadius: 16, marginBottom: 4 },
  subjectBadge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  subjectText:  { color: "#818cf8", fontSize: 12, fontWeight: "800" },

  card:        { borderRadius: 18, borderWidth: 1, padding: 18, gap: 10 },
  cardLabel:   { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  questionText:{ fontSize: 15, lineHeight: 24, fontWeight: "600" },

  stepRow:   { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center", marginTop: 1, flexShrink: 0 },
  stepNum:   { color: "#fff", fontSize: 12, fontWeight: "900" },
  stepText:  { flex: 1, fontSize: 14, lineHeight: 22 },

  finalAnswerBox:  { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 4 },
  finalAnswerText: { flex: 1, color: "#10b981", fontSize: 14, fontWeight: "800", lineHeight: 20 },
  formulaBox:      { borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 4 },
  formulaLabel:    { fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 },
  formulaText:     { color: "#818cf8", fontSize: 14, fontWeight: "700" },

  conceptText:  { fontSize: 14, lineHeight: 24 },
  examTipBox:   { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 4 },
  examTipText:  { flex: 1, fontSize: 13, lineHeight: 20 },

  simRow:  { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  simQ:    { fontSize: 13, fontWeight: "600", lineHeight: 20 },
  simHint: { fontSize: 12, fontStyle: "italic" },

  solveAnotherBtn:  { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  solveAnotherGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  solveAnotherText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  lessonBtn:        { borderRadius: 14, borderWidth: 1, paddingVertical: 13, alignItems: "center" },
  lessonBtnText:    { fontSize: 14, fontWeight: "700" },

  limitEmoji: { fontSize: 52 },
  limitTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", maxWidth: 280 },
  limitBody:  { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  upgradeWrap:  { width: "100%", borderRadius: 16, overflow: "hidden" },
  upgradeBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  upgradeBtnText:{ color: "#fff", fontSize: 16, fontWeight: "900" },
  retryBtn:  { borderRadius: 12, borderWidth: 1, paddingHorizontal: 32, paddingVertical: 12, marginTop: 4 },
  retryText: { fontSize: 14, fontWeight: "700" },
});
