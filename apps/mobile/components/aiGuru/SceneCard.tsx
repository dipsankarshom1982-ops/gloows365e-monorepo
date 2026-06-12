import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Scene } from "@/lib/aiGuru/types";

const VISUAL_ICONS: Record<string, string> = {
  animation: "🎬", diagram: "📊", code: "💻",
  table: "📋", story: "📖", practical: "🔧",
};

interface Props {
  scene: Scene;
  totalScenes: number;
  onExplainAgain: () => void;
  onSimplify: () => void;
  onExample: () => void;
  onTranslate: () => void;
}

export default function SceneCard({
  scene, totalScenes,
  onExplainAgain, onSimplify, onExample, onTranslate,
}: Props) {
  const [checkRevealed, setCheckRevealed] = useState(false);
  const [selectedOpt, setSelectedOpt]     = useState<number | null>(null);

  const handleOption = (i: number) => {
    if (checkRevealed) return;
    setSelectedOpt(i);
    setCheckRevealed(true);
  };

  const isCorrect = selectedOpt === scene.checkQuestion.correctAnswerIndex;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={S.scroll}>
      {/* Scene header */}
      <LinearGradient colors={["#1e1b4b", "#312e81"]} style={S.header}>
        <View style={S.headerRow}>
          <View style={S.sceneBadge}>
            <Text style={S.sceneNum}>Scene {scene.sceneNumber} / {totalScenes}</Text>
          </View>
          <Text style={S.visualIcon}>{VISUAL_ICONS[scene.visualType] ?? "📚"}</Text>
        </View>
        <Text style={S.sceneTitle}>{scene.sceneTitle}</Text>
        <Text style={S.visualDesc}>{scene.visualDescription}</Text>
      </LinearGradient>

      {/* Narration */}
      <View style={S.narrationCard}>
        <Text style={S.narrationLabel}>🧑‍🏫 AI Guru Says</Text>
        <Text style={S.narration}>{scene.narration}</Text>
      </View>

      {/* Key concept + example */}
      {scene.keyConcept ? (
        <View style={S.conceptRow}>
          <View style={[S.conceptPill, { backgroundColor: "#1e3a5f" }]}>
            <Text style={S.conceptEmoji}>💡</Text>
            <Text style={S.conceptText}>{scene.keyConcept}</Text>
          </View>
        </View>
      ) : null}

      {scene.example ? (
        <View style={S.exampleCard}>
          <Text style={S.exampleLabel}>📌 Real Example</Text>
          <Text style={S.exampleText}>{scene.example}</Text>
        </View>
      ) : null}

      {scene.studentAction ? (
        <View style={S.actionCard}>
          <Text style={S.actionLabel}>✋ Your Turn</Text>
          <Text style={S.actionText}>{scene.studentAction}</Text>
        </View>
      ) : null}

      {/* Check question */}
      <View style={S.checkCard}>
        <Text style={S.checkLabel}>🎯 Quick Check</Text>
        <Text style={S.checkQ}>{scene.checkQuestion.question}</Text>
        <View style={S.optionsWrap}>
          {scene.checkQuestion.options.map((opt, i) => {
            const isThis    = selectedOpt === i;
            const isRight   = checkRevealed && i === scene.checkQuestion.correctAnswerIndex;
            const isWrong   = checkRevealed && isThis && !isRight;
            return (
              <TouchableOpacity
                key={i}
                style={[S.optBtn, isRight && S.optRight, isWrong && S.optWrong]}
                onPress={() => handleOption(i)}
                activeOpacity={checkRevealed ? 1 : 0.8}
              >
                <Text style={S.optLabel}>{["A","B","C","D"][i]}</Text>
                <Text style={S.optText}>{opt}</Text>
                {isRight && <Ionicons name="checkmark-circle" size={18} color="#10b981" />}
                {isWrong && <Ionicons name="close-circle"     size={18} color="#ef4444" />}
              </TouchableOpacity>
            );
          })}
        </View>
        {checkRevealed && (
          <View style={[S.expCard, { borderColor: isCorrect ? "#10b981" : "#ef4444" }]}>
            <Text style={[S.expTitle, { color: isCorrect ? "#10b981" : "#ef4444" }]}>
              {isCorrect ? "✅ Correct!" : "❌ Not quite"}
            </Text>
            <Text style={S.expText}>{scene.checkQuestion.explanation}</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={S.actionBtns}>
        {[
          { label: "Explain Again", icon: "refresh" as const, fn: onExplainAgain },
          { label: "Simpler",       icon: "bulb-outline" as const, fn: onSimplify  },
          { label: "Example",       icon: "earth-outline" as const, fn: onExample  },
          { label: "Translate",     icon: "language-outline" as const, fn: onTranslate },
        ].map((btn) => (
          <TouchableOpacity key={btn.label} style={S.aBtn} onPress={btn.fn} activeOpacity={0.8}>
            <Ionicons name={btn.icon} size={14} color="#a5b4fc" />
            <Text style={S.aBtnText}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll:        { flex: 1 },
  header:        { borderRadius: 20, padding: 18, margin: 16, marginBottom: 12 },
  headerRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sceneBadge:    { backgroundColor: "rgba(99,102,241,0.3)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sceneNum:      { color: "#a5b4fc", fontSize: 11, fontWeight: "800" },
  visualIcon:    { fontSize: 24 },
  sceneTitle:    { color: "#f1f5f9", fontSize: 20, fontWeight: "900", marginBottom: 6 },
  visualDesc:    { color: "#94a3b8", fontSize: 12, fontStyle: "italic" },
  narrationCard: { marginHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 16, padding: 16, marginBottom: 12 },
  narrationLabel:{ color: "#6366f1", fontSize: 11, fontWeight: "800", marginBottom: 6 },
  narration:     { color: "#e2e8f0", fontSize: 15, lineHeight: 24 },
  conceptRow:    { paddingHorizontal: 16, marginBottom: 10 },
  conceptPill:   { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12 },
  conceptEmoji:  { fontSize: 16 },
  conceptText:   { color: "#93c5fd", fontSize: 13, fontWeight: "700", flex: 1 },
  exampleCard:   { marginHorizontal: 16, backgroundColor: "#132027", borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: "#06b6d4", marginBottom: 10 },
  exampleLabel:  { color: "#06b6d4", fontSize: 11, fontWeight: "800", marginBottom: 4 },
  exampleText:   { color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  actionCard:    { marginHorizontal: 16, backgroundColor: "#1a2a1a", borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: "#10b981", marginBottom: 12 },
  actionLabel:   { color: "#10b981", fontSize: 11, fontWeight: "800", marginBottom: 4 },
  actionText:    { color: "#cbd5e1", fontSize: 14 },
  checkCard:     { marginHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 18, padding: 16, marginBottom: 12 },
  checkLabel:    { color: "#fbbf24", fontSize: 11, fontWeight: "800", marginBottom: 8 },
  checkQ:        { color: "#f1f5f9", fontSize: 15, fontWeight: "700", marginBottom: 12, lineHeight: 22 },
  optionsWrap:   { gap: 8 },
  optBtn:        { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#334155", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "transparent" },
  optRight:      { borderColor: "#10b981", backgroundColor: "#052e16" },
  optWrong:      { borderColor: "#ef4444", backgroundColor: "#450a0a" },
  optLabel:      { width: 24, height: 24, backgroundColor: "#475569", borderRadius: 6, textAlign: "center", lineHeight: 24, color: "#a5b4fc", fontWeight: "800", fontSize: 12 },
  optText:       { flex: 1, color: "#cbd5e1", fontSize: 14 },
  expCard:       { marginTop: 12, borderRadius: 10, borderWidth: 1, padding: 12 },
  expTitle:      { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  expText:       { color: "#94a3b8", fontSize: 13, lineHeight: 18 },
  actionBtns:    { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  aBtn:          { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1e293b", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  aBtnText:      { color: "#a5b4fc", fontSize: 12, fontWeight: "700" },
});
